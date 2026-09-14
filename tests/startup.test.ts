import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createGameServer } from '../game/server/index.js';

test('verified play begins on validated maps before enrichment, while configuration stays locked and failures preserve play',{timeout:15_000},async()=>{
  const app=await createGameServer({dataDir:resolve('.test-data',randomUUID()),port:0,adminPort:0,host:'127.0.0.1',fixture:true});
  const base=`http://127.0.0.1:${app.adminPort}`,post=(path:string,value:unknown)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-host-token':app.hostToken},body:JSON.stringify(value),signal:AbortSignal.timeout(2000)});
  let release!:()=>void,unlockVerification:(()=>void)|undefined,reject!: (error:Error)=>void,calls=0;app.generator.initial=()=>{calls++;return new Promise<void>((done,fail)=>{release=done;reject=fail;});};
  try{
    await app.generator.connect();await app.generator.verify(true,10);
    const originalVerify=app.generator.verify.bind(app.generator);let enteredVerification!:()=>void;
    const entered=new Promise<void>(done=>{enteredVerification=done;});app.generator.verify=async()=>{enteredVerification();await new Promise<void>(done=>{unlockVerification=done;});};
    const verification=post('/api/host/verify',{consent:true,limit:10});await entered;
    assert.equal((await post('/api/host/start',{})).status,400);assert.equal((await post('/api/host/budget',{limit:10})).status,400);
    unlockVerification!();assert.equal((await verification).status,200);app.generator.verify=originalVerify;
    assert.equal((await post('/api/host/start',{})).status,202);assert.equal(app.ready,true);assert.equal(app.store.regions().length,5);assert.equal(app.store.region('0,0')!.published,true);
    assert.equal((await(await fetch(base+'/api/bootstrap')).json()).starting,true);
    assert.equal((await post('/api/host/start',{})).status,200);assert.equal(calls,1);
    for(const path of ['connect','login','verify','budget'])assert.equal((await post('/api/host/'+path,{consent:true,limit:10})).status,400);
    assert.equal((await post('/api/join',{})).status,200);
    assert.equal((await post('/api/host/session',{sessionMode:'multiplayer'})).status,200);
    assert.equal((await post('/api/host/session',{sessionMode:'singleplayer'})).status,200);
    reject(new Error('Simulated generation failure'));await new Promise(r=>setTimeout(r,10));
    const failed=await(await fetch(base+'/api/bootstrap')).json();assert.equal(failed.starting,false);assert.match(failed.startupError,/Simulated/);assert.equal(app.ready,true);
    assert.equal((await post('/api/host/start',{})).status,200);assert.equal(calls,1);
    const ready=await(await fetch(base+'/api/bootstrap')).json();assert.equal(ready.ready,true);assert.equal(ready.starting,false);
  }finally{unlockVerification?.();release?.();await app.close();}
});
