import { useState } from "react";
import { isMuted, setMuted, unlockAudio } from "../audio/sfx";

/** Toggles all sound on/off (persisted), and unlocks audio on first use. */
export function MuteButton({ className = "btn btn--ghost" }: { className?: string }) {
  const [muted, setMutedState] = useState(isMuted());
  return (
    <button
      type="button"
      className={className}
      title={muted ? "Unmute" : "Mute"}
      onClick={(e) => {
        e.stopPropagation();
        unlockAudio();
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
