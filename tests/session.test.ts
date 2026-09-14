import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import WebSocket from 'ws';
import { createGameServer } from '../game/server/index.js';

type App=Awaited<ReturnType<typeof createGameServer>>;
const admin=(app:App)=>`http://127.0.0.1:${app.adminPort}`;
const pub=(app:App)=>`http://127.0.0.1:${app.port}`;
function post(app:App,path:string,data:unknown={},local=true,hostHeader=true){return fetch((local?admin(app):pub(app))+path,{method:'POST',headers:{'content-type':'application/json',...(hostHeader?{'x-host-token':app.hostToken}:{})},body:JSON.stringify(data)});}
async function start(app:App,sessionMode?:'singleplayer'|'multiplayer'){
  await post(app,'/api/host/connect');await post(app,'/api/host/verify',{consent:true,limit:100});
  assert.equal((await post(app,'/api/host/start',sessionMode?{sessionMode}:{})).status,202);assert.equal(app.ready,true);
}
function connect(base:string,token:string){return new Promise<WebSocket>((done,fail)=>{
  const ws=new WebSocket(base.replace('http','ws')+'/play'),timer=setTimeout(()=>{ws.terminate();fail(new Error('Socket did not enter the game.'));},2500);
  ws.on('open',()=>ws.send(JSON.stringify({type:'auth',token})));
  ws.on('message',raw=>{const message=JSON.parse(raw.toString());if(message.type==='state'){clearTimeout(timer);done(ws);}else if(message.type==='error'){clearTimeout(timer);ws.terminate();fail(new Error(message.message));}});
  ws.on('error',error=>{clearTimeout(timer);fail(error);});ws.on('close',()=>clearTimeout(timer));
});}
function deniedPublicSocket(app:App,token:string){return new Promise<number>((done,fail)=>{
  const ws=new WebSocket(pub(app).replace('http','ws')+'/play'),timer=setTimeout(()=>{ws.terminate();fail(new Error('Admission was not denied.'));},2500);
  ws.on('unexpected-response',(_req,response)=>{clearTimeout(timer);done(response.statusCode!);response.resume();ws.terminate();});ws.on('error',()=>{});
  ws.on('open',()=>{ws.send(JSON.stringify({type:'auth',token}));clearTimeout(timer);ws.terminate();fail(new Error('Public socket opened in single-player mode.'));});
});}

test('single-player host admission and automatic save resume require the local host authority',{timeout:20_000},async()=>{
  const root=resolve('.test-data',randomUUID());let app=await createGameServer({dataDir:root,port:0,adminPort:0,host:'127.0.0.1',fixture:true});
  try{
    assert.equal((await(await fetch(pub(app)+'/api/info')).json()).sessionMode,'singleplayer');await start(app);
    assert.equal((await post(app,'/api/join',{name:'Guest'},false)).status,403);
    assert.equal((await post(app,'/api/join',{},true,false)).status,403);
    const host=await(await post(app,'/api/join')).json();assert.ok(host.playerId&&host.token);assert.equal(host.resumed,false);assert.equal(app.store.player(host.playerId)!.name,'Trainer');
    app.world.apply(host.playerId,randomUUID(),{kind:'intro'});app.world.apply(host.playerId,randomUUID(),{kind:'starter',species:'bulbasaur'});
    const same=await(await post(app,'/api/join',{token:host.token})).json();assert.equal(same.playerId,host.playerId);assert.equal(same.token,host.token);assert.equal(same.resumed,true);
    const automatic=await(await post(app,'/api/join')).json();assert.equal(automatic.playerId,host.playerId);assert.notEqual(automatic.token,host.token);assert.equal(app.store.byToken(host.token),undefined);assert.equal(app.store.players().length,1);
    assert.equal((await post(app,'/api/join',{token:automatic.token},false)).status,403);assert.equal(await deniedPublicSocket(app,automatic.token),403);
    await connect(admin(app),automatic.token);await app.close();
    app=await createGameServer({dataDir:root,port:0,adminPort:0,host:'127.0.0.1',fixture:true});await start(app);
    const restored=await(await post(app,'/api/join')).json();assert.equal(restored.playerId,host.playerId);assert.equal(app.store.player(restored.playerId)!.party[0].species,'bulbasaur');assert.equal(app.store.players().length,1);
  }finally{await app.close();}
});

