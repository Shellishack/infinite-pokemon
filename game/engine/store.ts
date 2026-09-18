// Persistence seam for the engine. The local game backs this with SQLite
// (server/Store); the browser demo backs it with an in-memory store snapshotted
// to IndexedDB. Engine code must only depend on this interface — no node:sqlite,
// node:fs, or node:crypto below the engine layer.

import type {Player,Region,WorldEvent,NpcMemory} from '../shared/model.js';
import type {CreatureProfile,ItemProfile,VehicleProfile} from '../shared/content.js';

export interface WorldStore {
  root?: string;
  meta(key: string): string | null;
  setMeta(key: string, value: string): void;
  transaction<T>(fn: () => T): T;
  players(): Player[];
  player(id: string): Player | undefined;
  addPlayer(player: Player, token: string): void;
  savePlayer(player: Player): void;
  region(id: string): Region | undefined;
  regions(): Region[];
  saveRegion(region: Region): void;
  npc(regionId: string): NpcMemory;
  saveNpc(id: string, npc: NpcMemory): void;
  event(playerId: string | null, regionId: string, kind: string, text: string): void;
  /** All recorded events for one player, oldest first (used to rebuild stats). */
  eventsFor(playerId: string): { kind: string; text: string; regionId: string }[];
  /** Recent world events, newest first. */
  events(limit?: number): WorldEvent[];
  /** Monotonic event counter. */
  sequence(): number;
  explore(pid: string, location: string): number;
  definition<T>(kind: string, id: string): T | undefined;
  define<T>(kind: string, id: string, value: T): T;
  hasReceipt(pid: string, id: string): boolean;
  receiptResult<T>(pid: string, id: string): T | undefined;
  receipt(pid: string, id: string, result?: unknown): void;
  recordJob(id: string, region: string, status: string, data: unknown): void;
  /** Marks interrupted any jobs left 'running' by a previous process. */
  markInterruptedJobs(): void;
  npcMotion(id: string): string | undefined;
  saveNpcMotion(id: string, data: string): void;
  /** Platform backup hook (SQLite VACUUM locally; snapshot in the browser). Optional. Returns the backup path when known. */
  backupDatabase?(tag: string): string | undefined;
  close(): void;
}

export type { CreatureProfile, ItemProfile, VehicleProfile };
