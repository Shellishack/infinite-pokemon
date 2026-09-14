import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import WebSocket from 'ws';
import { createGameServer } from '../game/server/index.js';
import { Store } from '../game/server/store.js';
import { standFacing } from './game-helpers.js';

test('host consent gates play, guests need no CLI, private admin routes reject, and two clients synchronize',{timeout:20_000},async()=>{
  const app=await createGameServer({dataDir:resolve('.test-data',randomUUID()),port:0,adminPort:0,host:'127.0.0.1',fixture:true});
  const admin=`http://127.0.0.1:${app.adminPort}`,pub=`http://127.0.0.1:${app.port}`;const sockets:WebSocket[]=[];
  const post=(base:string,path:string,data:unknown,token=app.hostToken)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-host-token':token},body:JSON.stringify(data)});
  try{
    assert.equal((await post(admin,'/api/host/start',{})).status,400);
    assert.equal((await fetch(pub+'/api/bootstrap')).status,404);
    assert.equal((await post(admin,'/api/host/connect',{},'wrong-token')).status,403);
    assert.equal((await fetch(admin+'/api/host/connect',{method:'POST',headers:{origin:'https://unrelated.example','x-host-token':app.hostToken}})).status,403);
    assert.equal((await fetch(admin+'/api/host/connect',{method:'POST',headers:{origin:'malformed-origin','x-host-token':app.hostToken}})).status,400);
    assert.equal((await post(pub,'/api/host/verify',{consent:true,limit:10})).status,403);
    assert.equal((await post(admin,'/api/host/verify',{consent:false,limit:10})).status,400);
    await post(admin,'/api/host/connect',{});assert.equal((await post(admin,'/api/host/verify',{consent:true,limit:10})).status,200);
    assert.equal((await post(admin,'/api/host/start',{name:'x'})).status,400);assert.equal((await(await fetch(admin+'/api/bootstrap')).json()).starting,false);
    assert.equal((await post(admin,'/api/host/start',{sessionMode:'multiplayer'})).status,202);
    for(let n=0;n<100&&!app.ready;n++)await new Promise(r=>setTimeout(r,10));assert.equal(app.ready,true);
    const a=await(await post(pub,'/api/join',{name:'Ash'})).json();const b=await(await post(pub,'/api/join',{name:'Misty'})).json();assert.ok(a.token&&b.token);
    function connect(token:string){return new Promise<{ws:WebSocket;states:any[]}>(resolve=>{const ws=new WebSocket(pub.replace('http','ws')+'/play');sockets.push(ws);const states:any[]=[];ws.on('open',()=>ws.send(JSON.stringify({type:'auth',token})));ws.on('message',raw=>{const data=JSON.parse(raw.toString());if(data.type==='state'){states.push(data);resolve({ws,states});}});});}
    const ca=await connect(a.token),cb=await connect(b.token);await new Promise(r=>setTimeout(r,250));assert.equal(ca.states.at(-1).players.length,2);assert.equal(cb.states.at(-1).players.length,2);
    assert.equal(ca.states[0].region.hash,cb.states[0].region.hash);assert.equal(ca.states.at(-1).players.find((p:any)=>p.name==='Misty').party,undefined);
    const id=randomUUID();for(const action of[{kind:'intro'},{kind:'starter',species:'bulbasaur'}]){const key=action.kind==='starter'?id:randomUUID();ca.ws.send(JSON.stringify({type:'command',id:key,action}));}
    ca.ws.send(JSON.stringify({type:'command',id,action:{kind:'starter',species:'bulbasaur'}}));await new Promise(r=>setTimeout(r,250));assert.equal(app.store.player(a.playerId)!.party.length,1);assert.equal(app.store.player(b.playerId)!.party.length,0);
    app.generator.verified=false;assert.equal((await post(pub,'/api/join',{name:'Brock'})).status,400);assert.equal((await post(pub,'/api/join',{token:a.token})).status,200);
    for(const pid of [a.playerId,b.playerId]){const player=app.store.player(pid)!;Object.assign(player,{tutorial:5,introDone:true,party:[app.world.makeCreature('bulbasaur',12)]});app.store.savePlayer(player);standFacing(app.world,pid,'waystone');app.world.apply(pid,randomUUID(),{kind:'coop'});}
    const root=app.store.root;await app.close();await app.close();const restored=new Store(root);try{for(const pid of [a.playerId,b.playerId]){assert.equal(restored.player(pid)!.battle!.finished,true);assert.equal(restored.player(pid)!.coins,100);}}finally{restored.close();}
  }finally{for(const ws of sockets)ws.terminate();await app.close();}
});