test('the host opens address-only multiplayer and can return to solo without erasing guests or regenerating maps',{timeout:20_000},async()=>{
  const app=await createGameServer({dataDir:resolve('.test-data',randomUUID()),port:0,adminPort:0,host:'127.0.0.1',fixture:true});
  try{
    await start(app);const host=await(await post(app,'/api/join')).json();await connect(admin(app),host.token);await app.generator.pump();
    const used=app.generator.status.used,hashes=app.store.regions().map(r=>r.hash);
    assert.equal((await post(app,'/api/host/session',{sessionMode:'multiplayer'},false)).status,403);
    const opened=await(await post(app,'/api/host/session',{sessionMode:'multiplayer'})).json();assert.equal(opened.sessionMode,'multiplayer');assert.ok(opened.publicUrl.includes(String(app.port)));assert.equal(app.generator.status.used,used);assert.deepEqual(app.store.regions().map(r=>r.hash),hashes);
    const info=await(await fetch(pub(app)+'/api/info')).json();assert.equal(info.sessionMode,'multiplayer');
    const invalid=await post(app,'/api/join',{token:'unknown-browser-save'},false,false);assert.equal(invalid.status,401);assert.equal((await invalid.json()).code,'INVALID_SESSION');
    const bootstrap=await(await fetch(admin(app)+'/api/bootstrap')).json();assert.equal(bootstrap.invite,undefined);assert.ok(bootstrap.publicUrl);
    const guest=await(await post(app,'/api/join',{name:'Misty'},false,false)).json();assert.ok(guest.token&&guest.playerId);const guestSocket=await connect(pub(app),guest.token);
    const resumed=await(await post(app,'/api/join',{token:guest.token},false,false)).json();assert.equal(resumed.playerId,guest.playerId);assert.equal(resumed.resumed,true);assert.equal(app.world.online.size,2);
    const closedSocket=new Promise<void>(done=>guestSocket.once('close',()=>done()));
    const closed=await(await post(app,'/api/host/session',{sessionMode:'singleplayer'})).json();assert.equal(closed.disconnected,1);await closedSocket;
    assert.equal(app.world.online.has(host.playerId),true);assert.equal(app.world.online.has(guest.playerId),false);assert.ok(app.store.byToken(guest.token));
    const soloDenied=await post(app,'/api/join',{token:guest.token},false,false);assert.equal(soloDenied.status,403);assert.equal((await soloDenied.json()).code,undefined);assert.equal(await deniedPublicSocket(app,guest.token),403);
    assert.equal((await fetch(pub(app)+'/api/maps',{headers:{authorization:'Bearer '+guest.token}})).status,403);
    await post(app,'/api/host/session',{sessionMode:'multiplayer'});const returning=await(await post(app,'/api/join',{token:guest.token},false,false)).json();assert.equal(returning.playerId,guest.playerId);await connect(pub(app),guest.token);
    assert.equal((await post(app,'/api/join',{token:host.token},false,false)).status,403);
    app.generator.verified=false;const unavailable=await post(app,'/api/join',{name:'Brock'},false,false);assert.equal(unavailable.status,400);assert.equal((await unavailable.json()).code,undefined);assert.ok(app.store.byToken(guest.token));assert.equal((await post(app,'/api/host/session',{sessionMode:'singleplayer'})).status,200);assert.equal((await post(app,'/api/host/session',{sessionMode:'multiplayer'})).status,400);
  }finally{await app.close();}
});
