import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {SaveLibrary} from '../game/server/saves.js';
import {Generator,CodexTransport,type RunResult} from '../game/server/harness.js';
import {fallbackStory} from '../game/engine/maps.js';
import {createGameServer} from '../game/server/index.js';

const root=()=>resolve('.test-data','saves-'+randomUUID());
function setup(){const directory=root(),store=new Store(directory),library=new SaveLibrary(directory);library.register(store,false);const world=new World(store);world.warmStart();const {player,token}=world.createPlayer('Trainer');store.setMeta('hostPlayerId',player.id);library.ensureInitial(store);world.apply(player.id,randomUUID(),{kind:'intro'});world.apply(player.id,randomUUID(),{kind:'starter',species:'bulbasaur'});return {store,library,world,player,token};}
test('checkpoint tree preserves progress and each fork has isolated maps, events, NPC memory, identities and generation context',async()=>{
  const {store,library,world,player,token}=setup();const opened:Store[]=[];
  try{
    store.saveNpc('0,0',{visits:{[player.id]:1},memories:['Shared ancestor memory'],mood:'curious',intention:'Wait',revision:1});
    const a=library.save(store,'Before the choice',randomUUID()),bytes=readFileSync(library.checkpointPath(a.id));
    store.setMeta('choice','protect');store.event(player.id,'0,0','world-choice','PARENT FUTURE ONLY');store.saveNpc('0,0',{...store.npc('0,0'),memories:['PARENT FUTURE ONLY'],revision:2});world.ensureRegion(2,0);
    const rich=store.player(player.id)!;rich.coins=999;store.savePlayer(rich);const b=library.save(store,'Protect',randomUUID());assert.equal(b.parentId,a.id);
    const left=library.fork(a.id,'Explore'),right=library.fork(a.id,'A second future');
    const branch=new Store(library.path(left.directory)),sibling=new Store(library.path(right.directory));opened.push(branch,sibling);
    assert.equal(branch.player(player.id)!.coins,100);assert.equal(branch.player(player.id)!.party[0].species,'bulbasaur');assert.equal(branch.meta('choice'),null);assert.equal(branch.region('2,0'),undefined);assert.deepEqual(branch.npc('0,0').memories,['Shared ancestor memory']);assert.equal(branch.byToken(token),undefined);assert.notEqual(branch.meta('worldId'),store.meta('worldId'));
    assert.equal(existsSync(join(branch.root,'context')),false);assert.equal(existsSync(join(branch.root,'harness')),false);
    branch.setMeta('choice','explore');branch.event(player.id,'0,0','world-choice','LEFT BRANCH ONLY');const c=library.save(branch,'Explore',randomUUID());assert.equal(c.parentId,a.id);assert.equal(sibling.meta('choice'),null);assert.equal(store.meta('choice'),'protect');
    const view=branch.snapshot(branch.region('0,0')!),context=JSON.parse(readFileSync(view.contextPath,'utf8'));
    assert.equal(context.lineage.runId,left.id);assert.equal(context.lineage.forkCheckpointId,a.id);assert.equal(context.lineage.headCheckpointId,c.id);assert.equal(context.world.choice,'explore');assert.ok(JSON.stringify(context).includes('LEFT BRANCH ONLY'));assert.ok(!JSON.stringify(context).includes('PARENT FUTURE ONLY'));
    assert.deepEqual(readFileSync(library.checkpointPath(a.id)),bytes);assert.equal(sibling.events().some(e=>e.text==='LEFT BRANCH ONLY'),false);
    const catalog=library.catalog(store);assert.equal(catalog.runs.length,3);assert.equal(catalog.checkpoints.find(checkpoint=>checkpoint.id===c.id)!.parentId,a.id);
  }finally{for(const branch of opened)branch.close();store.close();library.close();}
});

test('generation that finishes after a checkpoint cannot enter a fork and inherited pending jobs never resume',async()=>{
  const {store,library,world}=setup();let release!:(result:RunResult)=>void,requested!:(value:void)=>void;const begun=new Promise<void>(done=>requested=done);
  class DeferredTransport extends CodexTransport {override run(){requested();return new Promise<RunResult>(done=>release=done);}override close(){return Promise.resolve();}}
  const generator=new Generator(store,false,{transport:new DeferredTransport(store.root)});generator.verified=true;let branch:Store|undefined;
  try{
    world.ensureRegion(2,0);const pending=generator.generate('2,0');await begun;
    const checkpoint=library.save(store,'Generation in flight',randomUUID()),fork=library.fork(checkpoint.id,'Independent');branch=new Store(library.path(fork.directory));
    assert.equal(branch.db.prepare('SELECT COUNT(*) AS n FROM jobs').get()!.n,0);
    const job=JSON.parse(String(store.db.prepare("SELECT data FROM jobs WHERE status='running'").get()!.data));
    release({output:{snapshotId:job.snapshot.id,story:{...fallbackStory(2,0,store.meta('seed')!),name:'Only the original future'}},usage:null,duration:1});await pending;
    assert.equal(store.region('2,0')!.name,'Only the original future');assert.notEqual(branch.region('2,0')!.name,'Only the original future');
    assert.equal(createHash('sha256').update(readFileSync(library.checkpointPath(checkpoint.id))).digest('hex'),checkpoint.hash);
  }finally{await generator.close();branch?.close();store.close();library.close();}
});

