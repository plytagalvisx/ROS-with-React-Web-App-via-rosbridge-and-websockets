import { useEffect, useMemo } from "react";
import { makeTopic } from "./ros";
import { makeTfStore } from "./tf";

export function useTfStore(ros) {
  const store = useMemo(() => makeTfStore(), []);

  useEffect(() => {
    if (!ros) return;

    const tfTopic = makeTopic(ros, "/tf", "tf2_msgs/TFMessage");
    const tfStaticTopic = makeTopic(ros, "/tf_static", "tf2_msgs/TFMessage");

    const handle = (msg) => {
      for (const tr of msg.transforms || []) {
        const parent = tr.header?.frame_id?.replace(/^\//, "");
        const child = tr.child_frame_id?.replace(/^\//, "");
        if (!parent || !child) continue;

        const t = tr.transform.translation;
        const q = tr.transform.rotation;
        store.setTransform(child, parent, { x: t.x, y: t.y, z: t.z }, { x: q.x, y: q.y, z: q.z, w: q.w });
      }
    };

    tfTopic.subscribe(handle);
    tfStaticTopic.subscribe(handle);

    return () => {
      try { tfTopic.unsubscribe(); } catch { /* empty */ }
      try { tfStaticTopic.unsubscribe(); } catch { /* empty */ }
    };
  }, [ros, store]);

  return store;
}
