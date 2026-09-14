import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {Store} from '../game/server/store.js';
import {World} from '../game/engine/world.js';
import {compileRegion} from '../game/engine/maps.js';
import {terrainContext} from '../game/server/terrain-context.js';
import {WIDTH,HEIGHT} from '../game/shared/model.js';

test('neighbor profiles select the facing edge without reversing its tile coordinates and respect collision objects',()=>{
  const target=compileRegion(0,0,'edges');
  const neighbors=[compileRegion(0,-1,'edges'),compileRegion(1,0,'edges'),compileRegion(0,1,'edges'),compileRegion(-1,0,'edges')];
  for(const region of neighbors){region.tiles=Array(WIDTH*HEIGHT).fill(2);region.objects=[];region.published=true;}
  neighbors[0].tiles[(HEIGHT-1)*WIDTH+3]=1;neighbors[0].tiles[(HEIGHT-1)*WIDTH+4]=1;
  neighbors[1].tiles[6*WIDTH]=7;neighbors[2].tiles[9]=1;neighbors[3].tiles[8*WIDTH+WIDTH-1]=1;
  neighbors[0].objects!.push({id:'edge-fence',kind:'fence',x:4,y:HEIGHT-1,solid:true});
  const result=terrainContext(target,neighbors,[]),edges=result.neighborEdges;
  assert.deepEqual(edges.map(edge=>[edge.sideOfTarget,edge.edgeFacingTarget]),[['north','south'],['east','west'],['south','north'],['west','east']]);
  assert.deepEqual(edges.map(edge=>edge.edge.filter(span=>span.passable).map(span=>[span.from,span.to])),[[[3,3]],[[6,6]],[[9,9]],[[8,8]]]);
  assert.equal(edges[0].edge.find(span=>span.from===4)!.passable,false);
  assert.deepEqual(edges.map(edge=>edge.edge.at(-1)!.to),[WIDTH-1,HEIGHT-1,WIDTH-1,HEIGHT-1]);
  assert.equal(result.fixedOpeningLayout,'town');
});

test('live snapshots expose branch-local terrain facts, distinguish planned neighbors, and declare unavailable mechanics honestly',()=>{
  const store=new Store(resolve('.test-data','terrain-'+randomUUID())),world=new World(store);
  try{
    world.warmStart();const {player}=world.createPlayer('Ash'),target=store.region('0,1')!;
    world.ensureRegion(0,2);const extra=world.ensureRegion(1,1);extra.published=false;store.saveRegion(extra);
    const snapshot=store.snapshot(target),context=JSON.parse(readFileSync(snapshot.contextPath,'utf8'));
    assert.deepEqual(context.terrainContext.approachBlockIds,[player.regionId]);
    assert.equal(context.terrainContext.neighborEdges.find((edge:any)=>edge.blockId==='0,0').status,'observed');
    assert.equal(context.terrainContext.neighborEdges.find((edge:any)=>edge.blockId==='1,1').status,'planned');
    assert.equal(context.terrainContext.neighborEdges.length,3);assert.ok(context.maps.every((map:any)=>map.biome));
    assert.equal(context.capabilities.geometry,'protected-templates');assert.equal(context.capabilities.imageGeneration,false);assert.equal(context.capabilities.trading,false);assert.equal(context.capabilities.worldRegionRegistry,false);
    assert.equal(context.terrainContext.fixedOpeningLayout,'river');
  }finally{store.close();}
});
