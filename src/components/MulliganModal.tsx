import type { CardInstance } from "../engine";
import { getCardDef } from "../engine";

interface Props {
  hand: CardInstance[];
  choices: string[];
  goingFirst: boolean;
  onToggle: (instanceId: string) => void;
  onConfirm: () => void;
}

/** Opening-hand mulligan: click cards to replace them, then confirm. */
export function MulliganModal({ hand, choices, goingFirst, onToggle, onConfirm }: Props) {
  return (
    <div className="overlay">
      <div className="mulligan">
        <h2>Choose Your Hand</h2>
        <p className="mulligan__hint">
          Click cards to mulligan them away for new ones. {goingFirst ? "You go first." : "You go second — and gain The Coin."}
        </p>
        <div className="mulligan__cards">
          {hand.map((card) => {
            const def = getCardDef(card.defId);
            const tossed = choices.includes(card.instanceId);
            return (
              <button
                key={card.instanceId}
                type="button"
                className={"mulligan-card" + (tossed ? " mulligan-card--tossed" : "")}
                onClick={() => onToggle(card.instanceId)}
              >
                <span className="mulligan-card__cost">{def.cost}</span>
                <span className="mulligan-card__name">{def.name}</span>
                {def.type === "minion" && (
                  <span className="mulligan-card__stats">
                    {def.attack}/{def.health}
                  </span>
                )}
                <span className="mulligan-card__type">{def.type}</span>
                {tossed && <span className="mulligan-card__x">↻</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          {choices.length > 0 ? `Replace ${choices.length} & Begin` : "Keep Hand & Begin"}
        </button>
      </div>
    </div>
  );
}
