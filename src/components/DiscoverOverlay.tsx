import { getCardDef } from "../engine";

/** Modal shown when the player must Discover one of three offered cards. */
export function DiscoverOverlay({ options, onChoose }: { options: string[]; onChoose: (index: number) => void }) {
  return (
    <div className="overlay">
      <div className="discover">
        <h2>Discover a Card</h2>
        <div className="discover__cards">
          {options.map((id, i) => {
            const def = getCardDef(id);
            return (
              <button key={`${id}-${i}`} type="button" className={"discover-card discover-card--" + def.type} onClick={() => onChoose(i)}>
                <span className="discover-card__cost">{def.cost}</span>
                <span className="discover-card__name">{def.name}</span>
                <span className="discover-card__text">{def.text}</span>
                {def.type === "minion" ? (
                  <span className="discover-card__stats">
                    <span className="stat stat--attack">{def.attack}</span>
                    <span className="stat stat--health">{def.health}</span>
                  </span>
                ) : (
                  <span className="discover-card__type">Spell</span>
                )}
                {def.flavor && <span className="discover-card__flavor">{def.flavor}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
