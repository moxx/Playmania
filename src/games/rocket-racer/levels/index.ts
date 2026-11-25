import { kidsroom } from './kidsroom';
import type { LevelDef } from './types';

export const LEVELS: LevelDef[] = [kidsroom];

/** Geplante Level (werden im Menü als "Bald" angezeigt) */
export const UPCOMING = [
  { name: 'Garage', subtitle: 'Werkzeug, Ölfässer & Rampen' },
  { name: 'Wohnzimmer', subtitle: 'Sofa-Sprünge & Teppich-Rennen' },
];

export function levelById(id: string): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
