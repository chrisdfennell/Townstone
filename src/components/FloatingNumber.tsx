export interface HealthDelta {
  /** Negative for damage, positive for healing. */
  delta: number;
  /** Changes every time so the animation replays. */
  nonce: number;
}

/** A short-lived floating "-3" / "+6" that animates up over its parent. */
export function FloatingNumber({ delta }: { delta?: HealthDelta }) {
  if (!delta || delta.delta === 0) return null;
  const positive = delta.delta > 0;
  return (
    <span
      key={delta.nonce}
      className={"floatnum " + (positive ? "floatnum--heal" : "floatnum--dmg")}
      aria-hidden
    >
      {positive ? `+${delta.delta}` : delta.delta}
    </span>
  );
}
