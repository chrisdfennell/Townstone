import { useEffect, useMemo, useState } from "react";
import {
  PLAYABLE_CLASSES,
  CLASS_LABEL,
  HERO_POWERS,
  cardsForClass,
  classDeck,
  getCardDef,
} from "../engine";
import type { AiDifficulty, HeroClass } from "../engine";
import { DECK_SIZE, copyLimit, loadDeck, saveDeck } from "../game/deckStore";
import type { GameConfig } from "../game/useGame";

interface Props {
  onStart: (config: GameConfig) => void;
}

const DIFFICULTIES: Array<{ id: AiDifficulty; label: string; blurb: string }> = [
  { id: "easy", label: "Easy", blurb: "Plays greedily and makes mistakes." },
  { id: "normal", label: "Normal", blurb: "Searches ahead for solid lines." },
  { id: "nightmare", label: "Nightmare", blurb: "Deep search, near-optimal." },
];

export function SetupScreen({ onStart }: Props) {
  const [cls, setCls] = useState<HeroClass>("barbarian");
  const [deck, setDeck] = useState<string[]>(() => loadDeck("barbarian"));
  const [difficulty, setDifficulty] = useState<AiDifficulty>("normal");

  // Switching class loads that class's saved (or default) deck.
  useEffect(() => {
    setDeck(loadDeck(cls));
  }, [cls]);

  // Persist edits.
  useEffect(() => {
    if (deck.length === DECK_SIZE) saveDeck(cls, deck);
  }, [cls, deck]);

  const pool = useMemo(() => cardsForClass(cls).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)), [cls]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [deck]);

  const add = (id: string) => {
    if (deck.length >= DECK_SIZE) return;
    if ((counts.get(id) ?? 0) >= copyLimit(id)) return;
    setDeck((d) => [...d, id]);
  };
  const remove = (id: string) => {
    const i = deck.lastIndexOf(id);
    if (i >= 0) setDeck((d) => d.filter((_, idx) => idx !== i));
  };

  const deckEntries = useMemo(
    () =>
      [...counts.entries()]
        .map(([id, n]) => ({ def: getCardDef(id), n }))
        .sort((a, b) => a.def.cost - b.def.cost || a.def.name.localeCompare(b.def.name)),
    [counts],
  );

  const start = () => {
    const aiClass = PLAYABLE_CLASSES[Math.floor(Math.random() * PLAYABLE_CLASSES.length)];
    onStart({ playerClass: cls, playerDeck: deck, aiClass, aiDeck: classDeck(aiClass), difficulty });
  };

  return (
    <div className="setup">
      <h1 className="logo logo--big">
        Town<span>stone</span>
      </h1>
      <p className="setup__tag">Choose your champion and forge a deck of 30 cards.</p>

      <div className="class-picker">
        {PLAYABLE_CLASSES.map((c) => (
          <button
            key={c}
            type="button"
            className={"class-btn" + (c === cls ? " class-btn--active" : "")}
            onClick={() => setCls(c)}
          >
            <span className="class-btn__name">{CLASS_LABEL[c]}</span>
            <span className="class-btn__power">
              {HERO_POWERS[c].name}: {HERO_POWERS[c].text}
            </span>
          </button>
        ))}
      </div>

      <div className="builder">
        <div className="builder__pool">
          <h3>{CLASS_LABEL[cls]} Cards</h3>
          <div className="pool-list">
            {pool.map((def) => {
              const have = counts.get(def.id) ?? 0;
              const full = have >= copyLimit(def.id);
              return (
                <button
                  key={def.id}
                  type="button"
                  className={"pool-card" + (full ? " pool-card--full" : "")}
                  onClick={() => add(def.id)}
                  title={def.text || def.flavor}
                  disabled={full || deck.length >= DECK_SIZE}
                >
                  <span className="pool-card__cost">{def.cost}</span>
                  <span className="pool-card__name">{def.name}</span>
                  {def.type === "minion" ? (
                    <span className="pool-card__stats">{def.attack}/{def.health}</span>
                  ) : (
                    <span className="pool-card__spell">spell</span>
                  )}
                  {def.legendary && <span className="pool-card__leg">★</span>}
                  {have > 0 && <span className="pool-card__have">{have}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="builder__deck">
          <h3>
            Your Deck <span className={"deck-count" + (deck.length === DECK_SIZE ? " deck-count--ok" : "")}>{deck.length}/{DECK_SIZE}</span>
          </h3>
          <div className="deck-list">
            {deckEntries.length === 0 && <p className="deck-empty">Add cards from the left.</p>}
            {deckEntries.map(({ def, n }) => (
              <button key={def.id} type="button" className="deck-row" onClick={() => remove(def.id)} title="Click to remove">
                <span className="deck-row__cost">{def.cost}</span>
                <span className="deck-row__name">
                  {def.name}
                  {def.legendary && " ★"}
                </span>
                {n > 1 && <span className="deck-row__n">×{n}</span>}
              </button>
            ))}
          </div>
          <div className="difficulty">
            <span className="difficulty__label">Opponent</span>
            <div className="difficulty__opts">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={"diff-btn" + (difficulty === d.id ? " diff-btn--active" : "")}
                  onClick={() => setDifficulty(d.id)}
                  title={d.blurb}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="builder__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setDeck(classDeck(cls))}>
              Reset to Default
            </button>
            <button type="button" className="btn btn--primary" disabled={deck.length !== DECK_SIZE} onClick={start}>
              Enter Battle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
