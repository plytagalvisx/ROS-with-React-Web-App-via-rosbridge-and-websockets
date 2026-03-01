import { useEffect, useMemo, useRef, useState } from "react";
import * as ROSLIB from "roslib";
import { makeActionClient } from "../ros";

export default function ExplorerPanel({ ros, onFeedbackPath }) {
  const [running, setRunning] = useState(false);
  const [gain, setGain] = useState(0);
  const [lastResult, setLastResult] = useState(null);

  const actionClient = useMemo(
    () => makeActionClient(ros, "/get_next_goal", "irob_assignment_1/GetNextGoalAction"),
    [ros]
  );

  const goalRef = useRef(null);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      try {
        goalRef.current?.cancel();
      } catch { /* empty */ }
    };
  }, []);

  const start = () => {
    // Empty goal
    const goal = new ROSLIB.Goal({
      actionClient,
      goalMessage: {}, // empty
    });

    goalRef.current = goal;
    setRunning(true);
    setLastResult(null);
    setGain(0);

    goal.on("feedback", (fb) => {
      if (typeof fb?.gain === "number") setGain(fb.gain);
      if (fb?.path && onFeedbackPath) onFeedbackPath(fb.path);
    });

    goal.on("result", (res) => {
      setRunning(false);
      setLastResult(res);
      if (typeof res?.gain === "number") setGain(res.gain);
      if (res?.path && onFeedbackPath) onFeedbackPath(res.path);
    });

    goal.on("status", () => {
      // optional: you can inspect status codes here
    });

    goal.send();
  };

  const cancel = () => {
    try {
      goalRef.current?.cancel();
    } catch { /* empty */  }
    setRunning(false);
  };

  return (
    <div style={card}>
      <h3 style={h3}>Exploration (get_next_goal action)</h3>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn} onClick={start} disabled={running}>
          Start exploration
        </button>
        <button style={dangerBtn} onClick={cancel} disabled={!running}>
          Cancel
        </button>
        <div style={{ marginLeft: 8 }}>
          <div style={{ fontSize: 13, color: "#555" }}>Live gain</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{gain.toFixed(3)}</div>
        </div>
      </div>

      {lastResult && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <b>Last result:</b> gain={Number(lastResult.gain).toFixed(3)} poses={lastResult.path?.poses?.length ?? 0}
        </div>
      )}

      <p style={hint}>
        Your explorer publishes the best-so-far path on <code>/best_branch</code> as well. The UI can overlay either the
        feedback path or <code>/best_branch</code>.
      </p>
    </div>
  );
}

const card = { padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h3 = { margin: "0 0 8px 0" };
const btn = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" };
const dangerBtn = { ...btn, border: "1px solid #d55", background: "#fff5f5" };
const hint = { marginTop: 10, color: "#555", fontSize: 13 };
