import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createGameServer} from '../game/server/index.js';
import {SaveLibrary} from '../game/server/saves.js';
import {CodexTransport,type RunResult} from '../game/server/harness.js';

test('full reset erases the entire local library and settings, rejects invalid requests, and preserves unrelated files',async()=>{
  const root=resolve('.test-data','reset-'+randomUUID());const app=await createGameServer({dataDir:root,port:0,adminPort:0,preview:true,fixture:true});
  const post=(path:string,data:unknown,port=app.adminPort,token=app.hostToken)=>fetch(`http://127.0.0.1:${port}/api/host/${path}`,{method:'POST',headers:{'content-type':'application/json','x-host-token':token},body:JSON.stringify(data)});
  try{
    const player=app.world.createPlayer('Old trainer').player;app.store.setMeta('hostPlayerId',player.id);app.store.setMeta('renderDepth','3');app.store.setMeta('generationBatchSize','7');app.store.setMeta('hostConsent',JSON.stringify({acceptedAt:1,version:1,mode:'test'}));
    const library=new SaveLibrary(root);const checkpoint=library.save(app.store,'Old checkpoint',randomUUID());library.fork(checkpoint.id,'Old branch');library.close();
    for(const name of ['generated-content','generation','context','harness','backups']){mkdirSync(join(root,name),{recursive:true});writeFileSync(join(root,name,'old.txt'),'old game content');}
    writeFileSync(join(root,'my-notes.txt'),'keep this');const oldWorld=app.store.meta('worldId');
    assert.equal((await post('reset-game',{confirmation:'RESET'},app.port)).status,403);
    assert.equal((await post('reset-game',{confirmation:'RESET'},app.adminPort,'invalid')).status,403);
    assert.equal((await post('reset-game',{confirmation:'reset'})).status,400);assert.equal(app.store.players().length,1);
    const response=await post('reset-game',{confirmation:'RESET'});assert.equal(response.status,200);assert.equal((await response.json()).reset,true);
    assert.notEqual(app.store.meta('worldId'),oldWorld);assert.equal(app.store.players().length,0);assert.equal(app.store.regions().length,0);assert.equal(app.store.meta('hostConsent'),null);assert.equal(app.world.renderDepth(),1);assert.equal(app.generator.batchSize(),3);assert.equal(app.generator.verified,false);assert.equal(app.ready,false);assert.equal(app.preview,false);
    const fresh=new SaveLibrary(root);assert.equal(fresh.catalog(app.store).runs.length,1);assert.equal(fresh.catalog(app.store).checkpoints.length,0);fresh.close();assert.equal(existsSync(join(root,'save-library','checkpoints',checkpoint.id+'.sqlite')),false);
    for(const name of ['generated-content','generation','context','harness','backups'])assert.equal(existsSync(join(root,name,'old.txt')),false);
    assert.equal(readFileSync(join(root,'my-notes.txt'),'utf8'),'keep this');
    assert.equal((await post('preview',{})).status,200);
  }finally{await app.close();}
});

class HangingTransport extends CodexTransport {
  started=false;rejectJob?: (error:Error)=>void;
  override run(){this.started=true;return new Promise<RunResult>((_resolve,reject)=>{this.rejectJob=reject;});}
  override async close(){this.rejectJob?.(new Error('Harness is shutting down.'));}
}
test('reset cancels active generation and closes all child runs before deleting their data',async()=>{
  const root=resolve('.test-data','reset-live-'+randomUUID()),app=await createGameServer({dataDir:root,port:0,adminPort:0,fixture:true});
  const post=(port:number,token:string,path:string,data:unknown)=>fetch(`http://127.0.0.1:${port}/api/host/${path}`,{method:'POST',headers:{'content-type':'application/json','x-host-token':token},body:JSON.stringify(data)});
  try{
    const preview=await(await post(app.adminPort,app.hostToken,'preview',{})).json();const child=await(await fetch(preview.previewUrl+'/api/bootstrap')).json();
    assert.equal((await post(Number(new URL(preview.previewUrl).port),child.hostToken,'reset-game',{confirmation:'RESET'})).status,400);
    const transport=new HangingTransport(root);app.generator.fixture=false;app.generator.transport=transport;app.generator.verified=true;const oldGenerator=app.generator;app.world.ensureRegion(1,0);const pending=oldGenerator.generate('1,0');assert.equal(transport.started,true);
    const response=await post(app.adminPort,app.hostToken,'reset-game',{confirmation:'RESET'});assert.equal(response.status,200);await pending;
    assert.notEqual(app.generator,oldGenerator);assert.equal(app.store.regions().length,0);assert.equal(app.generator.queue.length,0);assert.equal(existsSync(join(root,'previews')),false);
    await assert.rejects(fetch(preview.previewUrl+'/api/info'));
  }finally{await app.close();}
});
