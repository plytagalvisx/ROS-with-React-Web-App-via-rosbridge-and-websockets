import { useMemo, useState } from "react";
import { useRosConnection } from "./useRos";
import { useTopicLatest } from "./useTopic";
import { useTfStore } from "./useTf";

import Controls from "./components/Controls";
import ExplorerPanel from "./components/ExplorerPanel";
import ScanWidget from "./components/ScanWidget";
import MapCanvas from "./components/MapCanvas";
import TeleopWASD from "./components/TeleopWASD";
import PathFollower from "./components/PathFollower";
import ExploreAndFollow from "./components/ExploreAndFollow";

export default function App() {
  // Change this to your VM IP / rosbridge
  const rosbridgeUrl = "ws://192.168.64.13:9090";

  const { ros, status, error } = useRosConnection(rosbridgeUrl);

  // Topics
  const bestBranch = useTopicLatest(ros, "/best_branch", "nav_msgs/Path");
  const scan = useTopicLatest(ros, "/scan", "sensor_msgs/LaserScan");
  const mapMsg = useTopicLatest(ros, "/map", "nav_msgs/OccupancyGrid");
  const controlPoint = useTopicLatest(ros, "/collision_free_control_point", "geometry_msgs/PointStamped");
  const odom = useTopicLatest(ros, "/odom", "nav_msgs/Odometry");
  const tfStore = useTfStore(ros);

  // We’ll prefer action feedback path while exploring, otherwise show /best_branch
  const [feedbackPath, setFeedbackPath] = useState(null);

  const pathToDisplay = useMemo(() => {
    if (feedbackPath?.poses?.length) return feedbackPath;
    return bestBranch;
  }, [feedbackPath, bestBranch]);

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 1600, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Burger Web Console (rosbridge + roslibjs + React)</h1>

      <div style={{ marginBottom: 12, padding: 10, borderRadius: 12, border: "1px solid #ddd" }}>
        <b>ROS:</b>{" "}
        <span>
          {status}
          {status === "error" && error ? ` (${String(error)})` : ""}
        </span>
        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          WebSocket: <code>{rosbridgeUrl}</code>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 12, alignItems: "start" }}>
        <MapCanvas mapMsg={mapMsg} bestPath={pathToDisplay} controlPoint={controlPoint} odom={odom} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Controls ros={ros} />
          <ExploreAndFollow ros={ros} tfStore={tfStore} />
          <TeleopWASD ros={ros} />
          {/* <PathFollower ros={ros} tfStore={tfStore} bestPath={bestBranch} /> */}
          {/* <ExplorerPanel ros={ros} onFeedbackPath={setFeedbackPath} /> */}
          <ScanWidget scan={scan} />

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
            <h3 style={{ margin: "0 0 8px 0" }}>Debug</h3>
            <div style={{ fontSize: 13 }}>
              <div>
                <code>/best_branch</code> poses: <b>{bestBranch?.poses?.length ?? 0}</b>
              </div>
              <div>
                <code>/collision_free_control_point</code>:{" "}
                <b>
                  {controlPoint?.point
                    ? `${controlPoint.point.x.toFixed(2)}, ${controlPoint.point.y.toFixed(2)}`
                    : "N/A"}
                </b>
              </div>
              <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
                Next: we can add <code>/tree</code> visualization (MarkerArray edges) and a teleop joystick.
              </div>
            </div>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: "#666" }}>
        If the map looks “off”: your <code>/odom</code> frame may not align with <code>/map</code> in a simple way. We can
        switch robot pose overlay to TF later (via <code>/tf</code>) for correctness.
      </p>
    </div>
  );
}


// import { useEffect, useState } from 'react'
// import * as ROSLIB from "roslib";
// import './App.css'

// function App() {
//   const [status, setStatus] = useState("N/A");
//   const [messages, setMessages] = useState([]);
  
//   useEffect(() => {
//     const ros = new ROSLIB.Ros({ url: "ws://192.168.64.13:9090" });

//     ros.on("connection", () => setStatus("successful"));
//     ros.on("error", (e) => setStatus(`errored out (${String(e)})`));
//     ros.on("close", () => setStatus("closed"));

//     const topic = new ROSLIB.Topic({
//       ros,
//       name: "/my_topic",
//       messageType: "std_msgs/String",
//     });

//     topic.subscribe((msg) => setMessages((prev) => [...prev, msg.data]));

//     return () => {
//       try { topic.unsubscribe(); } catch { /* empty */ }
//       try { ros.close(); } catch { /* empty */ }
//     };
//   }, []);

//   return (
//     <div style={{ fontFamily: "system-ui", padding: 16 }}>
//       <h1>Rosbridge demo</h1>
//       <p>Connection: <b>{status}</b></p>

//       <p><code>/my_topic</code> messages received:</p>
//       <ul style={{ fontWeight: "bold" }}>
//         {messages.map((m, i) => <li key={i}>{m}</li>)}
//       </ul>
//     </div>
//   );
// }

// export default App
