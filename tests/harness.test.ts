import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { CodexTransport,Generator,HarnessRunError } from '../game/server/harness.js';
import { Store } from '../game/server/store.js';
import { World } from '../game/engine/world.js';
import { compileRegion,fallbackStory } from '../game/engine/maps.js';
import { standFacing } from './game-helpers.js';
import {EXTRA_CREATURES} from '../game/shared/content.js';

test('map generation accepts bounded creature, item and vehicle recipes and preserves their definitions',async()=>{
  const {store,world,transport,generator}=fixture();try{
    const pending=generator.generate('0,1');await transport.started();const output=transport.output(),{id,source,...blueprint}=EXTRA_CREATURES[3];
    transport.complete({...output,story:{...output.story,creatures:[{...blueprint,name:'Citrine Wisp'}],shopGoods:[{name:'Valley Tonic',description:'A tonic made from the local spring herbs.',effect:'heal',tier:2,icon:'bottle',color:'#78ac87'}],vehicles:[{name:'Trail Scooter',description:'A compact ride for the winding valley paths.',form:'scooter',color:'#7298bb',speedTier:1}],npcTraits:{temperament:'patient',interest:'research',quirk:'Keeps a notebook of unusual footprints.'}}});
    await pending;assert.equal(generator.status.completed,1);const catalog=world.content.region(store.region('0,1')!);assert.equal(catalog.creatures[0].name,'Citrine Wisp');assert.equal(catalog.items[0].power,50);assert.equal(catalog.vehicles[0].stepMs,110);assert.equal(store.region('0,1')!.npcTraits!.interest,'research');
  }finally{await generator.close();store.close();}
});

