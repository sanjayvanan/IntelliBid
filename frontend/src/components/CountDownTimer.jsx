import { useEffect, useMemo, useState } from "react";

const CountDownTimer = ({ startTime, endTime, onComplete }) => {
  const now = Date.now();

  // Convert times
  const startMs = useMemo(() => startTime ? new Date(startTime).getTime() : null, [startTime]);
  const endMs   = useMemo(() => endTime ? new Date(endTime).getTime() : null, [endTime]);

  // Determine target (if start is in future, count to start; else to end)
  const targetMs = useMemo(() => {
    if (startMs && startMs > now) return startMs;
    return endMs;
  }, [startMs, endMs, now]);

  const mode = useMemo(() => {
    if (startMs && startMs > now) return "start";
    return "end";
  }, [startMs, now]);

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, targetMs - Date.now())
  );

  useEffect(() => {
    if (!targetMs) return;

    setRemaining(Math.max(0, targetMs - Date.now()));
    const id = setInterval(() => {
      const next = Math.max(0, targetMs - Date.now());
      setRemaining(next);

      if (next === 0) {
        clearInterval(id);
        onComplete?.(mode); // tells caller whether start or end completed
      }
    }, 1000);

    return () => clearInterval(id);
  }, [targetMs, onComplete, mode]);

  if (!targetMs) return <span>--</span>;

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div>
      <strong>{mode === "start" ? "Starts in: " : "Ends in: "}</strong>
      {days > 0 && <span>{days}d </span>}
      <span>{pad(hours)}:{pad(minutes)}:{pad(seconds)}</span>
    </div>
  );
};

export default CountDownTimer;
