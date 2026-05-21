import type { Minion } from "../engine";
import { getCardDef } from "../engine";
import { FloatingNumber, type HealthDelta } from "./FloatingNumber";
import { CardTip } from "./CardTip";

interface Props {
  minion: Minion;
  canAttack: boolean;
  selected: boolean;
  targetable: boolean;
  delta?: HealthDelta;
  onClick: () => void;
}

const KEYWORD_BADGES: Array<[Minion["keywords"][number], string, string]> = [
  ["taunt", "kw--taunt", "Taunt"],
  ["charge", "kw--charge", "Charge"],
  ["windfury", "kw--windfury", "Windfury"],
  ["lifesteal", "kw--lifesteal", "Lifesteal"],
  ["poisonous", "kw--poison", "Poison"],
];

export function MinionView({ minion, canAttack, selected, targetable, delta, onClick }: Props) {
  const classes = ["minion"];
  if (canAttack) classes.push("minion--ready");
  if (selected) classes.push("minion--selected");
  if (targetable) classes.push("minion--targetable");
  if (minion.divineShield) classes.push("minion--shield");
  if (minion.frozen) classes.push("minion--frozen");

  const damaged = minion.health < minion.maxHealth;
  const def = getCardDef(minion.defId);

  return (
    <button
      type="button"
      className={classes.join(" ")}
      onClick={onClick}
      data-anchor={`minion:${minion.instanceId}`}
    >
      {minion.spellDamage > 0 && <span className="minion__spelldmg" title="Spell Damage">✦+{minion.spellDamage}</span>}
      <span className="minion__name">{minion.name}</span>
      <span className="minion__keywords">
        {KEYWORD_BADGES.filter(([kw]) => minion.keywords.includes(kw)).map(([kw, cls, label]) => (
          <span key={kw} className={"kw " + cls}>
            {label}
          </span>
        ))}
      </span>
      <span className="minion__stats">
        <span className="stat stat--attack">{minion.attack}</span>
        <span className={"stat stat--health" + (damaged ? " stat--damaged" : "")}>{minion.health}</span>
      </span>
      {minion.frozen && <span className="minion__ice" aria-hidden />}
      <FloatingNumber delta={delta} />
      <CardTip name={def.name} text={def.text} flavor={def.flavor} keywords={minion.keywords} spellDamage={minion.spellDamage} />
    </button>
  );
}