// Pure in-process app-server protocol fixture. Never starts a CLI or calls a model.
class ProtocolFixture extends CodexTransport {
  calls:{method:string;params:any}[]=[];
  starts:{threadId:string;turnId:string;params:any}[]=[];
  lowSupported=true;
  rejectTurnAcknowledgement=false;
  async connect(){}
  async rpc(method:string,params:any):Promise<any>{
    this.calls.push({method,params});
    if(method==='thread/start')return {thread:{id:randomUUID()},model:'host-configured-model'};
    if(method==='model/list')return {data:[{id:'host-configured-model',model:'host-configured-model',supportedReasoningEfforts:this.lowSupported?[{reasoningEffort:'low'}]:[{reasoningEffort:'high'}]}]};
    if(method==='turn/start'){const start={threadId:params.threadId,turnId:randomUUID(),params};this.starts.push(start);this.emit('fixture/started');if(this.rejectTurnAcknowledgement)throw new Error('The turn acknowledgement was lost.');return {turn:{id:start.turnId}};}
    if(method==='turn/interrupt')return {};
    if(method==='account/read')return {account:{type:'chatgpt'}};
    return {};
  }
  async started(count=1){if(this.starts.length>=count)return;await new Promise<void>(done=>this.once('fixture/started',done));}
  input(index=this.starts.length-1){const prompt=this.starts[index].params.input[0].text as string;return (prompt.match(/"(?:\\.|[^"\\])*"/g)??[]).map(text=>JSON.parse(text)).filter(path=>typeof path==='string'&&path.endsWith('.json')) as string[];}
  output(index=this.starts.length-1){
    const prompt=this.starts[index].params.input[0].text as string;if(prompt.startsWith('Return exactly this JSON: '))return JSON.parse(prompt.slice('Return exactly this JSON: '.length));
    const paths=this.input(index),contextPath=paths.find(path=>path.endsWith('context.json'));
    if(contextPath){const context=JSON.parse(readFileSync(contextPath,'utf8'));return {snapshotId:context.snapshotId,story:fallbackStory(context.request.gx,context.request.gy,context.world.seed)};}
    if(paths.some(path=>path.endsWith('verification.json')))return {...JSON.parse(readFileSync(paths[0],'utf8')),status:'ok'};
    return {action:'rest',intention:'Offer a rest to the tired traveler.',dialogue:'You have traveled far. Rest here with your companions.',memory:'A traveler arrived at the crossroads.'};
  }
  usage(index=this.starts.length-1){const {threadId,turnId}=this.starts[index];this.emit('thread/tokenUsage/updated',{threadId,turnId,tokenUsage:{total:{inputTokens:123,outputTokens:12,totalTokens:135}}});}
  complete(output?:unknown,index=this.starts.length-1){const {threadId,turnId}=this.starts[index];this.usage(index);this.emit('item/completed',{threadId,item:{type:'agentMessage',text:JSON.stringify(output??this.output(index))}});this.emit('turn/completed',{threadId,turn:{id:turnId,status:'completed',items:[]}});}
}
function fixture(timeout=180_000){const root=resolve('.test-data',randomUUID()),store=new Store(root),world=new World(store);world.warmStart();const transport=new ProtocolFixture(join(root,'harness')),generator=new Generator(store,false,{transport,mapTimeoutMs:timeout});generator.verified=true;return {root,store,world,transport,generator};}

test('agent activity records scoped tool metadata, reported usage and validation without exposing raw content',async()=>{
  const {store,transport,generator}=fixture();try{
    const pending=generator.generate('0,1');await transport.started();
    const {threadId,turnId}=transport.starts[0];
    transport.emit('item/started',{threadId:'unrelated',item:{type:'commandExecution'}});
    transport.emit('item/started',{threadId,turnId,item:{type:'commandExecution',command:'SECRET COMMAND'}});
    transport.emit('item/completed',{threadId,turnId,item:{type:'commandExecution',status:'completed',aggregatedOutput:'SECRET OUTPUT'}});
    transport.emit('item/completed',{threadId,turnId,item:{type:'reasoning',text:'PRIVATE REASONING'}});
    transport.usage();
    const job=generator.agentDetails().jobs[0];assert.equal(job.model,'host-configured-model');assert.equal(job.effort,'low');assert.equal(job.state,'running');assert.equal(job.tokens?.total,135);
    assert.equal(job.events.filter(event=>event.message==='Local command started.').length,1);
    assert.doesNotMatch(JSON.stringify(generator.agentDetails()),/SECRET|PRIVATE|unrelated/);
    transport.complete();await pending;assert.equal(job.state,'complete');assert.ok(job.endedAt);assert.match(job.events.at(-1)!.message,/Validated/);
    assert.equal(transport.listenerCount('item/started'),0);
  }finally{await generator.close();store.close();}
});

test('compact snapshots hash a single aggregate while preserving human-readable context archives',()=>{
  const {store,world}=fixture();try{world.createPlayer('Ash');const snap=store.snapshot(store.region('0,1')!),manifest=JSON.parse(readFileSync(snap.path,'utf8')),text=readFileSync(snap.contextPath,'utf8'),context=JSON.parse(text);
    assert.deepEqual(Object.keys(manifest.files),['context.json']);assert.equal(manifest.files['context.json'],createHash('sha256').update(text).digest('hex'));assert.equal(context.snapshotId,snap.id);
    assert.equal(context.maps.find((r:any)=>r.id==='0,0').status,'observed');assert.equal(context.maps.find((r:any)=>r.id==='0,1').status,'planned');
    for(const file of ['world.json','players.json','maps.json','request.json'])assert.ok(manifest.archiveFiles[file]&&readFileSync(join(snap.path,'..',file),'utf8'));
    assert.equal(context.maps.some((map:any)=>'memories' in map),false);
  }finally{store.close();}
});

test('map jobs use batched context reads and supported low effort without overriding the host model',async()=>{
  const {store,transport,generator}=fixture();try{const pending=generator.generate('0,1');assert.equal(generator.generate('0,1'),pending);await transport.started();transport.complete();await pending;
    assert.equal(generator.status.used,1);assert.equal(generator.status.completed,1);assert.equal(store.region('0,1')!.source,'codex');assert.equal(transport.starts[0].params.effort,'low');
    assert.equal(transport.calls.find(c=>c.method==='thread/start')!.params.model,undefined);assert.equal(transport.starts[0].params.model,undefined);assert.equal(transport.input().length,2);assert.match(transport.starts[0].params.input[0].text,/ONE filesystem command/);
  }finally{await generator.close();store.close();}
});

test('unsupported low effort preserves the configured setting',async()=>{
  const transport=new ProtocolFixture(resolve('.test-data'));transport.lowSupported=false;const pending=transport.run('test',{},'skill',5000);await transport.started();transport.complete({ok:true});await pending;assert.equal(transport.starts[0].params.effort,undefined);await transport.close();
});

test('a timed-out map interrupts its turn, retains failed usage, and keeps its fallback',async()=>{
  const {store,transport,generator}=fixture(40);try{const before=store.region('0,1')!.hash,pending=generator.generate('0,1');await transport.started();transport.usage();await pending;
    assert.equal(generator.status.used,1);assert.equal(generator.status.failed,1);assert.equal(store.region('0,1')!.hash,before);assert.ok(transport.calls.some(call=>call.method==='turn/interrupt'));
    const job=store.db.prepare('SELECT status,data FROM jobs').get()!;assert.equal(job.status,'failed');assert.equal(JSON.parse(String(job.data)).usage.total.totalTokens,135);
    assert.equal(transport.listenerCount('turn/completed'),0);transport.complete();assert.equal(generator.status.completed,0);
  }finally{await generator.close();store.close();}
});

test('shutdown cancels a hanging pump, saves interruption once, and never writes after the database closes',async()=>{
  const {store,transport,generator}=fixture();store.setMeta('generationBatchSize','1');generator.enqueue([store.region('0,1')!,store.region('1,0')!]);await transport.started();transport.usage();await generator.close();
  assert.equal(generator.busy,false);assert.equal(generator.verified,false);assert.equal(generator.status.state,'disconnected');assert.equal(generator.status.used,1);assert.equal(generator.status.queued,0);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM jobs WHERE status='interrupted'").get()!.n,1);store.close();assert.doesNotThrow(()=>transport.complete());await generator.close();
});

test('a lost turn-start acknowledgement closes the transport rather than leaving an unknown turn running',async()=>{
  const {store,transport,generator}=fixture();transport.rejectTurnAcknowledgement=true;
  try{await generator.generate('0,1');assert.equal(generator.verified,false);assert.equal(generator.status.state,'disconnected');assert.equal(generator.status.used,1);assert.equal(generator.status.failed,1);assert.equal(transport.listenerCount('turn/completed'),0);transport.complete();assert.equal(generator.status.completed,0);}finally{await generator.close();store.close();}
});

test('referenced map changes invalidate proposals while unrelated NPC memories do not',async()=>{
  for(const changeMap of [true,false]){
    const {store,transport,generator}=fixture();try{const pending=generator.generate('0,1');await transport.started();
      if(changeMap)store.saveRegion(compileRegion(0,0,store.meta('seed')!,{...fallbackStory(0,0,store.meta('seed')!),name:'Changed source village'}));
      else{const npc=store.npc('0,0');npc.revision++;npc.memories=['An unrelated conversation'];store.saveNpc('0,0',npc);}
      transport.complete();await pending;assert.equal(generator.status.completed,changeMap?0:1);assert.equal(generator.status.failed,changeMap?1:0);
    }finally{await generator.close();store.close();}
  }
});

test('revealing a destination or changing the canonical path rejects a late proposal',async()=>{
  for(const change of ['reveal','choice']){const {store,transport,generator}=fixture();try{const pending=generator.generate('0,1');await transport.started();
    if(change==='reveal'){const region=store.region('0,1')!;region.published=true;store.saveRegion(region);}else store.setMeta('choice','protect');
    transport.complete();await pending;assert.equal(generator.status.completed,0);assert.equal(generator.status.failed,1);
  }finally{await generator.close();store.close();}}
});

test('account changes invalidate verification and cancel active content without accepting a late result',async()=>{
  const {store,transport,generator}=fixture();try{const pending=generator.generate('0,1');await transport.started();transport.emit('account/updated',{authMode:'chatgpt'});await pending;
    assert.equal(generator.verified,false);assert.equal(generator.status.state,'authenticated');transport.complete();assert.equal(generator.status.completed,0);assert.equal(generator.status.used,1);
    await generator.connect();assert.equal(generator.verified,false);
  }finally{await generator.close();store.close();}
});

test('NPC observations fence stale intentions and successful rest plans become one observable interaction',async()=>{
  const {store,world,transport,generator}=fixture();try{
    const first=generator.npc('0,0');await transport.started();const changed=store.npc('0,0');changed.revision++;store.saveNpc('0,0',changed);transport.complete();await first;assert.equal(store.npc('0,0').dialogue,undefined);assert.equal(generator.status.failed,1);
    const {player}=world.createPlayer('Ash');Object.assign(player,{introDone:true,tutorial:5,party:[world.makeCreature('bulbasaur')]});player.party[0].hp=1;store.savePlayer(player);standFacing(world,player.id,'guide');
    const pending=generator.npc('0,0');await transport.started(2);transport.complete();await pending;assert.match(store.npc('0,0').dialogue!,/Rest here/);
    const result=world.apply(player.id,randomUUID(),{kind:'talk'});assert.match(result.text!,/Rest here/);assert.equal(store.player(player.id)!.party[0].hp,store.player(player.id)!.party[0].maxHp);assert.equal(store.npc('0,0').dialogue,undefined);
    world.apply(player.id,randomUUID(),{kind:'talk'});assert.equal(store.events(30).filter(event=>event.kind==='npc-action').length,1);assert.deepEqual(world.view(player.id,generator.status).npc.memories,[]);assert.equal(generator.status.used,2);
  }finally{await generator.close();store.close();}
});

test('empty pumps can run again and fixture startup does not leave a permanently busy scheduler',async()=>{
  const root=resolve('.test-data',randomUUID()),store=new Store(root),world=new World(store),generator=new Generator(store,true);world.warmStart();try{
    await generator.connect();await generator.verify(true,20);await generator.pump();generator.enqueue([store.region('0,1')!]);await generator.pump();assert.equal(generator.status.completed,1);assert.equal(generator.busy,false);
    await generator.initial([]);generator.enqueue([store.region('1,0')!]);await generator.pump();assert.equal(generator.status.completed,2);assert.equal(generator.busy,false);
  }finally{await generator.close();store.close();}
});

async function waitForStarts(transport:ProtocolFixture,count:number){const deadline=Date.now()+3000;while(transport.starts.length<count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(transport.starts.length,count);}
test('default batches run three isolated map turns; out-of-order results refill slots without sibling invalidation',async()=>{
  const {store,transport,generator}=fixture();try{
    assert.equal(generator.batchSize(),3);const ids=['0,1','1,0','0,-1','-1,0'];generator.setMapQueue(ids.map(id=>store.region(id)!));const task=generator.pump();await waitForStarts(transport,3);
    assert.equal(generator.status.used,3);assert.equal(generator.queue.length,1);assert.equal(transport.calls.filter(call=>call.method==='model/list').length,1);assert.ok(transport.starts.every(start=>start.params.effort==='low'));
    for(let i=0;i<3;i++){const context=JSON.parse(readFileSync(transport.input(i).find(path=>path.endsWith('context.json'))!,'utf8'));assert.ok(!context.maps.some((map:any)=>ids.includes(map.id)&&map.id!==ids[i]));}
    transport.complete(undefined,1);await waitForStarts(transport,4);transport.complete(undefined,3);transport.complete(undefined,0);transport.complete(undefined,2);await task;
    assert.equal(generator.status.completed,4);assert.equal(generator.status.failed,0);assert.equal(generator.queue.length,0);assert.equal(generator.busy,false);assert.ok(ids.every(id=>store.region(id)!.prepared));
  }finally{await generator.close();store.close();}
});
test('changing batch size refills immediately, drains existing jobs on reduction, and respects the remaining budget',async()=>{
  const {store,transport,generator}=fixture();try{
    store.setMeta('generationBatchSize','1');generator.status.limit=3;generator.setMapQueue(['0,1','1,0','0,-1','-1,0'].map(id=>store.region(id)!));const task=generator.pump();await waitForStarts(transport,1);
    store.setMeta('generationBatchSize','2');void generator.pump();await waitForStarts(transport,2);
    store.setMeta('generationBatchSize','1');void generator.pump();transport.complete(undefined,0);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(transport.starts.length,2);
    transport.complete(undefined,1);await waitForStarts(transport,3);transport.complete(undefined,2);await task;
    assert.equal(generator.status.used,3);assert.equal(generator.queue.length,1);assert.equal(generator.status.completed,3);
  }finally{await generator.close();store.close();}
});
test('parallel shutdown interrupts every active turn and starts no queued jobs',async()=>{
  const {store,transport,generator}=fixture();generator.setMapQueue(['0,1','1,0','0,-1','-1,0'].map(id=>store.region(id)!));void generator.pump();await waitForStarts(transport,3);await generator.close();
  assert.equal(generator.status.used,3);assert.equal(generator.busy,false);assert.equal(store.db.prepare("SELECT COUNT(*) n FROM jobs WHERE status='interrupted'").get()!.n,3);assert.equal(transport.listenerCount('item/started'),0);store.close();
});


test('verification is a tiny tool-free confirmation and approved connections survive generator restarts',async()=>{
  const {store,transport,generator}=fixture();let resumed:Generator|undefined;
  try{
    generator.verified=false;const initial=generator.verify(true,Number.MAX_SAFE_INTEGER);await waitForStarts(transport,1);
    const input=transport.starts[0].params.input;assert.equal(input.length,1);assert.equal(input[0].type,'text');assert.ok(input[0].text.length<160);assert.doesNotMatch(input[0].text,/skill|read|path|context/i);
    transport.complete();await initial;assert.equal(generator.verified,true);assert.ok(store.meta('codexConnectionCheckedAt'));
    const consent=store.meta('hostConsent');await generator.close();
    const newTransport=new ProtocolFixture(join(store.root,'harness'));resumed=new Generator(store,false,{transport:newTransport});assert.equal(resumed.hasRememberedConnection(),true);
    const check=resumed.checkSession();await waitForStarts(newTransport,1);assert.notEqual(newTransport.output().nonce,transport.output().nonce);newTransport.complete();await check;
    assert.equal(resumed.verified,true);assert.equal(store.meta('hostConsent'),consent);
    await resumed.checkSession();assert.equal(newTransport.starts.length,1);
    resumed.verified=false;const failed=resumed.checkSession();await waitForStarts(newTransport,2);newTransport.complete({nonce:'wrong',status:'ok'});await assert.rejects(failed,/confirmation/);assert.equal(resumed.verified,false);
  }finally{await generator.close();await resumed?.close();store.close();}
});
test('session checks never run without a saved approval',async()=>{
  const {store,transport,generator}=fixture();try{generator.verified=false;await assert.rejects(generator.checkSession(),/Connect to Codex once/);assert.equal(transport.starts.length,0);}finally{await generator.close();store.close();}
});

test('manual disconnect cancels work, forgets auto-reconnect approval and allows a fresh verified connection',async()=>{
  const {store,transport,generator}=fixture();try{
    store.setMeta('hostConsent',JSON.stringify({acceptedAt:1,version:1,mode:'codex'}));
    generator.setMapQueue(['0,1','1,0','0,-1'].map(id=>store.region(id)!));const pending=generator.pump();await waitForStarts(transport,3);
    await generator.disconnect();await pending;
    assert.equal(generator.verified,false);assert.equal(generator.busy,false);assert.equal(generator.status.state,'disconnected');assert.equal(generator.hasRememberedConnection(),false);assert.equal(generator.queue.length,0);assert.equal(generator.mapJobs.size,0);
    assert.equal(store.db.prepare("SELECT COUNT(*) n FROM jobs WHERE status='cancelled'").get()!.n,3);
    await assert.rejects(generator.checkSession(),/Connect to Codex once/);
    const account=await generator.connect();assert.equal(account.authenticated,true);assert.equal(generator.paused,false);
    const verify=generator.verify(true,Number.MAX_SAFE_INTEGER);await waitForStarts(transport,4);transport.complete(undefined,3);await verify;assert.equal(generator.verified,true);
    await assert.rejects(generator.switchConnection('not-an-absolute-path'),/absolute path/);assert.equal(generator.verified,true);
  }finally{await generator.close();store.close();}
});


test('NPC jobs load the NPC skill and commit optional behavior; map jobs accept validated interior designs',async()=>{
  const {store,transport,generator}=fixture();try{
    const npc=generator.npc('0,0');await waitForStarts(transport,1);assert.equal(transport.starts[0].params.input[1].name,'infinite-pokemon-npc');
    transport.complete({...transport.output(0),behavior:{movement:'wander',radius:2,intervalSeconds:4,waypoints:[]}},0);await npc;assert.equal(store.npc('0,0').behavior?.movement,'wander');
    const map=generator.generate('0,1');await waitForStarts(transport,2);const output=transport.output(1);const context=JSON.parse(readFileSync(transport.input(1).find(path=>path.endsWith('context.json'))!,'utf8'));assert.ok(context.designContext.interiorSpaces.length);assert.equal(context.capabilities.npcMovement,true);
    transport.complete({...output,story:{...output.story,interiors:[{sceneId:'sanctuary',name:'Riverside Study',furniture:[{kind:'table',name:'Travel desk',text:'A notebook records the river route.',x:14,y:7,width:3,height:1}],rugs:[]}] }},1);await map;assert.equal(store.region('0,1')!.scenes![0].name,'Riverside Study');assert.equal(generator.status.failed,0);
  }finally{await generator.close();store.close();}
});
