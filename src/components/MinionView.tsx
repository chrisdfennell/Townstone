import type { Minion } from "../engine";

interface Props {
  minion: Minion;
  canAttack: boolean;
  selected: boolean;
  targetable: boolean;
  onClick: () => void;
}

export function MinionView({ minion, canAttack, selected, targetable, onClick }: Props) {
  const classes = ["minion"];
  if (canAttack) classes.push("minion--ready");
  if (selected) classes.push("minion--selected");
  if (targetable) classes.push("minion--targetable");
  if (minion.divineShield) classes.push("minion--shield");

  const damaged = minion.health < minion.maxHealth;

  return (
    <button type="button" className={classes.join(" ")} onClick={onClick} title={minion.name}>
      <span className="minion__name">{minion.name}</span>
      <span className="minion__keywords">
        {minion.keywords.includes("taunt") && <span className="kw kw--taunt">Taunt</span>}
        {minion.keywords.includes("charge") && <span className="kw kw--charge">Charge</span>}
      </span>
      <span className="minion__stats">
        <span className="stat stat--attack">{minion.attack}</span>
        <span className={"stat stat--health" + (damaged ? " stat--damaged" : "")}>
          {minion.health}
        </span>
      </span>
    </button>
  );
}
