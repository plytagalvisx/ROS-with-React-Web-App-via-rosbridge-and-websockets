import { useEffect, useMemo, useState } from "react";
import { createRos } from "./ros";

export function useRosConnection(url) {
  const [status, setStatus] = useState("disconnected"); // disconnected|connected|error|closed
  const [error, setError] = useState(null);

  const ros = useMemo(() => createRos(url), [url]);

  useEffect(() => {
    const onConnection = () => {
      setStatus("connected");
      setError(null);
    };
    const onError = (e) => {
      setStatus("error");
      setError(e);
    };
    const onClose = () => setStatus("closed");

    ros.on("connection", onConnection);
    ros.on("error", onError);
    ros.on("close", onClose);

    // If url changes/unmount
    return () => {
      try {
        ros.removeListener("connection", onConnection);
        ros.removeListener("error", onError);
        ros.removeListener("close", onClose);
      } catch { /* empty */ }
      try {
        ros.close();
      } catch { /* empty */ }
    };
  }, [ros]);

  return { ros, status, error };
}
