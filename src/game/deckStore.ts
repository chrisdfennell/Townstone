import type { HeroClass } from "../engine";
import { classDeck, getCardDef } from "../engine";

const KEY = (cls: HeroClass) => `townstone.deck.${cls}`;

export const DECK_SIZE = 30;
export function copyLimit(cardId: string): number {
  return getCardDef(cardId).legendary ? 1 : 2;
}

/** Load a saved deck for a class, falling back to the prebuilt class deck. */
export function loadDeck(cls: HeroClass): string[] {
  try {
    const raw = localStorage.getItem(KEY(cls));
    if (raw) {
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids) && ids.length === DECK_SIZE && ids.every((id) => isValid(id))) {
        return ids;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return classDeck(cls);
}

export function saveDeck(cls: HeroClass, deck: string[]): void {
  try {
    localStorage.setItem(KEY(cls), JSON.stringify(deck));
  } catch {
    /* storage may be unavailable; non-fatal */
  }
}

function isValid(id: string): boolean {
  try {
    getCardDef(id);
    return true;
  } catch {
    return false;
  }
}
