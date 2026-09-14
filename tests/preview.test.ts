import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createGameServer,type GameServer } from '../game/server/index.js';
import { CodexTransport } from '../game/server/harness.js';
import { HEIGHT,type Action } from '../game/shared/model.js';
import { GameError } from '../game/engine/world.js';
import {command,visit,travel as travelWorld,walkTo} from './game-helpers.js';

const local=(app:GameServer)=>`http://127.0.0.1:${app.adminPort}`;
function post(app:GameServer,path:string,value:unknown={}){return fetch(local(app)+path,{method:'POST',headers:{'content-type':'application/json','x-host-token':app.hostToken},body:JSON.stringify(value)});}
function act(app:GameServer,pid:string,action:Action){return command(app.world,pid,action);}
function guide(app:GameServer,pid:string){visit(app.world,pid);}
function travel(app:GameServer,pid:string,direction:'north'|'south'){travelWorld(app.world,pid,direction);}
function win(app:GameServer,pid:string){for(let i=0;i<40&&!app.store.player(pid)!.battle!.finished;i++)act(app,pid,{kind:'battle',action:'attack'});assert.equal(app.store.player(pid)!.battle!.won,true);act(app,pid,{kind:'battle',action:'close'});}
class ProbeOnlyTransport extends CodexTransport {
  probes=0;
  async connect(){}
  async rpc(){return {account:{type:'chatgpt'}};}
  async run(prompt:string){assert.ok(prompt.startsWith('Return exactly this JSON: '));const confirmation=JSON.parse(prompt.slice('Return exactly this JSON: '.length));assert.equal(confirmation.status,'ok');assert.equal(typeof confirmation.nonce,'string');this.probes++;return {output:confirmation,usage:null,duration:1};}
}

test('production preview loads one isolated finite pack, completes tutorials through revisits, and makes no harness calls',{timeout:20_000},async()=>{
  const main=await createGameServer({dataDir:resolve('.test-data',randomUUID()),port:0,adminPort:0,host:'127.0.0.1',fixture:true});
  try{
    main.world.warmStart();const original=main.world.createPlayer('Original').player;main.store.setMeta('choice','protect');const rootHashes=main.store.regions().map(r=>r.hash),rootSeq=main.store.sequence();
    const requests=await Promise.all([post(main,'/api/host/preview'),post(main,'/api/host/preview')]);const urls=await Promise.all(requests.map(response=>response.json()));assert.equal(urls[0].previewUrl,urls[1].previewUrl);assert.equal(main.previewChildren.size,1);
    const child=[...main.previewChildren][0];assert.equal(child.preview,true);assert.equal(child.generator.fixture,false);assert.equal(child.generator.transport.child,null);assert.equal(child.generator.status.mode,'preview');assert.equal(child.ready,true);
    const joined=await(await post(child,'/api/join')).json(),pid=joined.playerId;assert.ok(pid);assert.equal(child.store.regions().length,5);assert.equal(child.world.view(pid,child.generator.status).preview,true);
    assert.deepEqual(main.store.regions().map(r=>r.hash),rootHashes);assert.equal(main.store.sequence(),rootSeq);assert.equal(main.store.player(original.id)!.tutorial,0);assert.equal(main.store.meta('choice'),'protect');assert.equal(child.store.meta('choice'),null);
    assert.equal((await post(child,'/api/host/start')).status,400);assert.equal((await post(child,'/api/host/session',{sessionMode:'multiplayer'})).status,400);
    assert.equal((await fetch(`http://127.0.0.1:${child.port}/api/join`,{method:'POST',headers:{'content-type':'application/json'},body:'{"name":"Guest"}'})).status,403);
    act(child,pid,{kind:'intro'});act(child,pid,{kind:'starter',species:'bulbasaur'});guide(child,pid);act(child,pid,{kind:'talk'});assert.equal(child.store.player(pid)!.tutorial,1);
    travel(child,pid,'south');act(child,pid,{kind:'encounter'});win(child,pid);assert.equal(child.store.player(pid)!.tutorial,2);
    walkTo(child.world,pid,{x:16,y:HEIGHT-1});const before=child.store.player(pid)!;
    const boundary=act(child,pid,{kind:'move',direction:'south'});assert.equal(boundary.code,'PREVIEW_BOUNDARY');assert.equal(boundary.movement?.accepted,false);assert.equal(child.store.player(pid)!.regionId,before.regionId);assert.equal(child.store.regions().length,5);
    travel(child,pid,'north');act(child,pid,{kind:'talk'});act(child,pid,{kind:'encounter'});
    while(child.store.player(pid)!.battle!.enemy.hp>child.store.player(pid)!.battle!.enemy.maxHp*.6)act(child,pid,{kind:'battle',action:'attack'});
    act(child,pid,{kind:'battle',action:'capture'});assert.equal(child.store.player(pid)!.tutorial,3);act(child,pid,{kind:'battle',action:'close'});
    travel(child,pid,'south');act(child,pid,{kind:'heal'});act(child,pid,{kind:'switch',index:1});assert.equal(child.store.player(pid)!.tutorial,4);
    travel(child,pid,'north');visit(child.world,pid,'trainer');act(child,pid,{kind:'trainer'});win(child,pid);guide(child,pid);act(child,pid,{kind:'choice',choice:'explore'});assert.equal(child.store.player(pid)!.tutorial,5);
    for(let n=0;n<6;n++)act(child,pid,{kind:'talk'});
    assert.throws(()=>act(child,pid,{kind:'coop'}),(error:unknown)=>error instanceof GameError&&error.code==='PREVIEW_BOUNDARY');
    assert.equal(child.store.regions().length,5);assert.equal(child.generator.status.used,0);assert.equal(child.generator.status.queued,0);assert.equal(child.generator.transport.child,null);assert.equal(child.store.db.prepare('SELECT COUNT(*) n FROM jobs').get()!.n,0);
    assert.equal(main.store.player(original.id)!.tutorial,0);assert.equal(main.store.meta('choice'),'protect');
  }finally{await main.close();}
});

