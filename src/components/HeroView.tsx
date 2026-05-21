import type { Hero, PlayerId } from "../engine";
import { FloatingNumber, type HealthDelta } from "./FloatingNumber";

interface Props {
  hero: Hero;
  player: PlayerId;
  name: string;
  mana: number;
  maxMana: number;
  deckCount: number;
  handCount: number;
  targetable: boolean;
  delta?: HealthDelta;
  /** Player-only: hero power interactivity. */
  canUsePower?: boolean;
  powerSelected?: boolean;
  onUsePower?: () => void;
  onClick: () => void;
}

const POWER_GLYPH: Record<string, string> = {
  hp_warcry: "🛡",
  hp_fireblast: "✦",
  hp_raise: "☠",
  hp_chaosstrike: "◈",
  hp_envenom: "🗡",
  hp_reinforce: "✚",
  hp_markwild: "❀",
};

export function HeroView({
  hero,
  player,
  name,
  mana,
  maxMana,
  deckCount,
  handCount,
  targetable,
  delta,
  canUsePower,
  powerSelected,
  onUsePower,
  onClick,
}: Props) {
  const classes = ["hero", `hero--${player}`];
  if (targetable) classes.push("hero--targetable");

  const powerClasses = ["heropower"];
  if (canUsePower) powerClasses.push("heropower--ready");
  if (powerSelected) powerClasses.push("heropower--selected");
  if (hero.powerUsedThisTurn) powerClasses.push("heropower--used");

  return (
    <div className="hero-row">
      <button type="button" className={classes.join(" ")} onClick={onClick} title={name}>
        <span className="hero__portrait" aria-hidden>
          {player === "ai" ? "☠" : "⚔"}
        </span>
        <span className="hero__name">{name}</span>
        <span className="hero__health" title="Health">
          ♥ {hero.health}
          {hero.armor > 0 && <span className="hero__armor">🛡 {hero.armor}</span>}
        </span>
        <FloatingNumber delta={delta} />
      </button>

      <button
        type="button"
        className={powerClasses.join(" ")}
        title={`${hero.power.name} (${hero.power.cost}) — ${hero.power.text}`}
        data-anchor={player === "player" ? "heropower-self" : undefined}
        disabled={player === "ai" || !onUsePower}
        onClick={(e) => {
          e.stopPropagation();
          onUsePower?.();
        }}
      >
        <span className="heropower__glyph" aria-hidden>
          {POWER_GLYPH[hero.power.id] ?? "✦"}
        </span>
        <span className="heropower__cost">{hero.power.cost}</span>
      </button>

      <div className="hero__meta">
        <span className="mana" title="Mana">
          {"◆".repeat(Math.max(0, mana))}
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
