import { useEffect, useMemo, useRef, useState } from "react";
// import * as ROSLIB from "roslib";
import { makeTopic } from "../ros";


// We’ll implement a deadman + repeat publish so the robot doesn’t keep driving if a key-up event is missed.
export default function TeleopWASD({ ros }) {
  const cmdVel = useMemo(() => makeTopic(ros, "/cmd_vel", "geometry_msgs/Twist"), [ros]);

  const [enabled, setEnabled] = useState(false);
  const [lin, setLin] = useState(0.25);   // m/s
  const [ang, setAng] = useState(0.9);    // rad/s

  // Track which keys are currently held down
  const keysDownRef = useRef(new Set());

  // Publish at a steady rate while enabled (deadman style)
  useEffect(() => {
    if (!enabled) return;

    const publish = () => {
      const keys = keysDownRef.current;

      // Compute desired velocity from keys held
      let v = 0;
      let w = 0;

      if (keys.has("w")) v += lin;
      if (keys.has("s")) v -= lin;     // reverse (optional)
      if (keys.has("a")) w += ang;
      if (keys.has("d")) w -= ang;

      // If no keys, publish stop (keeps robot safe)
    //   const msg = new ROSLIB.Message({
    //     linear: { x: v, y: 0, z: 0 },
    //     angular: { x: 0, y: 0, z: w },
    //   });
    //   cmdVel.publish(msg);

      cmdVel.publish({ // roslib already serializes the object to JSON (and wraps it into a ROS bridge message, and sends it over WebSocket), so we can just pass a plain object here
        linear: { x: v, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: w },
      });
    };

    // 10 Hz publish loop
    const id = setInterval(publish, 100);

    return () => clearInterval(id);
  }, [enabled, lin, ang, cmdVel]);

  // Keyboard handlers
  useEffect(() => {
    if (!enabled) return;

    const down = (e) => {
      console.log("keydown", e.key);  
      const k = e.key.toLowerCase();

      // Avoid typing into inputs triggering motion
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (k === "w" || k === "a" || k === "s" || k === "d") {
        e.preventDefault(); // prevent scrolling with space, etc.
        keysDownRef.current.add(k);
      }

      // Space = immediate stop
      if (k === " ") {
        e.preventDefault();
        keysDownRef.current.clear();
        cmdVel.publish({
          linear: { x: 0, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: 0 },
        });
        // cmdVel.publish(
        //   new ROSLIB.Message({
        //     linear: { x: 0, y: 0, z: 0 },
        //     angular: { x: 0, y: 0, z: 0 },
        //   })
        // );
      }
    };

    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "a" || k === "s" || k === "d") {
        e.preventDefault();
        keysDownRef.current.delete(k);
      }
    };

    // Safety: stop if window loses focus
    const blur = () => {
      keysDownRef.current.clear();
      cmdVel.publish({
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      });
    //   cmdVel.publish(
    //     new ROSLIB.Message({
    //       linear: { x: 0, y: 0, z: 0 },
    //       angular: { x: 0, y: 0, z: 0 },
    //     })
    //   );
    };

    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    window.addEventListener("blur", blur);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      // stop on disable/unmount
      blur();
    };
  }, [enabled, cmdVel]);

  return (
    <div style={card}>
      <h3 style={h3}>Teleop (WASD)</h3>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            keysDownRef.current.clear();
          }}
        />
        Enable keyboard control (W/A/S/D). Space = stop.
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <div>
          <div style={label}>Linear speed (m/s): <b>{lin.toFixed(2)}</b></div>
          <input
            type="range"
            min="0"
            max="2.0"
            step="0.01"
            value={lin}
            onChange={(e) => setLin(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <div style={label}>Angular speed (rad/s): <b>{ang.toFixed(2)}</b></div>
          <input
            type="range"
            min="0"
            max="2.0"
            step="0.01"
            value={ang}
            onChange={(e) => setAng(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, color: "#555" }}>
        <div><b>W</b>: forward</div>
        <div><b>S</b>: backward (optional)</div>
        <div><b>A</b>: turn left</div>
        <div><b>D</b>: turn right</div>
        <div><b>Space</b>: stop immediately</div>
      </div>

      <p style={hint}>
        If the robot doesn’t respond, check that nothing else is publishing <code>/cmd_vel</code> (e.g. your controller).
      </p>
    </div>
  );
}

const card = { padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h3 = { margin: "0 0 8px 0" };
const label = { fontSize: 13, color: "#555", marginBottom: 6 };
const hint = { marginTop: 10, color: "#555", fontSize: 13 };
