import { useEffect, useMemo, useRef, useState } from "react";
import * as ROSLIB from "roslib";
import { makeActionClient, makeService, makeTopic } from "../ros";
import { transformPoint } from "../tf";

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

export default function ExploreAndFollow({ ros, tfStore }) {
  const [running, setRunning] = useState(false);
  const [gain, setGain] = useState(0);
  const [status, setStatus] = useState("idle");

  // --- Controller params (match your controller.py defaults) ---
  const robotFrame = "base_link";
  const maxV = 0.5;
  const maxW = 1.0;
  const kLin = 0.8;
  const kAng = 1.5;
  const goalTol = 0.05;

  // ROS interfaces
  const actionClient = useMemo(
    () => makeActionClient(ros, "/get_next_goal", "irob_assignment_1/GetNextGoalAction"),
    [ros]
  );

  const getSetpointSrv = useMemo(
    () => makeService(ros, "/get_setpoint", "irob_assignment_1/GetSetpoint"),
    [ros]
  );

  const cmdVel = useMemo(() => makeTopic(ros, "/cmd_vel", "geometry_msgs/Twist"), [ros]);

  // State refs (avoid stale closures)
  const runningRef = useRef(false);
  const goalRef = useRef(null);
  const exploringRef = useRef(false); // whether an explorer goal is currently active
  const pathRef = useRef(null); // the path we are currently following (mutated via resp.new_path)
  const inFlightRef = useRef(false);
  const loopTimerRef = useRef(null);

  const stopRobot = () => {
    cmdVel.publish({
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    });
  };

  const stopAll = () => {
    runningRef.current = false;
    setRunning(false);
    setStatus("stopped");

    // stop following loop
    if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    loopTimerRef.current = null;

    // cancel exploration goal if active
    try {
      goalRef.current?.cancel();
    } catch { /* empty */ }
    goalRef.current = null;
    exploringRef.current = false;

    inFlightRef.current = false;
    pathRef.current = null;

    stopRobot();
  };

  useEffect(() => {
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request a new path from the explorer (action). This is the “explore step”.
  const requestNewPath = () => {
    if (!runningRef.current) return;
    if (exploringRef.current) return; // already requesting
    exploringRef.current = true;
    setStatus("exploring (requesting next path...)");

    const goal = new ROSLIB.Goal({
      actionClient,
      goalMessage: {}, // empty goal
    });

    goalRef.current = goal;

    goal.on("feedback", (fb) => {
      if (!runningRef.current) return;
      if (typeof fb?.gain === "number") setGain(fb.gain);

      // If feedback contains a path, start following that immediately
      if (fb?.path?.poses?.length) {
        // Only accept a new explorer path if we are NOT currently following one
        if (!pathRef.current?.poses?.length) {
          pathRef.current = fb.path; // we accept this feedback path as the new path to follow
          setStatus(`following (feedback) | poses=${fb.path.poses.length}`);
        }
      }
    });

    goal.on("result", (res) => {
      exploringRef.current = false;

      if (!runningRef.current) return;

      if (typeof res?.gain === "number") setGain(res.gain);

      const poses = res?.path?.poses?.length ?? 0;

      // If explorer returns an empty path => we're done
      if (poses === 0) {
        setStatus("done (explorer returned empty path)");
        stopAll();
        return;
      }

      // Otherwise follow the returned best path
      pathRef.current = res.path;
      setStatus(`following (result) | poses=${poses}`);
    });

    goal.send();
  };

  // Follow loop: calls /get_setpoint at 10Hz and publishes /cmd_vel.
  const startFollowLoop = () => {
    if (loopTimerRef.current) return;

    loopTimerRef.current = setInterval(() => {
      if (!runningRef.current) return;

      const path = pathRef.current;

      // If we have no path to follow right now, request a new one (explore)
      if (!path?.poses?.length) {
        stopRobot();
        requestNewPath();
        return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      getSetpointSrv.callService(
        { path },
        (resp) => {
          try {
            // Update path with shortened version
            pathRef.current = resp.new_path;

            const posesLeft = pathRef.current?.poses?.length ?? 0;

            // When path runs out, we will request a new one on next tick
            if (posesLeft === 0) {
              setStatus("path finished -> requesting new path");
              stopRobot();
              return;
            }

            const sp = resp.setpoint;
            const srcFrame = (sp?.header?.frame_id || "").replace(/^\//, "");
            if (!srcFrame) {
              setStatus("setpoint frame_id empty -> stopping");
              stopRobot();
              return;
            }

            // TF setpoint -> base_link
            const T = tfStore.lookup(srcFrame, robotFrame);
            const pBL = transformPoint(T, sp.point);

            // P-controller in base_link (same structure as your controller.py)
            const x = pBL.x;
            const y = pBL.y;

            const dist = Math.hypot(x, y);
            const ang = Math.atan2(y, x);

            let v = 0,
              w = 0;

            if (dist >= goalTol) {
              w = kAng * ang;
              v = kLin * dist;

              // Burger: do not reverse
              v = Math.max(0, v);

              // Clamp
              v = clamp(v, -maxV, maxV);
              w = clamp(w, -maxW, maxW);

              // Turning hard -> stop forward
              if (Math.abs(w) >= 0.6) v = 0;
            }

            cmdVel.publish({
              linear: { x: v, y: 0, z: 0 },
              angular: { x: 0, y: 0, z: w },
            });

            setStatus(`following | poses_left=${posesLeft} | gain=${gain.toFixed(2)}`);
          } catch (e) {
            setStatus(`follow error: ${String(e)}`);
            stopRobot();
          } finally {
            inFlightRef.current = false;
          }
        },
        (err) => {
          setStatus(`get_setpoint failed: ${String(err)}`);
          stopRobot();
          inFlightRef.current = false;
        }
      );
    }, 100);
  };

  const start = () => {
    stopAll(); // reset any previous state
    runningRef.current = true;
    setRunning(true);
    setGain(0);
    setStatus("starting...");

    // Start the follow loop, which will trigger exploration when no path exists
    startFollowLoop();
  };

  return (
    <div style={card}>
      <h3 style={h3}>Explore + Follow (loop until no path)</h3>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={btn} onClick={start} disabled={running}>
          Start explore+follow loop
        </button>
        <button style={dangerBtn} onClick={stopAll} disabled={!running}>
          Stop
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 13 }}>
        Status: <b>{status}</b>
        <br />
        Gain: <b>{gain.toFixed(3)}</b>
      </div>

      <p style={hint}>
        This will: follow current path via <code>/get_setpoint</code> → when poses run out, request a new path via{" "}
        <code>get_next_goal</code> → repeat. It stops when explorer returns an empty path.
      </p>

      <p style={hint}>
        Make sure your ROS <code>controller.py</code> is NOT running at the same time, otherwise both publish{" "}
        <code>/cmd_vel</code>.
      </p>
    </div>
  );
}

const card = { padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h3 = { margin: "0 0 8px 0" };
const btn = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" };
const dangerBtn = { ...btn, border: "1px solid #d55", background: "#fff5f5" };
const hint = { marginTop: 10, color: "#555", fontSize: 13 };