test('save catalogue survives restart, duplicate checkpoint requests deduplicate, and damaged checkpoints fail without changing the run',()=>{
  const {store,library}=setup();const runId=store.meta('runId')!,requestId=randomUUID(),checkpoint=library.save(store,'Safe',requestId);
  assert.equal(library.save(store,'Duplicate',requestId).id,checkpoint.id);library.activate(runId);const directory=store.root;store.close();library.close();
  const restored=new Store(directory),index=new SaveLibrary(directory);
  try{index.register(restored,false);assert.equal(index.active(),runId);assert.equal(index.catalog(restored).checkpoints.length,2);writeFileSync(index.checkpointPath(checkpoint.id),'damaged');assert.throws(()=>index.fork(checkpoint.id,'Invalid'),/damaged/);assert.equal(index.catalog(restored).runs.length,1);assert.equal(restored.players()[0].party.length,1);assert.throws(()=>index.checkpointPath('../world.sqlite'),/Invalid/);}finally{restored.close();index.close();}
});

test('host APIs create default checkpoints, fork and resume distinct preview saves, and reject public/guest save administration',{timeout:20000},async()=>{
  let app=await createGameServer({dataDir:root(),port:0,adminPort:0,host:'127.0.0.1',preview:true});const directory=app.store.root;
  const post=(server:typeof app,path:string,data:unknown={},local=true)=>fetch(`http://127.0.0.1:${local?server.adminPort:server.port}`+path,{method:'POST',headers:{'content-type':'application/json','x-host-token':server.hostToken},body:JSON.stringify(data)});
  try{
    const joined=await(await post(app,'/api/join')).json(),runId=app.store.meta('runId')!;
    const initial=await(await fetch(`http://127.0.0.1:${app.adminPort}/api/saves`,{headers:{'x-host-token':app.hostToken}})).json();assert.equal(initial.checkpoints.length,1);assert.equal(initial.currentRunId,runId);
    assert.equal((await fetch(`http://127.0.0.1:${app.port}/api/saves`,{headers:{'x-host-token':app.hostToken}})).status,403);
    assert.equal((await post(app,'/api/host/saves/new',{name:'Unauthorized'},false)).status,403);
    app.world.apply(joined.playerId,randomUUID(),{kind:'intro'});app.world.apply(joined.playerId,randomUUID(),{kind:'starter',species:'charmander'});
    const checkpoint=(await(await post(app,'/api/host/saves/checkpoint',{name:'Partner chosen',requestId:randomUUID()})).json()).checkpoint;
    const p=app.store.player(joined.playerId)!;p.coins=500;app.store.savePlayer(p);
    app.world.online.add('guest');assert.equal((await post(app,'/api/host/saves/fork',{checkpointId:checkpoint.id,name:'Blocked'})).status,400);app.world.online.delete('guest');
    const fork=await(await post(app,'/api/host/saves/fork',{checkpointId:checkpoint.id,name:'Earlier path'})).json();assert.ok(fork.url);const child=[...app.previewChildren][0];assert.equal(child.store.player(joined.playerId)!.coins,100);assert.equal(child.store.player(joined.playerId)!.party[0].species,'charmander');assert.equal(child.store.regions().length,5);assert.equal(child.generator.status.used,0);
    assert.equal((await post(child,'/api/join')).status,200);
    const original=await(await post(child,'/api/host/saves/open',{runId})).json();assert.ok(original.url.includes(':'+app.adminPort));assert.equal(app.store.player(joined.playerId)!.coins,500);
    await post(app,'/api/host/saves/open',{runId:fork.runId});await app.close();
    app=await createGameServer({dataDir:directory,port:0,adminPort:0,host:'127.0.0.1',preview:true});const resume=await(await post(app,'/api/host/resume')).json();assert.equal(resume.redirect,true);const recovered=[...app.previewChildren][0];assert.equal(recovered.store.meta('runId'),fork.runId);assert.equal(recovered.store.player(joined.playerId)!.coins,100);
  }finally{await app.close();}
});
