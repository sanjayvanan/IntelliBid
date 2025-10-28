import { useEffect, useMemo, useState } from "react";

const CountDownTimer = ({ endTime, onComplete }) => {
  const targetMs = useMemo(() => {
    const t = new Date(endTime).getTime();
    return Number.isFinite(t) ? t : NaN;
  }, [endTime]);

  const [remaining, setRemaining] = useState(() =>
    Number.isFinite(targetMs) ? Math.max(0, targetMs - Date.now()) : NaN
  );

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return;

    // set immediately in case endTime changed
    setRemaining(Math.max(0, targetMs - Date.now()));

    const id = setInterval(() => {
      const next = Math.max(0, targetMs - Date.now());
      setRemaining(next);
      if (next === 0) {
        clearInterval(id);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [targetMs, onComplete]);

  if (!Number.isFinite(targetMs)) return <div>Invalid date</div>;

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / (24 * 3600));
  const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div>
      {days > 0 && <span>{days}d </span>}
      <span>{pad(hours)}:{pad(minutes)}:{pad(seconds)}</span>
    </div>
  );
};

export default CountDownTimer;