test('verified promotion preserves the preview save, and parent restart retains its origin and internal trainer identity',{timeout:20_000},async()=>{
  const previousPublicUrl=process.env.INFINITE_PUBLIC_URL;process.env.INFINITE_PUBLIC_URL='https://parent-world.example';
  const dataDir=resolve('.test-data',randomUUID());let main=await createGameServer({dataDir,port:0,adminPort:0,host:'127.0.0.1',fixture:true});let blocker:ReturnType<typeof createServer>|undefined;
  try{
    const preview=await(await post(main,'/api/host/preview')).json(),child=[...main.previewChildren][0],joined=await(await post(child,'/api/join')).json();
    assert.equal((await(await fetch(local(main)+'/api/bootstrap')).json()).publicUrl,'https://parent-world.example');assert.ok((await(await fetch(local(child)+'/api/bootstrap')).json()).publicUrl.includes(String(child.port)));
    act(child,joined.playerId,{kind:'intro'});act(child,joined.playerId,{kind:'starter',species:'squirtle'});const hashes=child.store.regions().map(r=>r.hash);
    const probe=new ProbeOnlyTransport(child.store.root);child.generator.transport=probe;child.generator.paused=true;
    assert.equal((await post(child,'/api/host/verify',{consent:false,limit:10})).status,400);assert.equal(probe.probes,0);assert.equal(child.preview,true);
    assert.equal((await post(child,'/api/host/verify',{consent:true,limit:10})).status,200);assert.equal(probe.probes,1);assert.equal(child.preview,true);
    assert.equal((await post(child,'/api/host/start',{sessionMode:'singleplayer'})).status,200);assert.equal(child.preview,false);assert.equal(child.world.allowedRegions,undefined);assert.deepEqual(child.store.regions().map(r=>r.hash),hashes);assert.equal(child.store.player(joined.playerId)!.party[0].species,'squirtle');
    child.world.ensureRegion(0,2);assert.equal(child.store.regions().length,6);assert.equal((await post(child,'/api/host/session',{sessionMode:'multiplayer'})).status,200);
    const id=main.store.meta('latestPreviewId')!;assert.match(id,/^[a-f0-9-]{36}$/);const savedPorts=JSON.parse(main.store.meta('previewPorts:'+id)!);assert.equal(savedPorts.adminPort,child.adminPort);assert.equal(savedPorts.port,child.port);await main.close();
    blocker=createServer();await new Promise<void>(done=>blocker!.listen(savedPorts.adminPort,'127.0.0.1',done));
    main=await createGameServer({dataDir,port:0,adminPort:0,host:'127.0.0.1',fixture:true});const collision=await post(main,'/api/host/resume');assert.equal(collision.status,400);assert.match((await collision.json()).error,/local ports could not be opened/);assert.equal(main.store.meta('previewPorts:'+id),JSON.stringify(savedPorts));await new Promise<void>(done=>blocker!.close(()=>done()));blocker=undefined;
    const resumed=await(await post(main,'/api/host/resume')).json();assert.equal(resumed.url,preview.previewUrl);assert.equal(resumed.preview,false);const restored=[...main.previewChildren][0];assert.equal(restored.store.byToken(joined.token)!.id,joined.playerId);assert.equal(restored.store.player(joined.playerId)!.party[0].species,'squirtle');assert.equal(restored.ready,false);assert.equal(restored.generator.verified,false);
    const fresh=await(await post(main,'/api/host/preview')).json();assert.notEqual(fresh.previewUrl,preview.previewUrl);assert.notEqual(main.store.meta('latestPreviewId'),id);assert.equal(main.previewChildren.size,2);assert.ok(restored.store.player(joined.playerId));
  }finally{if(blocker)await new Promise<void>(done=>blocker!.close(()=>done()));await main.close();if(previousPublicUrl===undefined)delete process.env.INFINITE_PUBLIC_URL;else process.env.INFINITE_PUBLIC_URL=previousPublicUrl;}
});
