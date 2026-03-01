import { useEffect, useState } from "react";
import { makeTopic } from "./ros";

export function useTopicLatest(ros, name, messageType) {
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!ros) return;
    const topic = makeTopic(ros, name, messageType);
    topic.subscribe((m) => setMsg(m));

    return () => {
      try {
        topic.unsubscribe();
      } catch { /* empty */ }
    };
  }, [ros, name, messageType]);

  return msg;
}
