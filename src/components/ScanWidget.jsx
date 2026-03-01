export default function ScanWidget({ scan }) {
  const min = (() => {
    if (!scan?.ranges?.length) return null;
    let m = Infinity;
    for (const r of scan.ranges) {
      if (Number.isFinite(r) && r > 0) m = Math.min(m, r);
    }
    return Number.isFinite(m) ? m : null;
  })();

  return (
    <div style={card}>
      <h3 style={h3}>LaserScan</h3>
      <div style={{ fontSize: 14 }}>
        Closest obstacle:{" "}
        <b>{min === null ? "N/A" : `${min.toFixed(2)} m`}</b>
      </div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        Topic: <code>/scan</code>
      </div>
    </div>
  );
}

const card = { padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h3 = { margin: "0 0 8px 0" };
