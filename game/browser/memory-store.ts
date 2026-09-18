// In-memory WorldStore used by the browser demo. The local game persists every
// action into SQLite; the demo keeps the same data model in memory and snapshots
// the whole store to IndexedDB after settled actions (serialized, one writer).

import type {Player,Region,WorldEvent,NpcMemory} from '../shared/model.js';
import type {WorldStore} from '../engine/store.js';

export interface StoreSnapshot {
  metadata: Record<string, string>;
  players: { id: string; token: string; data: Player }[];
  regions: Region[];
  events: { seq: number; at: number; playerId: string | null; regionId: string; kind: string; text: string }[];
  npcs: Record<string, NpcMemory>;
  jobs: Record<string, { region: string; status: string; data: unknown }>;
  definitions: Record<string, Record<string, unknown>>;
  npcMotion: Record<string, string>;
  explored: Record<string, string[]>;
  seq: number;
}

export class MemoryStore implements WorldStore {
  root = 'browser';
  private metadata = new Map<string, string>();
  private playerData = new Map<string, Player>();
  private tokens = new Map<string, string>();
  private regionData = new Map<string, Region>();
  private eventLog: StoreSnapshot['events'] = [];
  private npcData = new Map<string, NpcMemory>();
  private jobData = new Map<string, { region: string; status: string; data: unknown }>();
  private definitionData = new Map<string, Map<string, unknown>>();
  private motion = new Map<string, string>();
  private exploredCells = new Map<string, Set<string>>();
  private nextSeq = 1;

  constructor() {
    if (!this.metadata.has('worldId')) { this.metadata.set('worldId', crypto.randomUUID()); this.metadata.set('seed', 'willow-' + crypto.randomUUID().slice(0, 8)); this.metadata.set('name', 'The Willow Valley'); }
  }

  meta(key: string): string | null { return this.metadata.get(key) ?? null; }
  setMeta(key: string, value: string): void { this.metadata.set(key, value); }
  transaction<T>(fn: () => T): T { return fn(); }
  players(): Player[] { return [...this.playerData.values()].map(p => structuredClone(p)); }
  player(id: string): Player | undefined { const p = this.playerData.get(id); return p ? structuredClone(p) : undefined; }
  addPlayer(player: Player, token: string): void { this.playerData.set(player.id, structuredClone(player)); this.tokens.set(player.id, token); }
  savePlayer(player: Player): void { this.playerData.set(player.id, structuredClone(player)); }
  region(id: string): Region | undefined { return this.regionData.get(id); }
  regions(): Region[] { return [...this.regionData.values()]; }
  saveRegion(region: Region): void { this.regionData.set(region.id, region); }
  npc(regionId: string): NpcMemory { return this.npcData.get(regionId) ?? { visits: {}, memories: [], mood: 'curious', intention: 'Welcome travelers and protect the Waystone.', revision: 0 }; }
  saveNpc(id: string, npc: NpcMemory): void { this.npcData.set(id, npc); }
  event(playerId: string | null, regionId: string, kind: string, text: string): void { this.eventLog.push({ seq: this.nextSeq++, at: Date.now(), playerId, regionId, kind, text }); }
  events(limit = 30): WorldEvent[] { return this.eventLog.slice(-limit).reverse().map(e => ({ seq: e.seq, at: e.at, playerId: e.playerId, regionId: e.regionId, kind: e.kind, text: e.text })); }
  eventsFor(playerId: string): { kind: string; text: string; regionId: string }[] { return this.eventLog.filter(e => e.playerId === playerId).map(e => ({ kind: e.kind, text: e.text, regionId: e.regionId })); }
  sequence(): number { return this.nextSeq - 1; }
  explore(pid: string, location: string): number { let set = this.exploredCells.get(pid); if (!set) { set = new Set(); this.exploredCells.set(pid, set); } const known = set.size; set.add(location); return set.size - known; }
  definition<T>(kind: string, id: string): T | undefined { return this.definitionData.get(kind)?.get(id) as T | undefined; }
  define<T>(kind: string, id: string, value: T): T { let bucket = this.definitionData.get(kind); if (!bucket) { bucket = new Map(); this.definitionData.set(kind, bucket); } if (!bucket.has(id)) bucket.set(id, value); return bucket.get(id) as T; }
  hasReceipt(pid: string, id: string): boolean { return this.receipts.has(pid + ':' + id); }
  receiptResult<T>(pid: string, id: string): T | undefined { return this.receiptResults.get(pid + ':' + id) as T | undefined; }
  receipt(pid: string, id: string, result: unknown = {}): void { this.receipts.add(pid + ':' + id); this.receiptResults.set(pid + ':' + id, result); }
  private receipts = new Set<string>();
  private receiptResults = new Map<string, unknown>();
  recordJob(id: string, region: string, status: string, data: unknown): void { this.jobData.set(id, { region, status, data }); }
  markInterruptedJobs(): void { for (const job of this.jobData.values()) if (job.status === 'running') job.status = 'interrupted'; }
  npcMotion(id: string): string | undefined { return this.motion.get(id); }
  saveNpcMotion(id: string, data: string): void { this.motion.set(id, data); }
  backupDatabase(): string | undefined { return undefined; }
  close(): void { /* in-memory */ }

  tokenFor(playerId: string): string | undefined { return this.tokens.get(playerId); }
  playerIds(): string[] { return [...this.playerData.keys()]; }

  snapshot(): StoreSnapshot {
    return structuredClone({
      metadata: Object.fromEntries(this.metadata),
      players: [...this.playerData.entries()].map(([id, data]) => ({ id, token: this.tokens.get(id) ?? '', data })),
      regions: this.regions(),
      events: this.eventLog,
      npcs: Object.fromEntries(this.npcData),
      jobs: Object.fromEntries(this.jobData),
      definitions: Object.fromEntries([...this.definitionData.entries()].map(([kind, bucket]) => [kind, Object.fromEntries(bucket)])),
      npcMotion: Object.fromEntries(this.motion),
      explored: Object.fromEntries([...this.exploredCells.entries()].map(([pid, set]) => [pid, [...set]])),
      seq: this.nextSeq,
    });
  }

  restore(snapshot: StoreSnapshot): void {
    this.metadata = new Map(Object.entries(snapshot.metadata));
    this.playerData = new Map(snapshot.players.map(p => [p.id, p.data]));
    this.tokens = new Map(snapshot.players.map(p => [p.id, p.token]));
    this.regionData = new Map(snapshot.regions.map(r => [r.id, r]));
    this.eventLog = [...snapshot.events];
    this.npcData = new Map(Object.entries(snapshot.npcs));
    this.jobData = new Map(Object.entries(snapshot.jobs));
    this.definitionData = new Map(Object.entries(snapshot.definitions).map(([kind, bucket]) => [kind, new Map(Object.entries(bucket))]));
    this.motion = new Map(Object.entries(snapshot.npcMotion));
    this.exploredCells = new Map(Object.entries(snapshot.explored).map(([pid, cells]) => [pid, new Set(cells)]));
    this.nextSeq = snapshot.seq;
  }
}
