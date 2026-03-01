import { useMemo } from "react";
// import * as ROSLIB from "roslib";
import { makeTopic } from "../ros";

export default function Controls({ ros }) {
  const cmdVel = useMemo(() => makeTopic(ros, "/cmd_vel", "geometry_msgs/Twist"), [ros]);
  const syscmd = useMemo(() => makeTopic(ros, "/syscommand", "std_msgs/String"), [ros]);

  const estop = () => {
    cmdVel.publish({ linear:{x:0,y:0,z:0}, angular:{x:0,y:0,z:0} });
    // cmdVel.publish(
    //   new ROSLIB.Message({
    //     linear: { x: 0, y: 0, z: 0 },
    //     angular: { x: 0, y: 0, z: 0 },
    //   })
    // );
  };

  const resetSlam = () => {
    syscmd.publish({ data: "reset" });
    // syscmd.publish(new ROSLIB.Message({ data: "reset" }));
  };

  return (
    <div style={card}>
      <h3 style={h3}>Controls</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={dangerBtn} onClick={estop}>
          E-STOP (publish zero /cmd_vel)
        </button>
        <button style={btn} onClick={resetSlam}>
          Reset SLAM (/syscommand = "reset")
        </button>
      </div>
      <p style={hint}>
        Tip: if your <code>controller.py</code> is running, it also publishes <code>/cmd_vel</code>.
        For manual teleop, stop the controller first to avoid “fighting”.
      </p>
    </div>
  );
}

const card = { padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h3 = { margin: "0 0 8px 0" };
const btn = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" };
const dangerBtn = { ...btn, border: "1px solid #d55", background: "#fff5f5" };
const hint = { marginTop: 10, color: "#555", fontSize: 13 };
