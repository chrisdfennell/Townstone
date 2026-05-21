/**
 * Player progression saved in localStorage: which campaign bosses are beaten
 * and which reward cards are unlocked.
 */
const UNLOCK_KEY = "townstone.unlocked";
const BOSS_KEY = "townstone.bosses";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

function writeSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* storage unavailable */
  }
}

export function getUnlockedCards(): Set<string> {
  return readSet(UNLOCK_KEY);
}

export function isCardUnlocked(id: string): boolean {
  return getUnlockedCards().has(id);
}

export function unlockCard(id: string): void {
  const set = getUnlockedCards();
  set.add(id);
  writeSet(UNLOCK_KEY, set);
}

export function getBeatenBosses(): Set<string> {
  return readSet(BOSS_KEY);
}

export function isBossBeaten(id: string): boolean {
  return getBeatenBosses().has(id);
}

export function markBossBeaten(id: string): void {
  const set = getBeatenBosses();
  set.add(id);
  writeSet(BOSS_KEY, set);
}
