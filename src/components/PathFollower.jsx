import { useEffect, useMemo, useRef, useState } from "react";
import { makeService, makeTopic } from "../ros";
import { transformPoint } from "../tf";

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

export default function PathFollower({ ros, tfStore, bestPath }) {
  const [running, setRunning] = useState(false);
  const [info, setInfo] = useState("idle");

  // match your controller defaults
  const [maxV, setMaxV] = useState(0.5);
  const [maxW, setMaxW] = useState(1.0);
  const [kLin, setKLin] = useState(0.8);
  const [kAng, setKAng] = useState(1.5);
  const [goalTol, setGoalTol] = useState(0.05);
  const [robotFrame, setRobotFrame] = useState("base_link");

  const getSetpointSrv = useMemo(
    () => makeService(ros, "/get_setpoint", "irob_assignment_1/GetSetpoint"),
    [ros]
  );
  const cmdVel = useMemo(() => makeTopic(ros, "/cmd_vel", "geometry_msgs/Twist"), [ros]);

  const pathRef = useRef(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  const stopRobot = () => {
    cmdVel.publish({
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopRobot();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!bestPath?.poses?.length) {
      setInfo("No /best_branch path available yet.");
      return;
    }
    // copy the path object (we'll mutate with new_path updates)
    pathRef.current = JSON.parse(JSON.stringify(bestPath));
    setRunning(true);
    setInfo("running");

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (!pathRef.current?.poses?.length) {
        setInfo("path finished");
        setRunning(false);
        clearInterval(timerRef.current);
        timerRef.current = null;
        stopRobot();
        return;
      }
      if (inFlightRef.current) return; // prevent piling up service calls
      inFlightRef.current = true;

      getSetpointSrv.callService(
        { path: pathRef.current },
        (resp) => {
          try {
            pathRef.current = resp.new_path;

            const sp = resp.setpoint;
            const srcFrame = (sp?.header?.frame_id || "").replace(/^\//, "");
            if (!srcFrame) {
              setInfo("Setpoint frame_id empty");
              stopRobot();
              return;
            }

            // TF: transform setpoint point into base_link
            const T = tfStore.lookup(srcFrame, robotFrame);
            const pBL = transformPoint(T, sp.point);

            // compute Twist (same as your controller logic)
            const x = pBL.x;
            const y = pBL.y;
            const dist = Math.hypot(x, y);
            const ang = Math.atan2(y, x);

            let v = 0, w = 0;
            if (dist >= goalTol) {
              w = kAng * ang;
              v = kLin * dist;

              // burger: no reverse
              v = Math.max(0, v);

              v = clamp(v, -maxV, maxV);
              w = clamp(w, -maxW, maxW);

              // turning hard => stop forward
              if (Math.abs(w) >= 0.6) v = 0;
            }

            cmdVel.publish({
              linear: { x: v, y: 0, z: 0 },
              angular: { x: 0, y: 0, z: w },
            });

            setInfo(`running | poses=${pathRef.current?.poses?.length ?? 0} | v=${v.toFixed(2)} w=${w.toFixed(2)}`);
          } catch (e) {
            setInfo(`Error: ${String(e)}`);
            stopRobot();
          } finally {
            inFlightRef.current = false;
          }
        },
        (err) => {
          setInfo(`get_setpoint failed: ${String(err)}`);
          stopRobot();
          inFlightRef.current = false;
        }
      );
    }, 100); // 10 Hz
  };

  const stop = () => {
    setRunning(false);
    setInfo("stopped");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    inFlightRef.current = false;
    stopRobot();
  };

  return (
    <div style={card}>
      <h3 style={h3}>Path follower (web controller)</h3>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={btn} onClick={start} disabled={running}>
          Follow /best_branch
        </button>
        <button style={dangerBtn} onClick={stop} disabled={!running}>
          Stop following
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 13 }}>
        Status: <b>{info}</b>
      </div>

      <div style={grid2}>
        <label style={label}>
          robot_frame_id
          <input value={robotFrame} onChange={(e) => setRobotFrame(e.target.value)} style={input} />
        </label>
        <label style={label}>
          max linear (m/s)
          <input type="number" step="0.05" value={maxV} onChange={(e) => setMaxV(Number(e.target.value))} style={input} />
        </label>
        <label style={label}>
          max angular (rad/s)
          <input type="number" step="0.05" value={maxW} onChange={(e) => setMaxW(Number(e.target.value))} style={input} />
        </label>
        <label style={label}>
          k_lin
          <input type="number" step="0.05" value={kLin} onChange={(e) => setKLin(Number(e.target.value))} style={input} />
        </label>
        <label style={label}>
          k_ang
          <input type="number" step="0.05" value={kAng} onChange={(e) => setKAng(Number(e.target.value))} style={input} />
        </label>
        <label style={label}>
          goal tolerance (m)
          <input type="number" step="0.01" value={goalTol} onChange={(e) => setGoalTol(Number(e.target.value))} style={input} />
        </label>
      </div>

      <p style={hint}>
        This calls <code>/get_setpoint</code> at 10 Hz, transforms setpoints using <code>/tf</code>, and publishes{" "}
        <code>/cmd_vel</code>. Stop your ROS <code>controller.py</code> while using this to avoid conflicts.
      </p>
    </div>
  );
}

const card = { padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h3 = { margin: "0 0 8px 0" };
const btn = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" };
const dangerBtn = { ...btn, border: "1px solid #d55", background: "#fff5f5" };
const hint = { marginTop: 10, color: "#555", fontSize: 13 };
const grid2 = { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const label = { fontSize: 12, color: "#555", display: "flex", flexDirection: "column", gap: 4 };
const input = { padding: 6, borderRadius: 8, border: "1px solid #ccc" };
