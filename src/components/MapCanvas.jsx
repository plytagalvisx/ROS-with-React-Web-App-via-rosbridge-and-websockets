import { useEffect, useMemo, useRef } from "react";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function yawFromQuat(q) {
  // yaw from quaternion
  const { x, y, z, w } = q;
  const siny = 2 * (w * z + x * y);
  const cosy = 1 - 2 * (y * y + z * z);
  return Math.atan2(siny, cosy);
}

export default function MapCanvas({ mapMsg, bestPath, controlPoint, odom }) {
  const canvasRef = useRef(null);

  const mapMeta = useMemo(() => {
    if (!mapMsg?.info) return null;
    return {
      w: mapMsg.info.width,
      h: mapMsg.info.height,
      res: mapMsg.info.resolution,
      ox: mapMsg.info.origin.position.x,
      oy: mapMsg.info.origin.position.y,
      frame: mapMsg.header?.frame_id || "map",
    };
  }, [mapMsg]);

  // Convert world -> map pixel
  const worldToPx = (x, y) => {
    if (!mapMeta) return { px: 0, py: 0 };
    const px = (x - mapMeta.ox) / mapMeta.res;
    const py = (y - mapMeta.oy) / mapMeta.res;
    return { px, py };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapMsg || !mapMeta) return;

    const ctx = canvas.getContext("2d");
    const { w, h } = mapMeta;

    // Fit canvas to map (cap max to keep it responsive)
    const maxSide = 700;
    const scale = Math.min(maxSide / w, maxSide / h, 2.0);
    canvas.width = Math.max(1, Math.floor(w * scale));
    canvas.height = Math.max(1, Math.floor(h * scale));

    // Draw occupancy grid into ImageData at native map resolution, then scale
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = mapMsg.data[i]; // -1 unknown, 0 free, 100 occ
      let c;
      if (v === -1) c = 200; // unknown = light gray
      else c = 255 - Math.round(clamp01(v / 100) * 255); // occupied darker
      img.data[i * 4 + 0] = c;
      img.data[i * 4 + 1] = c;
      img.data[i * 4 + 2] = c;
      img.data[i * 4 + 3] = 255;
    }

    // Put at 1:1 then scale with nearest-neighbor
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const offCtx = off.getContext("2d");
    offCtx.putImageData(img, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Flip Y while drawing the map
    ctx.save();
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

    // Helper: map pixel (origin bottom-left) -> canvas coords
    const mapPxToCanvas = (px, py) => {
      // OccupancyGrid data is row-major starting at (0,0) = map origin.
      // Canvas origin is top-left, so we flip Y.
      const cx = px * scale;
      const cy = (h - py) * scale;
    //   const cy = py * scale;
      return { cx, cy };
    };

    // Draw best path
    if (bestPath?.poses?.length > 0) { // question marks are used for optional chaining to avoid errors if bestPath or poses is undefined
      ctx.strokeStyle = "blue"; // path color

      ctx.lineWidth = 2;
      ctx.beginPath();

      bestPath.poses.forEach((p, idx) => {
        const x = p.pose.position.x;
        const y = p.pose.position.y;
        const { px, py } = worldToPx(x, y);
        const { cx, cy } = mapPxToCanvas(px, py);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      
      ctx.stroke();
    }

    // Draw collision-free control point
    if (controlPoint?.point) {
      const x = controlPoint.point.x;
      const y = controlPoint.point.y;
      const { px, py } = worldToPx(x, y);
      const { cx, cy } = mapPxToCanvas(px, py);

      ctx.fillStyle = "yellow"; // setpoint color
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
     
      ctx.stroke();  // black outline so it's visible on white areas
    }

    // Draw robot pose from odom if frame aligns with map reasonably
    if (odom?.pose?.pose?.position) {
      const x = odom.pose.pose.position.x;
      const y = odom.pose.pose.position.y;
      const q = odom.pose.pose.orientation;
      const yaw = q ? yawFromQuat(q) : 0; // for robot orientation triangle on the map

      const { px, py } = worldToPx(x, y); // convert to map pixels
      const { cx, cy } = mapPxToCanvas(px, py); // convert to canvas coords

      // triangle
      const r = 10; // robot size in pixels (adjust as needed)
      ctx.fillStyle = "red"; // robot color
      ctx.beginPath();
      ctx.moveTo(cx + r * Math.cos(-yaw), cy + r * Math.sin(-yaw));
      ctx.lineTo(cx + r * Math.cos(-yaw + 2.6), cy + r * Math.sin(-yaw + 2.6));
      ctx.lineTo(cx + r * Math.cos(-yaw - 2.6), cy + r * Math.sin(-yaw - 2.6));
      ctx.closePath();
      ctx.fill();
    }
  }, [mapMsg, mapMeta, bestPath, controlPoint, odom]);

  return (
    <div style={card}>
      <h3 style={h3}>Map ( /map ) + overlays</h3>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        Overlays: <code>/best_branch</code> path, <code>/collision_free_control_point</code>, <code>/odom</code>.
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", borderRadius: 10, border: "1px solid #eee" }} />
    </div>
  );
}

const card = { padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h3 = { margin: "0 0 8px 0" };
