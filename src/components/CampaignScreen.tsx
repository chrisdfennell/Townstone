import { useState } from "react";
import { PLAYABLE_CLASSES, CLASS_LABEL, getCardDef } from "../engine";
import type { HeroClass } from "../engine";
import { BOSSES, nextBossIndex } from "../game/campaign";
import { getBeatenBosses } from "../game/collection";
import { HelpButton } from "./HelpButton";

interface Props {
  /** Card id just unlocked this session (shows a banner), if any. */
  justUnlocked?: string | null;
  onFight: (bossId: string, playerClass: HeroClass) => void;
  onExit: () => void;
}

export function CampaignScreen({ justUnlocked, onFight, onExit }: Props) {
  const [cls, setCls] = useState<HeroClass>("barbarian");
  const beaten = getBeatenBosses();
  const nextIdx = nextBossIndex(beaten);
  const complete = nextIdx >= BOSSES.length;

  return (
    <div className="setup campaign">
      <div className="setup__help">
        <HelpButton />
      </div>
      <h1 className="logo logo--big">
        The <span>Gauntlet</span>
      </h1>
      <p className="setup__tag">
        Descend through the Prime Evils. Each fallen boss yields a legendary for your collection.
      </p>

      {justUnlocked && (
        <div className="unlock-banner">
          ★ Unlocked <strong>{getCardDef(justUnlocked).name}</strong> — find it in the deckbuilder!
        </div>
      )}
      {complete && <div className="unlock-banner">The Gauntlet is conquered. All Evils have fallen before you.</div>}

      <div className="campaign__class">
        <span className="difficulty__label">Fight as</span>
        <div className="difficulty__opts">
          {PLAYABLE_CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              className={"diff-btn" + (cls === c ? " diff-btn--active" : "")}
              onClick={() => setCls(c)}
            >
              {CLASS_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <p className="campaign__hint">Uses your saved {CLASS_LABEL[cls]} deck (build it in vs Computer → deckbuilder).</p>

      <div className="boss-list">
        {BOSSES.map((boss, i) => {
          const isBeaten = beaten.has(boss.id);
          const isNext = i === nextIdx;
          const locked = i > nextIdx;
          const reward = getCardDef(boss.rewardCardId);
          return (
            <div key={boss.id} className={"boss-card" + (isBeaten ? " boss-card--beaten" : locked ? " boss-card--locked" : " boss-card--next")}>
              <span className="boss-card__glyph">{boss.glyph}</span>
              <div className="boss-card__info">
                <span className="boss-card__name">
                  {boss.name} <span className="boss-card__title">— {boss.title}</span>
                </span>
                <span className="boss-card__flavor">{boss.flavor}</span>
                <span className="boss-card__reward">
                  Reward: ★ {isBeaten || isNext ? reward.name : "a legendary"}
                </span>
              </div>
              <div className="boss-card__action">
                {isBeaten && <span className="boss-card__status">Defeated ✓</span>}
                {isNext && (
                  <button type="button" className="btn btn--primary" onClick={() => onFight(boss.id, cls)}>
                    Fight
                  </button>
                )}
                {locked && <span className="boss-card__status">🔒 Locked</span>}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn--ghost" onClick={onExit}>
        Back to Menu
      </button>
    </div>
  );
}
