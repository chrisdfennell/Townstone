import type { Keyword } from "../engine";
import { KEYWORD_GLOSSARY, KEYWORD_LABEL } from "../game/glossary";

/**
 * Hover detail shown over a card or board minion. Rendered as a child element
 * that CSS reveals on `:hover` of the parent, so no JS positioning is needed.
 */
export function CardTip({
  name,
  text,
  flavor,
  keywords,
  spellDamage,
}: {
  name: string;
  text?: string;
  flavor?: string;
  keywords: Keyword[];
  spellDamage?: number;
}) {
  return (
    <span className="tip" role="tooltip">
      <span className="tip__name">{name}</span>
      {text ? <span className="tip__text">{text}</span> : null}
      {keywords.map((kw) => (
        <span key={kw} className="tip__kw">
          <b>{KEYWORD_LABEL[kw]}:</b> {KEYWORD_GLOSSARY[kw]}
        </span>
      ))}
      {spellDamage ? (
        <span className="tip__kw">
          <b>Spell Damage +{spellDamage}:</b> Your spells deal {spellDamage} extra damage.
        </span>
      ) : null}
      {flavor ? <span className="tip__flavor">{flavor}</span> : null}
    </span>
  );
}
