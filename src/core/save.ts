/** Spielstand – lokal im Gerät (localStorage). Später ggf. Capacitor Preferences / Cloud-Sync. */

export interface LevelRecord {
  done: boolean;
  bestCoins: number;
  bestTime: number | null;
}

export interface RacerSave {
  ownedCars: string[];
  car: string;
  rocketPower: number;
  rocketTank: number;
  levels: Record<string, LevelRecord>;
}

export interface SaveData {
  v: 1;
  /** Playmania-Münzen – gelten spielübergreifend */
  coins: number;
  muted: boolean;
  racer: RacerSave;
}

const KEY = 'playmania.save.v1';

function defaults(): SaveData {
  return {
    v: 1,
    coins: 0,
    muted: false,
    racer: { ownedCars: ['flitzer'], car: 'flitzer', rocketPower: 0, rocketTank: 0, levels: {} },
  };
}

let cache: SaveData | null = null;

export function loadSave(): SaveData {
  if (cache) return cache;
  const base = defaults();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      cache = {
        ...base,
        ...parsed,
        v: 1,
        racer: { ...base.racer, ...(parsed.racer ?? {}) },
      };
      return cache;
    }
  } catch {
    /* kaputter/blockierter Speicher → Standardwerte */
  }
  cache = base;
  return cache;
}

export function persist(): void {
  if (!cache) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* z. B. privater Modus – Spiel läuft trotzdem weiter */
  }
}

export function updateSave(fn: (s: SaveData) => void): SaveData {
  const s = loadSave();
  fn(s);
  persist();
  return s;
}

/** Nur für Entwicklung/Tests: Spielstand zurücksetzen. */
export function resetSave(): void {
  cache = defaults();
  persist();
}
