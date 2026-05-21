import { useEffect, useState } from "react";

/**
 * A Hearthstone-style aiming arrow drawn from a source element (the selected
 * attacker, hand card, or hero power) to the cursor. Purely cosmetic and
 * click-through (pointer-events: none).
 */
export function TargetingArrow({ anchorSelector }: { anchorSelector: string }) {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const el = typeof document !== "undefined" ? document.querySelector(anchorSelector) : null;
  if (!el || !mouse) return null;

  const r = el.getBoundingClientRect();
  const x1 = r.left + r.width / 2;
  const y1 = r.top + r.height / 2;
  const { x: x2, y: y2 } = mouse;

  // Gentle upward bow on the curve.
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - 50;

  // Arrowhead oriented along the tangent at the cursor end.
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const size = 18;
  const head = [
    [x2, y2],
    [x2 + size * Math.cos(angle + Math.PI - 0.45), y2 + size * Math.sin(angle + Math.PI - 0.45)],
    [x2 + size * Math.cos(angle + Math.PI + 0.45), y2 + size * Math.sin(angle + Math.PI + 0.45)],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  return (
    <svg className="aim-arrow" width="100%" height="100%" aria-hidden>
      <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} className="aim-arrow__line" fill="none" />
      <circle cx={x1} cy={y1} r={7} className="aim-arrow__base" />
      <polygon points={head} className="aim-arrow__head" />
    </svg>
  );
}
