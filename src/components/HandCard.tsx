import type { CardInstance } from "../engine";
import { getCardDef } from "../engine";
import { CardTip } from "./CardTip";

interface Props {
  card: CardInstance;
  playable: boolean;
  selected: boolean;
  onClick: () => void;
}

const CLASS_GLYPH: Record<string, string> = {
  barbarian: "⚔",
  sorceress: "✦",
  necromancer: "☠",
  demonhunter: "◈",
  rogue: "🗡",
  paladin: "✚",
  druid: "❀",
  neutral: "◆",
};

export function HandCard({ card, playable, selected, onClick }: Props) {
  const def = getCardDef(card.defId);
  const classes = ["card", `card--${def.type}`];
  if (playable) classes.push("card--playable");
  if (selected) classes.push("card--selected");
  if (def.legendary) classes.push("card--legendary");

  return (
    <button
      type="button"
      className={classes.join(" ")}
      onClick={onClick}
      data-anchor={`hand:${card.instanceId}`}
    >
      <span className="card__cost">{def.cost}</span>
      <span className="card__class" aria-hidden>
        {CLASS_GLYPH[def.className] ?? "◆"}
      </span>
      {def.legendary && <span className="card__gem" aria-hidden>★</span>}
      <span className="card__name">{def.name}</span>
      <span className="card__text">{def.text || (def.type === "minion" ? "" : "")}</span>
      {def.type === "minion" && (
        <span className="card__stats">
          <span className="stat stat--attack">{def.attack}</span>
          <span className="stat stat--health">{def.health}</span>
        </span>
      )}
      {def.type === "spell" && <span className="card__type-badge">Spell</span>}
      <CardTip name={def.name} text={def.text} flavor={def.flavor} keywords={def.keywords ?? []} spellDamage={def.spellDamage} />
    </button>
  );
}
