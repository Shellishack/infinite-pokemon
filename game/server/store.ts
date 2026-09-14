import {designContext} from './design-context.js';
import { DatabaseSync } from 'node:sqlite';
import * as sqlite from 'node:sqlite';
import { mkdirSync, writeFileSync, renameSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import {creatureInfo,creatureKey,type Player,type Region,type WorldEvent,type NpcMemory} from '../shared/model.js';
import {terrainContext,generationCapabilities} from './terrain-context.js';

export class Store {
  db: DatabaseSync;
  constructor(public root: string) {
    mkdirSync(root, { recursive: true });
    this.db = new DatabaseSync(join(root,'world.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS regions (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, player_id TEXT, region_id TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts (player_id TEXT NOT NULL, command_id TEXT NOT NULL, PRIMARY KEY(player_id,command_id));
      CREATE TABLE IF NOT EXISTS npcs (region_id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, region_id TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS definitions (kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS npc_motion(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS explored_cells (player_id TEXT NOT NULL,location TEXT NOT NULL,PRIMARY KEY(player_id,location));
    `);
    if (!this.db.prepare('PRAGMA table_info(receipts)').all().some(column=>column.name==='result')) {
      this.db.exec("ALTER TABLE receipts ADD COLUMN result TEXT NOT NULL DEFAULT '{}'");
    }
    if (!this.meta('worldId')) { this.setMeta('worldId',randomUUID()); this.setMeta('seed','willow-'+randomUUID().slice(0,8)); this.setMeta('name','The Willow Valley'); }
  }
  meta(key: string): string | null { const row = this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key) as {value:string}|undefined; return row?.value ?? null; }
  setMeta(key: string, value: string) { this.db.prepare('INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value); }
  transaction<T>(fn:()=>T):T { this.db.exec('BEGIN IMMEDIATE'); try { const result=fn(); this.db.exec('COMMIT'); return result; } catch(e) { this.db.exec('ROLLBACK'); throw e; } }
  players(): Player[] { return this.db.prepare('SELECT data FROM players').all().map(r=>JSON.parse(String(r.data))); }
  player(id: string): Player | undefined { const r=this.db.prepare('SELECT data FROM players WHERE id=?').get(id); return r ? JSON.parse(String(r.data)) : undefined; }
  byToken(token: string): Player | undefined { const r=this.db.prepare('SELECT data FROM players WHERE token_hash=?').get(createHash('sha256').update(token).digest('hex')); return r ? JSON.parse(String(r.data)) : undefined; }
  rotatePlayerToken(id:string){const token=randomUUID()+randomUUID();this.db.prepare('UPDATE players SET token_hash=? WHERE id=?').run(createHash('sha256').update(token).digest('hex'),id);return token;}
  addPlayer(player:Player, token:string) { this.db.prepare('INSERT INTO players VALUES (?,?,?)').run(player.id,createHash('sha256').update(token).digest('hex'),JSON.stringify(player)); }
  savePlayer(player:Player) { this.db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id); }
  definition<T>(kind:string,id:string):T|undefined {const row=this.db.prepare('SELECT data FROM definitions WHERE kind=? AND id=?').get(kind,id);return row?JSON.parse(String(row.data)):undefined;}
  define<T>(kind:string,id:string,value:T):T {this.db.prepare('INSERT OR IGNORE INTO definitions VALUES(?,?,?)').run(kind,id,JSON.stringify(value));return this.definition<T>(kind,id)!;}
  explore(pid:string,location:string){return Number(this.db.prepare('INSERT OR IGNORE INTO explored_cells VALUES(?,?)').run(pid,location).changes);}
  region(id:string):Region|undefined { const r=this.db.prepare('SELECT data FROM regions WHERE id=?').get(id); return r?JSON.parse(String(r.data)):undefined; }
  regions():Region[] { return this.db.prepare('SELECT data FROM regions').all().map(r=>JSON.parse(String(r.data))); }
  saveRegion(region:Region) { this.db.prepare('INSERT INTO regions VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(region.id,JSON.stringify(region)); }
  npc(regionId:string):NpcMemory { const r=this.db.prepare('SELECT data FROM npcs WHERE region_id=?').get(regionId); return r?JSON.parse(String(r.data)):{visits:{},memories:[],mood:'curious',intention:'Welcome travelers and protect the Waystone.',revision:0}; }
  saveNpc(id:string,npc:NpcMemory) { this.db.prepare('INSERT INTO npcs VALUES (?,?) ON CONFLICT(region_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(npc)); }
  event(playerId:string|null,regionId:string,kind:string,text:string) { this.db.prepare('INSERT INTO events(at,player_id,region_id,kind,text) VALUES (?,?,?,?,?)').run(Date.now(),playerId,regionId,kind,text); }
  events(limit=30):WorldEvent[] { return this.db.prepare('SELECT seq,at,player_id as playerId,region_id as regionId,kind,text FROM events ORDER BY seq DESC LIMIT ?').all(limit) as unknown as WorldEvent[]; }
  sequence() { return Number(this.db.prepare('SELECT COALESCE(MAX(seq),0) as seq FROM events').get()!.seq); }
  hasReceipt(pid:string,id:string) { return !!this.db.prepare('SELECT 1 FROM receipts WHERE player_id=? AND command_id=?').get(pid,id); }
  receiptResult<T>(pid:string,id:string):T|undefined { const row=this.db.prepare('SELECT result FROM receipts WHERE player_id=? AND command_id=?').get(pid,id);return row?JSON.parse(String(row.result)) as T:undefined; }
  receipt(pid:string,id:string,result:unknown={}) { this.db.prepare('INSERT INTO receipts(player_id,command_id,result) VALUES (?,?,?)').run(pid,id,JSON.stringify(result)); }
  recordJob(id:string,region:string,status:string,data:unknown) { this.db.prepare('INSERT INTO jobs VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data').run(id,region,status,JSON.stringify(data)); }
  snapshot(target:Region,committedOnly=false) {
    const lineage={runId:this.meta('runId'),runName:this.meta('runName'),forkCheckpointId:this.meta('forkCheckpointId'),headCheckpointId:this.meta('headCheckpointId')};
    const seq=this.sequence(), id=`${seq}-${randomUUID().slice(0,8)}`, root=join(this.root,'context','snapshots'), stage=join(root,`.${id}`), final=join(root,id);
    mkdirSync(stage,{recursive:true});
    const nearby=this.regions().filter(r=>Math.abs(r.gx-target.gx)+Math.abs(r.gy-target.gy)<=2&&(!committedOnly||r.id===target.id||r.published||r.prepared||r.source!=='fallback'));
    const players=this.players().filter(p=>nearby.some(r=>r.id===p.regionId));
    const recentEvents=this.events(100);
    const files:Record<string,unknown>={
      'world.json':{id:this.meta('worldId'),...lineage,name:this.meta('name'),seed:this.meta('seed'),choice:this.meta('choice'),canon:this.events(40).filter(e=>e.kind!=='move')},
      'players.json':players.map(({id,name,regionId,party,tutorial,tutorialFlags,visited,choice})=>({id,name,regionId,party,tutorial,tutorialFlags,visited,choice})),
      'maps.json':nearby.map(r=>({id:r.id,name:r.name,description:r.description,published:r.published,status:r.published?'observed':'planned',npc:this.npc(r.id),events:recentEvents.filter(e=>e.regionId===r.id)})),
      'request.json':{targetId:target.id,gx:target.gx,gy:target.gy,sourceHash:target.hash,sourceEventSeq:seq,scope:'Generate a map story consistent with committed facts; geometry and tutorial mechanics are engine-owned.'},
    };
    const hashes:Record<string,string>={};
    for(const [name,data] of Object.entries(files)){const text=JSON.stringify(data,null,2);writeFileSync(join(stage,name),text);hashes[name]=createHash('sha256').update(text).digest('hex');}
    const dependencies=nearby.filter(r=>r.id!==target.id).map(r=>({id:r.id,hash:r.hash,published:r.published}));
    const context={snapshotId:id,lineage,designContext:designContext(target),capabilities:generationCapabilities,terrainContext:terrainContext(target,nearby,players),world:{id:this.meta('worldId'),name:this.meta('name'),seed:this.meta('seed'),choice:this.meta('choice')},request:files['request.json'],
      players:players.map(p=>({id:p.id,name:p.name,regionId:p.regionId,party:p.party.map(c=>({species:creatureKey(c),base:c.species,name:creatureInfo(c).name,types:creatureInfo(c).types,traits:c.traits,parentSpecies:c.profile?.parentSpecies,generation:c.profile?.generation,level:c.level})),tutorial:p.tutorial,tutorialFlags:p.tutorialFlags,choice:p.choice,coins:p.coins,ownedVehicles:p.ownedVehicles,egg:p.egg?{species:p.egg.profile.id,name:p.egg.profile.name,remainingSteps:Math.max(0,p.egg.hatchAtStep-p.steps)}:null,inventory:Object.entries(p.items??{}).filter(([,quantity])=>quantity>0).slice(-12),visited:p.visited.slice(-12)})),
      maps:nearby.map(r=>({id:r.id,gx:r.gx,gy:r.gy,name:r.name,description:r.description,biome:r.biome,npcName:r.npcName,npcTraits:r.npcTraits,creatures:r.creatures,shopGoods:r.shopGoods,vehicles:r.vehicles,hook:r.hook,status:r.published?'observed':'planned'})),
      events:recentEvents.filter(e=>nearby.some(r=>r.id===e.regionId)||e.kind==='world-choice').slice(0,24),
    };
    const compact=JSON.stringify(context);writeFileSync(join(stage,'context.json'),compact);
    writeFileSync(join(stage,'manifest.json'),JSON.stringify({snapshotId:id,worldId:this.meta('worldId'),...lineage,sourceEventSeq:seq,files:{'context.json':createHash('sha256').update(compact).digest('hex')},archiveFiles:hashes,dependencies},null,2));
    renameSync(stage,final);
    const pointer=join(this.root,'context','current.json'); writeFileSync(pointer+'.tmp',JSON.stringify({snapshotId:id,path:final})); renameSync(pointer+'.tmp',pointer);
    return {id,seq,runId:lineage.runId,path:join(final,'manifest.json'),contextPath:join(final,'context.json'),choice:this.meta('choice'),dependencies,npcRevision:this.npc(target.id).revision};
  }
  async backupTo(path:string) {
    if(typeof sqlite.backup==='function'){await sqlite.backup(this.db,path);return;}
    // Node 22.13–22.15 has DatabaseSync but not the online backup export.
    // VACUUM INTO includes committed WAL state; stage before replacing a backup.
    const stage=path+'.'+randomUUID()+'.tmp';
    try{this.db.prepare('VACUUM INTO ?').run(stage);renameSync(stage,path);}
    finally{rmSync(stage,{force:true});}
  }
  close() { this.db.close(); }
}
