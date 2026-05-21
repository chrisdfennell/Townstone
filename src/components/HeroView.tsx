import type { Hero, PlayerId } from "../engine";

interface Props {
  hero: Hero;
  player: PlayerId;
  name: string;
  mana: number;
  maxMana: number;
  deckCount: number;
  handCount: number;
  targetable: boolean;
  onClick: () => void;
}

export function HeroView({
  hero,
  player,
  name,
  mana,
  maxMana,
  deckCount,
  handCount,
  targetable,
  onClick,
}: Props) {
  const classes = ["hero", `hero--${player}`];
  if (targetable) classes.push("hero--targetable");

  return (
    <div className="hero-row">
      <button type="button" className={classes.join(" ")} onClick={onClick} title={`${name}`}>
        <span className="hero__portrait" aria-hidden>
          {player === "ai" ? "☠" : "⚔"}
        </span>
        <span className="hero__name">{name}</span>
        <span className="hero__health" title="Health">
          ♥ {hero.health}
          {hero.armor > 0 && <span className="hero__armor">🛡 {hero.armor}</span>}
        </span>
      </button>
      <div className="hero__meta">
        <span className="mana" title="Mana">
          {"◆".repeat(mana)}
          {"◇".repeat(Math.max(0, maxMana - mana))}
          <span className="mana__count">
            {mana}/{maxMana}
          </span>
        </span>
        <span className="counts">
          <span title="Cards in hand">✋ {handCount}</span>
          <span title="Cards in deck">🂠 {deckCount}</span>
        </span>
      </div>
    </div>
  );
}
