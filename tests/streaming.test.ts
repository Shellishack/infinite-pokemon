import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {Generator} from '../game/server/harness.js';
import {MapStreaming} from '../game/server/streaming.js';
import {mapPrepared,surroundingMapCount} from '../game/shared/streaming.js';
import {createGameServer} from '../game/server/index.js';

function fixture(){const store=new Store(resolve('.test-data','stream-'+randomUUID()));store.setMeta('renderDepth','0');const world=new World(store);world.warmStart();const {player}=world.createPlayer('Trainer');store.setMeta('hostPlayerId',player.id);world.apply(player.id,randomUUID(),{kind:'intro'});world.apply(player.id,randomUUID(),{kind:'starter',species:'bulbasaur'});const p=store.player(player.id)!;p.tutorial=1;store.savePlayer(p);world.online.add(p.id);const generator=new Generator(store,true),stream=new MapStreaming(world,generator,()=>false);world.onFrontier=()=>stream.refresh();return {store,world,generator,stream,pid:p.id};}
test('background indicator counts active and queued maps, distinguishes stops, and ignores NPC work and preview',async()=>{
  const {store,generator,stream,pid}=fixture();
  try{
    assert.equal(stream.view(pid).background,undefined);
    generator.npcQueue.push('guide');generator.status.state='working';
    assert.equal(stream.view(pid).background,undefined);
    generator.queue=['1,0'];generator.mapJobs.set('0,1',{phase:'generating',startedAt:Date.now()});
    assert.deepEqual(stream.view(pid).background,{active:1,queued:1,phase:'generating'});
    generator.queue=[];assert.deepEqual(stream.view(pid).background,{active:1,queued:0,phase:'generating'});
    generator.mapJobs.clear();assert.equal(stream.view(pid).background,undefined);
    generator.mapJobs.set('0,1',{phase:'failed',startedAt:0});assert.equal(stream.view(pid).background,undefined);
    generator.queue=['1,0'];assert.equal(stream.view(pid).background?.phase,'disconnected');
    generator.verified=true;generator.paused=true;assert.equal(stream.view(pid).background?.phase,'paused');
    generator.paused=false;generator.status.limit=0;assert.equal(stream.view(pid).background?.phase,'budget');
    assert.equal(new MapStreaming(stream.world,generator,()=>true).view(pid).background,undefined);
  }finally{await generator.close();store.close();}
});
test('depths 0–3 cover unique Manhattan layers and prune unstarted jobs while retaining cached maps',async()=>{
  const {store,world,generator,stream}=fixture();
  try{
    const origin=store.region('0,0')!;assert.equal(world.renderDepth(),0);assert.equal(store.regions().length,1);
    for(const depth of [0,1,2,3]){store.setMeta('renderDepth',String(depth));stream.refresh();const plan=stream.plan();assert.equal(plan.length,surroundingMapCount(depth));assert.equal(new Set(plan.map(r=>r.id)).size,plan.length);const distances=plan.map(r=>Math.abs(r.gx)+Math.abs(r.gy));assert.deepEqual(distances,[...distances].sort((a,b)=>a-b));}
    const cached=store.region('1,0')!;cached.prepared=true;store.saveRegion(cached);stream.refresh();assert.ok(!generator.queue.includes(cached.id));
    store.setMeta('renderDepth','1');stream.refresh();assert.equal(generator.queue.length,3);assert.equal(store.regions().length,25);assert.equal(mapPrepared(store.region(cached.id)),true);
    store.setMeta('renderDepth','0');stream.refresh();assert.equal(generator.queue.length,0);assert.equal(world.neighbors(origin).length,0);
  }finally{await generator.close();store.close();}
});
test('multiplayer frontiers deduplicate overlapping blocks and prioritize minimum distance to online players',async()=>{
  const {store,world,generator,stream}=fixture();
  try{
    store.setMeta('renderDepth','2');const {player}=world.createPlayer('Guest');const second=store.region('2,0')!;second.published=true;store.saveRegion(second);player.regionId=second.id;store.savePlayer(player);world.online.add(player.id);stream.refresh();
    const queue=generator.queue.map(id=>store.region(id)!);assert.equal(new Set(generator.queue).size,queue.length);const distances=queue.map(r=>Math.min(Math.abs(r.gx)+Math.abs(r.gy),Math.abs(r.gx-2)+Math.abs(r.gy)));assert.deepEqual(distances,[...distances].sort((a,b)=>a-b));assert.ok(distances.every(distance=>distance<=2));
    world.online.delete(player.id);stream.refresh();assert.ok(generator.queue.every(id=>{const r=store.region(id)!;return Math.abs(r.gx)+Math.abs(r.gy)<=2;}));
  }finally{await generator.close();store.close();}
});
test('depth zero gates unfinished travel, exposes waiting reasons, auto-enters on completion and never regenerates cached destinations',async()=>{
  const {store,world,generator,stream,pid}=fixture();
  try{
    const p=store.player(pid)!;p.x=31;p.y=12;store.savePlayer(p);
    const waiting=world.apply(pid,randomUUID(),{kind:'move',direction:'east'});assert.equal(waiting.code,'MAP_LOADING');assert.equal(store.player(pid)!.regionId,'0,0');assert.equal(store.region('1,0')!.published,false);assert.equal(stream.view(pid).travel!.phase,'disconnected');assert.equal(generator.queue.length,1);
    generator.verified=true;generator.paused=true;assert.equal(stream.view(pid).travel!.phase,'paused');generator.paused=false;generator.status.limit=0;assert.equal(stream.view(pid).travel!.phase,'budget');
    generator.status.limit=10;await generator.pump();assert.equal(stream.view(pid).travel!.phase,'ready');stream.tick();assert.equal(store.player(pid)!.regionId,'1,0');assert.equal(stream.pending.size,0);assert.equal(generator.status.used,1);
    stream.refresh();await generator.pump();assert.equal(generator.status.used,1);assert.equal(generator.queue.length,0);
  }finally{await generator.close();store.close();}
});
test('cancelled travel does not warp when the map later becomes ready; failed jobs require an explicit retry',async()=>{
  const {store,world,generator,stream,pid}=fixture();
  try{
    const p=store.player(pid)!;p.x=31;p.y=12;store.savePlayer(p);world.apply(pid,randomUUID(),{kind:'move',direction:'east'});
    generator.mapJobs.set('1,0',{phase:'failed',startedAt:0});stream.refresh();assert.equal(stream.view(pid).travel!.phase,'failed');assert.equal(generator.queue.length,0);stream.retry(pid);assert.deepEqual(generator.queue,['1,0']);
    stream.cancel(pid);assert.equal(generator.queue.length,0);const r=store.region('1,0')!;r.prepared=true;store.saveRegion(r);stream.tick();assert.equal(store.player(pid)!.regionId,'0,0');
  }finally{await generator.close();store.close();}
});
test('host depth settings validate 0–3, persist per run, and preview changes never generate or allocate extra maps',async()=>{
  const root=resolve('.test-data','depth-'+randomUUID());let app=await createGameServer({dataDir:root,port:0,adminPort:0,preview:true});
  const post=(depth:unknown,local=true)=>fetch(`http://127.0.0.1:${local?app.adminPort:app.port}/api/host/render-depth`,{method:'POST',headers:{'content-type':'application/json','x-host-token':app.hostToken},body:JSON.stringify({depth})});
  try{
    assert.equal(app.world.renderDepth(),1);for(const depth of [-1,4,1.5,'3',null])assert.equal((await post(depth)).status,400);
    assert.equal((await post(3,false)).status,403);assert.equal((await post(3)).status,200);assert.equal(app.store.regions().length,5);assert.equal(app.generator.status.used,0);assert.equal(app.generator.queue.length,0);
    await app.close();app=await createGameServer({dataDir:root,port:0,adminPort:0,preview:true});assert.equal(app.world.renderDepth(),3);
  }finally{await app.close();}
});

 test('generation batch size defaults to three, is host-only, validates bounds and persists without preview generation',async()=>{
  const root=resolve('.test-data','batch-'+randomUUID());let app=await createGameServer({dataDir:root,port:0,adminPort:0,preview:true});
  const post=(batchSize:unknown,local=true)=>fetch(`http://127.0.0.1:${local?app.adminPort:app.port}/api/host/generation-batch`,{method:'POST',headers:{'content-type':'application/json','x-host-token':app.hostToken},body:JSON.stringify({batchSize})});
  try{
    assert.equal(app.generator.batchSize(),3);for(const size of [0,9,1.5,'3',null])assert.equal((await post(size)).status,400);
    assert.equal((await post(4,false)).status,403);assert.equal((await post(4)).status,200);assert.equal(app.generator.batchSize(),4);assert.equal(app.generator.status.used,0);
    await app.close();app=await createGameServer({dataDir:root,port:0,adminPort:0,preview:true});assert.equal(app.generator.batchSize(),4);
    const bootstrap=await(await fetch(`http://127.0.0.1:${app.adminPort}/api/bootstrap`)).json();assert.equal(bootstrap.generationBatchSize,4);
  }finally{await app.close();}
});
