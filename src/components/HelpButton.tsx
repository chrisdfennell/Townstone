import { useState } from "react";
import type { Keyword } from "../engine";
import { HOW_TO_PLAY, KEYWORD_GLOSSARY, KEYWORD_LABEL } from "../game/glossary";

const KEYWORDS: Keyword[] = ["taunt", "charge", "divineShield", "lifesteal", "poisonous", "windfury"];

/** A "?" button that opens a how-to-play + keyword reference panel. */
export function HelpButton({ className = "btn btn--ghost" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={(e) => { e.stopPropagation(); setOpen(true); }} title="How to play">
        ?
      </button>
      {open && (
        <div className="overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="help" onClick={(e) => e.stopPropagation()}>
            <h2>How to Play</h2>
            <ol className="help__list">
              {HOW_TO_PLAY.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            <h3>Keywords</h3>
            <ul className="help__kw">
              {KEYWORDS.map((kw) => (
                <li key={kw}>
                  <b>{KEYWORD_LABEL[kw]}</b> — {KEYWORD_GLOSSARY[kw]}
                </li>
              ))}
              <li>
                <b>Spell Damage +N</b> — Your spells deal N extra damage while this minion is in play.
              </li>
            </ul>
            <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
