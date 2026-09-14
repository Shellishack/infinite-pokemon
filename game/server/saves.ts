import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,readFileSync,renameSync,copyFileSync} from 'node:fs';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {Store} from './store.js';
import type {SavedRun,Checkpoint,SaveSummary,SaveCatalog} from '../shared/saves.js';

interface RunRecord extends SavedRun {directory:string;port?:number;adminPort?:number}
const hashFile=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
export class SaveLibrary {
  db:DatabaseSync;servers=new Map<string,unknown>();opening=new Map<string,Promise<unknown>>();closing=false;
  constructor(public root:string){
    root=this.root=resolve(root);mkdirSync(join(root,'save-library'),{recursive:true});
    this.db=new DatabaseSync(join(root,'save-library','catalog.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,request_id TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(run_id,request_id));
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  }
  path(directory:string){const path=resolve(this.root,directory);if(path!==this.root&&!path.startsWith(this.root+sep))throw new Error('Invalid save directory.');return path;}
  run(id:string):RunRecord {const row=this.db.prepare('SELECT data FROM runs WHERE id=?').get(id);if(!row)throw new Error('Run not found.');return JSON.parse(String(row.data));}
  put(run:RunRecord){this.db.prepare('INSERT INTO runs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(run.id,JSON.stringify(run));}
  register(store:Store,preview:boolean){
    const directory=relative(this.root,store.root)||'.';if(isAbsolute(directory)||directory==='..'||directory.startsWith('..'+sep))throw new Error('Save must belong to this library.');
    let id=store.meta('runId');if(!id){id=randomUUID();store.setMeta('runId',id);store.setMeta('runName',preview?'Tutorial run':'Default run');}
    const existing=this.db.prepare('SELECT data FROM runs WHERE id=?').get(id);
    const run:RunRecord=existing?JSON.parse(String(existing.data)):{id,directory,name:store.meta('runName')??'Default run',createdAt:Date.now(),parentCheckpointId:store.meta('forkCheckpointId'),headCheckpointId:store.meta('headCheckpointId'),preview,summary:null};
    if(run.directory!==directory)throw new Error('This run identity already belongs to another directory.');
    run.preview=preview;run.summary=this.summary(store);if(run.headCheckpointId)store.setMeta('headCheckpointId',run.headCheckpointId);this.put(run);return run;
  }
  summary(store:Store):SaveSummary|null {
    const player=store.player(store.meta('hostPlayerId')??'')??store.players()[0];if(!player)return null;
    const region=store.region(player.regionId),scene=region?.scenes?.find(s=>s.id===player.sceneId);
    return {location:scene?.name??region?.name??player.regionId,trainer:player.name,tutorial:player.tutorial,companions:player.party.length+player.storage.length,places:player.visited.length,eventSeq:store.sequence()};
  }
  activate(id:string){this.run(id);this.db.prepare("INSERT INTO settings VALUES('activeRun',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(id);}
  active(){return this.db.prepare("SELECT value FROM settings WHERE key='activeRun'").get()?.value as string|undefined;}
  checkpoint(id:string):Checkpoint {const row=this.db.prepare('SELECT data FROM checkpoints WHERE id=?').get(id);if(!row)throw new Error('Checkpoint not found.');return JSON.parse(String(row.data));}
  checkpointPath(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid checkpoint identity.');return join(this.root,'save-library','checkpoints',id+'.sqlite');}
  save(store:Store,name:string,requestId:string):Checkpoint {
    const run=this.run(store.meta('runId')!);
    const prior=this.db.prepare('SELECT data FROM checkpoints WHERE run_id=? AND request_id=?').get(run.id,requestId);if(prior)return JSON.parse(String(prior.data));
    if(store.players().some(p=>p.battle?.kind==='coop'&&!p.battle.finished))throw new Error('Finish the shared battle before creating a checkpoint.');
    const summary=this.summary(store);if(!summary)throw new Error('Start this run before creating a checkpoint.');
    const id=randomUUID(),path=this.checkpointPath(id),stage=path+'.tmp';mkdirSync(join(this.root,'save-library','checkpoints'),{recursive:true});
    // Synchronous SQLite snapshot: no game command or generation commit can interleave.
    store.db.prepare('VACUUM INTO ?').run(stage);renameSync(stage,path);
    const checkpoint:Checkpoint={id,runId:run.id,parentId:run.headCheckpointId??run.parentCheckpointId,name:name.trim()||'Checkpoint',createdAt:Date.now(),summary,hash:hashFile(path)};
    this.db.exec('BEGIN IMMEDIATE');try{
      this.db.prepare('INSERT INTO checkpoints VALUES(?,?,?,?)').run(id,run.id,requestId,JSON.stringify(checkpoint));run.headCheckpointId=id;run.summary=summary;this.put(run);this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    store.setMeta('headCheckpointId',id);return checkpoint;
  }
  ensureInitial(store:Store){const run=this.run(store.meta('runId')!);if(!run.headCheckpointId&&this.summary(store))return this.save(store,store.players().some(p=>p.introDone)?'Imported progress':'Beginning of the run','initial');}
  fork(checkpointId:string,name:string,id:string=randomUUID()):RunRecord {
    const previous=this.db.prepare('SELECT data FROM runs WHERE id=?').get(id);if(previous){const run=this.run(id);if(run.parentCheckpointId!==checkpointId||run.name!==name.trim())throw new Error('This request belongs to a different branch.');return run;}
    const checkpoint=this.checkpoint(checkpointId),source=this.checkpointPath(checkpoint.id);
    if(!existsSync(source)||hashFile(source)!==checkpoint.hash)throw new Error('The checkpoint is missing or damaged. The original run is unchanged.');
    const directory=join('save-library','runs',id),destination=this.path(directory);mkdirSync(destination,{recursive:true});copyFileSync(source,join(destination,'world.sqlite'));
    const store=new Store(destination);let run:RunRecord;
    try{
      store.transaction(()=>{
        store.setMeta('worldId',randomUUID());store.setMeta('runId',id);store.setMeta('runName',name.trim()||'Branch');store.setMeta('forkCheckpointId',checkpoint.id);store.setMeta('headCheckpointId',checkpoint.id);store.setMeta('sessionMode','singleplayer');
        store.db.exec("DELETE FROM jobs;DELETE FROM receipts;DELETE FROM metadata WHERE key IN ('hostConsent','latestPreviewId') OR key LIKE 'previewPorts:%';");
        for(const player of store.players()){delete player.movement;store.savePlayer(player);store.rotatePlayerToken(player.id);}
      });
      run={id,directory,name:name.trim()||'Branch',createdAt:Date.now(),parentCheckpointId:checkpoint.id,headCheckpointId:checkpoint.id,preview:!!store.meta('previewPackVersion')&&store.meta('previewPromoted')!=='true',summary:this.summary(store)};
      this.put(run);
    }finally{store.close();}
    return run;
  }
  fresh(preview:boolean,name:string,id:string=randomUUID()):RunRecord {
    const previous=this.db.prepare('SELECT data FROM runs WHERE id=?').get(id);if(previous){const run=this.run(id);if(run.parentCheckpointId||run.name!==name.trim())throw new Error('This request belongs to a different run.');return run;}
    const directory=join('save-library','runs',id),store=new Store(this.path(directory));
    try{store.setMeta('runId',id);store.setMeta('runName',name.trim()||'New run');store.setMeta('sessionMode','singleplayer');const run={id,directory,name:name.trim()||'New run',createdAt:Date.now(),parentCheckpointId:null,headCheckpointId:null,preview,summary:null};this.put(run);return run;}finally{store.close();}
  }
  catalog(store:Store):SaveCatalog {
    const currentRunId=store.meta('runId')!,current=this.run(currentRunId);current.summary=this.summary(store);current.preview=!!store.meta('previewPackVersion')&&store.meta('previewPromoted')!=='true';this.put(current);
    return {currentRunId,runs:this.db.prepare('SELECT data FROM runs ORDER BY rowid').all().map(row=>{const {directory,port,adminPort,...run}=JSON.parse(String(row.data)) as RunRecord;return run;}),checkpoints:this.db.prepare('SELECT data FROM checkpoints ORDER BY rowid').all().map(row=>JSON.parse(String(row.data)))};
  }
  close(){this.db.close();}
}
