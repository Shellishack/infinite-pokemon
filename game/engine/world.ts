import type {SfxCue} from '../shared/sfx.js';
import {NpcRuntime} from './npc-runtime.js';
import {sha256Hex} from '../shared/sha256.js';
import {ContentSystem} from './content.js';
import {installServices} from './services.js';
import type { WorldStore } from './store.js';
import { compileRegion, validateRegion } from './maps.js';
import { WIDTH, HEIGHT, WALK_MS, creatureInfo, creatureKey, ATTACK_PP, DIRECTIONS, SPECIES, damage, hashSeed, random, regionId, TUTORIALS, type Player, type Region, type Creature, type Species, type Action, type GameState, type GenerationStatus, type Battle, type SceneObject, type MovementState, type Point, type Direction } from '../shared/model.js';
import { getScene,sceneObjects,solidAt,objectInFront,objectContains,nearestFree } from '../shared/scene.js';
import {DEFAULT_RENDER_DEPTH,MAX_RENDER_DEPTH} from '../shared/streaming.js';

export class GameError extends Error { constructor(message:string,public code?:string){super(message);} }
export interface ActionResult { sounds?:SfxCue[];text?: string; title?: string; lessonComplete?: boolean;code?:string;movement?:MovementState;interaction?:SceneObject;service?:'shop'|'nursery' }
export class World {
  content:ContentSystem;actors:NpcRuntime;
  online = new Set<string>();
  onFrontier: (regions:Region[])=>void = ()=>{};
  onNpc: (id:string)=>void = ()=>{};
  canEnter:(player:Player,target:Region,direction:Direction)=>boolean=()=>true;
  lastMove = new Map<string,number>();
  lastMoveSeq = new Map<string,number>();
  now:()=>number=Date.now;
  constructor(public store:WorldStore,public allowedRegions?:ReadonlySet<string>) {
    this.actors=new NpcRuntime(store);this.content=new ContentSystem(store);
    const upgrades=store.regions().filter(region=>installServices(region.scenes??[]));
    if(upgrades.length){store.backupDatabase?.('pre-variety');for(const region of upgrades){region.hash=sha256Hex(JSON.stringify({...region,hash:undefined}));store.saveRegion(region);}}
    for(const player of store.players()){this.content.initialize(player);if(upgrades.some(region=>region.id===player.regionId)&&solidAt(this.playerScene(player),player.x,player.y)){const position=this.safeArrival(this.playerScene(player),player);player.x=position.x;player.y=position.y;delete player.movement;}store.savePlayer(player);}
    this.store.markInterruptedJobs();
    for(const p of this.store.players())if(p.battle?.kind==='coop'&&!p.battle.finished){p.battle.finished=true;p.battle.log.push('The server restarted. Meet your friends at the Waystone to try again.');this.store.savePlayer(p);}
  }
  ensureRegion(gx:number,gy:number) { const id=regionId(gx,gy);if(this.allowedRegions&&!this.allowedRegions.has(id))throw new GameError('The tutorial preview ends here. Visit the prepared routes to finish your lessons, or connect Codex to continue beyond the valley.','PREVIEW_BOUNDARY');const existing=this.store.region(id);if(existing)return existing;if(this.allowedRegions)throw new GameError('A prepared tutorial map is missing.','PREVIEW_PACK_MISSING');const r=compileRegion(gx,gy,this.store.meta('seed')!);validateRegion(r);this.store.saveRegion(r);return r; }
  renderDepth(){const value=Number(this.store.meta('renderDepth')??DEFAULT_RENDER_DEPTH);return Number.isInteger(value)&&value>=0&&value<=MAX_RENDER_DEPTH?value:DEFAULT_RENDER_DEPTH;}
  warmStart() { this.neighbors(this.ensureRegion(0,0)); }
  neighbors(r:Region) {const result:Region[]=[];for(let distance=1;distance<=this.renderDepth();distance++)for(let dx=-distance;dx<=distance;dx++){const dy=distance-Math.abs(dx);for(const y of dy===0?[0]:[-dy,dy]){const id=regionId(r.gx+dx,r.gy+y);if(!this.allowedRegions||this.allowedRegions.has(id))result.push(this.ensureRegion(r.gx+dx,r.gy+y));}}return result;}
  createPlayer(name:string) {
    if(this.store.players().length>=64)throw new GameError('This world has reached its player limit.');
    const token=crypto.randomUUID()+crypto.randomUUID(), id=crypto.randomUUID();
    const origin=this.ensureRegion(0,0),spawn=nearestFree(origin,origin.spawn??{x:16,y:14});
    const p:Player={id,name,color:hashSeed(id)%6,regionId:'0,0',...spawn,facing:'south',party:[],storage:[],active:0,balls:8,potions:4,coins:100,tutorial:0,tutorialFlags:[],lessonRegion:'0,0',introDone:false,visited:['0,0'],journal:[`Arrived in ${origin.name}. A new adventure begins.`],battle:null,choice:null,steps:0,collectedItems:[]};
    this.store.transaction(()=>{this.store.addPlayer(p,token);const r=this.ensureRegion(0,0);r.published=true;this.store.saveRegion(r);this.store.event(id,r.id,'arrival',`${name} began their journey in ${r.name}.`);});
    this.onFrontier(this.neighbors(this.ensureRegion(0,0)));
    return {player:p,token};
  }
  makeCreature(species:Species,level=5):Creature {return this.content.make(species,level);}
  stepDuration(p:Player){return p.vehicleId&&!p.sceneId?this.content.vehicle(p.vehicleId)?.stepMs??WALK_MS:WALK_MS;}
  private ensurePp(creature:Creature){creature.pp??={attack:ATTACK_PP,special:creatureInfo(creature).specialPp};return creature.pp;}
  private restore(creature:Creature){creature.hp=creature.maxHp;creature.pp={attack:ATTACK_PP,special:creatureInfo(creature).specialPp};}
  private moveChoice(creature:Creature,action:'attack'|'special',spend=false){const pp=this.ensurePp(creature),struggle=pp.attack===0&&pp.special===0;if(!struggle&&pp[action]<=0)throw new GameError('That move has no PP left. Choose another move or restore your team.');if(spend&&!struggle)pp[action]--;return {struggle,special:!struggle&&action==='special',name:struggle?'Struggle':action==='special'?creatureInfo(creature).move:'Tackle'};}
  complete(p:Player,result:ActionResult) {
    p.journal.unshift(`Completed: ${TUTORIALS[p.tutorial].title}.`);p.tutorial++;p.tutorialFlags=[];p.lessonRegion=null;p.coins+=40;
    this.store.event(p.id,p.regionId,'tutorial',`${p.name} completed beginner lesson ${p.tutorial}.`);result.lessonComplete=true;
    result.text=(result.text?result.text+'\n\n':'')+(p.tutorial===5?'You are ready! The whole valley is yours to explore.':'Lesson complete! Your next guide will meet you on whichever route you choose.');
  }
  apply(pid:string,id:string,action:Action):ActionResult {
    const p=this.store.player(pid);if(!p)throw new GameError('Your player could not be found.');
    this.content.initialize(p);
    const receipt=this.store.receiptResult<ActionResult>(pid,id);if(receipt)return receipt;
    const before={x:p.x,y:p.y,regionId:p.regionId,sceneId:p.sceneId};
    const soundBefore={egg:!!p.egg,collected:p.collectedItems?.length??0,hp:new Map(p.party.map(c=>[c.id,c.hp])),battle:!!p.battle&&!p.battle.finished};
    const result:ActionResult={}; let newRegion=false, talked=false;
    this.store.transaction(()=>{
      if(action.kind!=='move'){
        if(!p.introDone&&!['intro','save'].includes(action.kind))throw new GameError('Finish the introduction first.');
        if(p.battle&&!p.battle.finished&&!['battle','switch','potion','useItem','save'].includes(action.kind))throw new GameError('Finish your battle first.');
        if(action.kind!=='save'&&p.movement?.accepted&&this.now()<p.movement.startedAt+p.movement.duration)throw new GameError('Finish your step before interacting.','MOVEMENT_PENDING');
      }
      switch(action.kind){
        case 'intro': p.introDone=true;break;
        case 'starter': {
          if(p.party.length)throw new GameError('You already have a companion.');p.party=[this.makeCreature(action.species)];p.tutorialFlags.push('starter');
          const guide=sceneObjects(this.store.region(p.regionId)!).find(object=>object.role==='guide');result.title='A friendship begins';result.text=`${SPECIES[action.species].name} joined your team! Stand beside ${guide?.name??'your guide'} in the town square, face them, then press E to talk.`;
          this.store.event(p.id,p.regionId,'starter',`${p.name} chose ${SPECIES[action.species].name} as their first companion.`);break;
        }
        case 'move': {
          newRegion=this.move(p,action,result);
          break;
        }
        case 'interact':
        case 'talk': {
          const object=this.facingObject(p);if(!object){if(this.inspectTerrain(p,result))break;throw new GameError('Face something next to you, then press E to interact.');}result.interaction=object;
          if(object.role!=='guide'){this.interactObject(p,object,result);break;}
          const r=this.store.region(p.regionId)!, npc=this.store.npc(r.id), visits=npc.visits[p.id]??0, dialogue=npc.dialogue;
          delete npc.dialogue;npc.traits=this.content.npcTraits(r);
          npc.visits[p.id]=visits+1;npc.revision++;npc.memories=[`${p.name} visited with ${p.party[0]?creatureInfo(p.party[0]).name:'no companion'}.`,...npc.memories].slice(0,12);this.store.saveNpc(r.id,npc);
          result.title=object.name??r.npcName;
          result.text=(visits?`Welcome back, ${p.name}! I remember your ${p.party[0]?creatureInfo(p.party[0]).name:'first visit'}. `:r.greeting+' ')+ (this.store.meta('choice')?`The valley is following the path of ${this.store.meta('choice')==='protect'?'protection':'discovery'}. `:'')+(dialogue??r.hook);
          result.text+=' '+npc.traits.quirk;
          if(p.tutorial===0){
            if(p.party.length&&p.tutorialFlags.includes('moved'))this.complete(p,result);else result.text='Choose a companion and try walking. Then we will begin your journey.';
          }else if(p.tutorial<5){
            if(p.lessonRegion!==p.regionId)result.text+='\n\nYour next guide is waiting beyond any of the four exits.';
            else {result.text+='\n\n'+TUTORIALS[p.tutorial].description;for(const c of p.party)this.restore(c);if(p.tutorial===2)p.balls=Math.max(p.balls,5);if(p.tutorial===3){this.mark(p,'healed');this.checkCare(p,result);}}
          }
          if(dialogue&&['greet','guard','rest'].includes(npc.mood)){
            if(npc.mood==='rest'){for(const c of p.party)this.restore(c);this.mark(p,'healed');this.checkCare(p,result);result.text+='\n\nYour guide offers a rest. Your companions are healthy again.';}
            else result.text+=npc.mood==='guard'?'\n\nYour guide keeps watch beside the Waystone.':'\n\nYour guide waves you toward the next path.';
            this.store.event(p.id,r.id,'npc-action',`${r.npcName} ${npc.mood==='rest'?'helped '+p.name+' rest their team':npc.mood==='guard'?'kept watch while greeting '+p.name:'welcomed '+p.name+' to the route'}.`);
          }
          this.store.event(p.id,r.id,'conversation',`${p.name} spoke with ${r.npcName}.`);talked=true;break;
        }
        case 'encounter': {
          if(!p.party.length)throw new GameError('Choose a companion first.');
          const tile=this.playerScene(p).tiles[p.y*WIDTH+p.x];
          const training=!p.sceneId&&p.tutorial>=1&&p.tutorial<=2&&p.lessonRegion===p.regionId&&this.facingObject(p)?.role==='guide';
          if(p.sceneId)throw new GameError('Wild Pokémon live outside.');
          if(tile!==3&&!training)throw new GameError('Find tall grass, or ask your current guide for practice.');
          this.startBattle(p,training?'training':'wild');break;
        }
        case 'trainer': {
          const trainer=this.facingObject(p);if(trainer?.role!=='trainer')throw new GameError('Stand beside the trainer and face them.');
          this.startBattle(p,'trainer',trainer.name);break;
        }
        case 'coop': { this.joinCoop(p);break; }
        case 'battle': { this.battleAction(p,action.action,result,action.ball);break; }
        case 'buyItem': {const item=this.content.buy(p,action.itemId,action.quantity);result.title='Purchase complete';result.text=`Bought ${action.quantity} × ${item.name}.`;this.store.event(p.id,p.regionId,'purchase',`${p.name} bought ${action.quantity} ${item.name}.`);break;}
        case 'buyVehicle': {const vehicle=this.content.buyVehicle(p,action.vehicleId);result.title='A new way to travel';result.text=`You bought ${vehicle.name}. Open RIDES outside to use it.`;this.store.event(p.id,p.regionId,'purchase',`${p.name} bought ${vehicle.name}.`);break;}
        case 'ride': {if(action.vehicleId){if(p.sceneId)throw new GameError('Ride outdoors.');if(!p.ownedVehicles!.includes(action.vehicleId))throw new GameError('You do not own that ride.');}p.vehicleId=action.vehicleId??undefined;break;}
        case 'breed': {const profile=this.content.breed(p,action.parentA,action.parentB);result.title='An egg to care for';result.text=`Your ${profile.name} egg will hatch after 32 walking or riding steps. Parents remain with you.`;this.store.event(p.id,p.regionId,'breeding',`${p.name} entrusted two companions to nursery care.`);break;}
        case 'swapStorage': {const index=p.storage.findIndex(c=>c.id===action.storageId);if(index<0||action.partyIndex>p.party.length)throw new GameError('Choose one of your stored companions and a valid party slot.');const incoming=p.storage[index],outgoing=p.party[action.partyIndex];p.party[action.partyIndex]=incoming;if(outgoing)p.storage[index]=outgoing;else p.storage.splice(index,1);break;}
        case 'useItem': {const index=action.index??p.active,c=p.party[index],hp=c?.hp??0,item=this.content.use(p,action.itemId,index);if(['heal','revive'].includes(item.effect)){this.mark(p,'healed');this.checkCare(p,result);}if(p.battle&&!p.battle.finished){p.battle.log.push(item.effect==='heal'?`${creatureInfo(c).name} recovered ${c.hp-hp} HP.`:`${p.name} used ${item.name}.`);if(p.battle.kind!=='coop')this.enemyTurn(p,p.battle);}else{result.title='Item used';result.text=`Used ${item.name} on ${creatureInfo(c).name}.`;}break;}
        case 'heal': {
          const healer=this.facingObject(p);if(healer?.role!=='healer'&&healer?.role!=='guide')throw new GameError('Face your guide or the caretaker beside you.');this.heal(p,result);break;
        }
        case 'potion': {
          if(!p.potions)throw new GameError('No potions left. Visit the healing house.');const c=p.party[p.active];if(!c)throw new GameError('Choose a companion.');
          if(c.hp===c.maxHp)throw new GameError('Your companion is already healthy.');const restored=Math.min(c.maxHp-c.hp,24);p.potions--;c.hp+=restored;if(p.battle&&!p.battle.finished)p.battle.log.push(`${p.name} used a Potion. ${creatureInfo(c).name} recovered ${restored} HP.`);this.mark(p,'healed');this.checkCare(p,result);
          if(p.battle&&!p.battle.finished&&p.battle.kind!=='coop')this.enemyTurn(p,p.battle);break;
        }
        case 'switch': {
          if(!p.party[action.index]||action.index===p.active)throw new GameError('Choose another Pokémon in your party.');
          if(p.party[action.index].hp<=0)throw new GameError('That Pokémon needs healing first.');p.active=action.index;if(p.battle&&!p.battle.finished)p.battle.log.push(`${p.name} sent out ${creatureInfo(p.party[p.active]).name}!`);this.mark(p,'switched');this.checkCare(p,result);if(p.battle&&!p.battle.finished&&p.battle.kind!=='coop')this.enemyTurn(p,p.battle);break;
        }
        case 'choice': {
          if(p.tutorial!==4||!p.tutorialFlags.includes('trainerWon')||p.lessonRegion!==p.regionId)throw new GameError('Finish your trainer lesson before choosing a path.');
          if(this.facingObject(p)?.role!=='guide')throw new GameError('Face your guide and tell them which path you chose.');
          const prior=this.store.meta('choice');p.choice=action.choice;
          if(!prior){this.store.setMeta('choice',action.choice);this.store.event(p.id,p.regionId,'world-choice',`${p.name} chose to ${action.choice==='protect'?'protect the Waystone':'explore beyond the Waystone'}. The valley remembers.`);}
          result.title='The valley remembers';result.text=prior&&prior!==action.choice?'Another traveler has already shaped the valley’s shared path. Your own wish is recorded in your journal.':'Your choice is part of the valley’s story now.';
          p.journal.unshift(`Chose the path of ${action.choice}.`);this.complete(p,result);break;
        }
        case 'save': result.title='Adventure saved';result.text='Your Pokémon, discoveries, and progress are safe on the world server.';break;
        case 'cancelTravel':case 'retryTravel':throw new GameError('Travel loading is managed by the server.');
      }
      if(action.kind!=='move'&&(p.x!==before.x||p.y!==before.y||p.regionId!==before.regionId||p.sceneId!==before.sceneId))result.movement=p.movement=this.warpMovement(p);
      const sounds:SfxCue[]=[];
      if(result.code==='MOVE_BLOCKED')sounds.push('bump');
      else if(!result.code){
        if(result.movement?.accepted&&result.movement.duration>0&&!p.vehicleId)sounds.push('footstep');
        if((p.collectedItems?.length??0)>soundBefore.collected)sounds.push('pickup');
        if(soundBefore.egg&&!p.egg)sounds.push('hatch');
        if(action.kind==='save')sounds.push('save');
        if(action.kind==='buyItem'||action.kind==='buyVehicle')sounds.push('purchase');
        if(action.kind==='breed')sounds.push('pickup');
        if(!soundBefore.battle){
          const healed=p.party.some(c=>c.hp>(soundBefore.hp.get(c.id)??c.hp));
          if(action.kind==='heal'||result.interaction?.role==='healer'||healed)sounds.push('heal');
          else if(action.kind==='useItem'||action.kind==='potion')sounds.push('interact');
          else if(result.interaction&&!sounds.includes('pickup')&&result.interaction.kind!=='door')sounds.push('interact');
          if(action.kind==='starter'||action.kind==='switch'||action.kind==='swapStorage')sounds.push('send-out');
        }
      }
      if(sounds.length)result.sounds=[...new Set(sounds)];
      p.journal=p.journal.slice(0,40);this.store.savePlayer(p);this.store.receipt(pid,id,result);
    });
    if(result.movement){this.lastMoveSeq.set(pid,Math.max(this.lastMoveSeq.get(pid)??-1,result.movement.seq));if(result.movement.accepted)this.lastMove.set(pid,result.movement.startedAt+result.movement.duration);}
    if(newRegion)this.onFrontier(this.neighbors(this.store.region(p.regionId)!));
    if(talked)this.onNpc(p.regionId);
    return result;
  }
  private itemKey(p:Player,object:SceneObject){return `${p.regionId}:${p.sceneId??'outdoor'}:${object.id}`;}
  private playerScene(p:Player){const scene=this.actors.scene(this.store.region(p.regionId)!,p.sceneId,this.now());return {...scene,objects:sceneObjects(scene).filter(object=>object.kind!=='item'||!p.collectedItems?.includes(this.itemKey(p,object)))};}
  private facingObject(p:Player){return objectInFront(this.playerScene(p),p,p.facing);}
  private nextMoveSeq(p:Player){return Math.max(this.lastMoveSeq.get(p.id)??-1,p.movement?.seq??-1)+1;}
  private warpMovement(p:Player,seq=this.nextMoveSeq(p)):MovementState{return {seq,fromX:p.x,fromY:p.y,toX:p.x,toY:p.y,startedAt:this.now(),duration:0,accepted:true,regionId:p.regionId,sceneId:p.sceneId};}
  private safeArrival(scene:Region,origin:Point):Point{
    const stored=this.store.region(scene.id);if(stored)scene=this.actors.scene(stored,scene.sceneId,this.now());
    const queue=[origin],seen=new Set<string>();
    for(let i=0;i<queue.length;i++){const point=queue[i],key=`${point.x},${point.y}`;if(seen.has(key)||point.x<0||point.x>=WIDTH||point.y<0||point.y>=HEIGHT)continue;seen.add(key);
      if(!solidAt(scene,point.x,point.y)&&!sceneObjects(scene).some(object=>object.kind==='door'&&objectContains(object,point.x,point.y)))return point;
      for(const [dx,dy] of Object.values(DIRECTIONS))queue.push({x:point.x+dx,y:point.y+dy});
    }throw new GameError('No safe doorway arrival is available.');
  }
  private enterDoor(p:Player,door:SceneObject,from:Point){
    const outdoor=this.store.region(p.regionId)!;
    if(door.targetScene==='outdoor'){
      if(!p.sceneId)throw new GameError('You are already outside.');
      const position=this.safeArrival(outdoor,p.returnPosition??door.arrival??outdoor.spawn??{x:16,y:14});
      p.sceneId=undefined;p.returnPosition=undefined;p.x=position.x;p.y=position.y;p.facing=door.facing??'south';return;
    }
    const target=outdoor.scenes?.find(scene=>scene.id===door.targetScene);if(!target)throw new GameError('This door is closed.','DOOR_CLOSED');
    const position=this.safeArrival(getScene(outdoor,target.id),door.arrival??target.spawn);
    if(!p.sceneId)p.returnPosition={x:from.x,y:from.y};p.sceneId=target.id;p.x=position.x;p.y=position.y;p.facing=door.facing??'north';
  }
  private move(p:Player,action:Extract<Action,{kind:'move'}>,result:ActionResult){
    const now=this.now(),seq=action.seq??this.nextMoveSeq(p),previous=p.movement,readyAt=Math.max(this.lastMove.get(p.id)??0,previous?.accepted?previous.startedAt+previous.duration:0);
    const reject=(code:string,text?:string)=>{result.code=code;if(text)result.text=text;result.movement={seq,fromX:p.x,fromY:p.y,toX:p.x,toY:p.y,startedAt:now,duration:0,accepted:false,regionId:p.regionId,sceneId:p.sceneId};if(code!=='STALE_MOVE'&&(!previous?.accepted||previous.startedAt+previous.duration<=now))p.movement=result.movement;return false;};
    if(seq<=(this.lastMoveSeq.get(p.id)??previous?.seq??-1))return reject('STALE_MOVE');
    p.facing=action.direction;
    if(readyAt-now>20)return reject('MOVE_TOO_FAST');
    const before={x:p.x,y:p.y,regionId:p.regionId,sceneId:p.sceneId,returnPosition:p.returnPosition};
    try{
      if(!p.introDone)throw new GameError('Finish the introduction first.');if(!p.party.length)throw new GameError('Choose your first Pokémon.');
      if(p.battle&&!p.battle.finished)throw new GameError('Finish your battle first.');
      const [dx,dy]=DIRECTIONS[action.direction];let x=p.x+dx,y=p.y+dy;
      const origin=this.store.region(p.regionId)!,crossed=x<0||x>=WIDTH||y<0||y>=HEIGHT;
      if(crossed){
        if(p.sceneId)throw new GameError('Use the door to leave this room.','ROOM_BOUNDARY');
        if(p.tutorial===0)throw new GameError('Meet your guide before leaving this first map.');
        const next=this.ensureRegion(origin.gx+(x<0?-1:x>=WIDTH?1:0),origin.gy+(y<0?-1:y>=HEIGHT?1:0));
        if(!this.canEnter(p,next,action.direction))return reject('MAP_LOADING');
        x=x<0?WIDTH-1:x>=WIDTH?0:x;y=y<0?HEIGHT-1:y>=HEIGHT?0:y;
        if(solidAt(next,x,y))return reject('MOVE_BLOCKED');p.regionId=next.id;
      }
      const scene=this.playerScene(p);
      if(solidAt(scene,x,y)){p.regionId=before.regionId;return reject('MOVE_BLOCKED');}
      const door=sceneObjects(scene).find(object=>object.kind==='door'&&objectContains(object,x,y));
      if(door)this.enterDoor(p,door,before);else{p.x=x;p.y=y;}
      if(p.battle?.finished)p.battle=null;p.steps++;this.mark(p,'moved');const repelled=(p.repelSteps??0)>0;const baby=this.content.step(p);if(baby){result.title='Your egg hatched!';result.text=`${creatureInfo(baby).name} hatched with inherited traits. Check your team or storage.`;}
      if(crossed){const next=this.store.region(p.regionId)!;next.published=true;this.store.saveRegion(next);if(!p.visited.includes(next.id))p.visited.push(next.id);if(p.tutorial<5)p.lessonRegion=next.id;p.journal.unshift(`Discovered ${next.name}.`);this.store.event(p.id,next.id,'arrival',`${p.name} traveled ${action.direction} from ${origin.name} into ${next.name}.`);}
      const changedScene=p.regionId!==before.regionId||p.sceneId!==before.sceneId;
      result.movement=p.movement=changedScene?this.warpMovement(p,seq):{seq,fromX:before.x,fromY:before.y,toX:p.x,toY:p.y,startedAt:Math.max(now,readyAt),duration:this.stepDuration(p),accepted:true,regionId:p.regionId,sceneId:p.sceneId};
      if(!baby&&!repelled&&!p.sceneId&&this.playerScene(p).tiles[p.y*WIDTH+p.x]===3&&p.tutorial>0&&p.steps%11===0&&p.party.some(creature=>creature.hp>0))this.startBattle(p,'wild');
      return crossed;
    }catch(error){if(!(error instanceof GameError))throw error;p.x=before.x;p.y=before.y;p.regionId=before.regionId;p.sceneId=before.sceneId;p.returnPosition=before.returnPosition;return reject(error.code??'MOVE_REJECTED',error.message);}
  }
  private heal(p:Player,result:ActionResult){for(const creature of p.party)this.restore(creature);result.title='A little rest';result.text='Your team is feeling wonderful again!';this.mark(p,'healed');this.checkCare(p,result);this.store.event(p.id,p.regionId,'healing',`${p.name} rested their team.`);}
  private inspectTerrain(p:Player,result:ActionResult){
    const [dx,dy]=DIRECTIONS[p.facing],x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=WIDTH||y>=HEIGHT)return false;
    const descriptions:Record<number,[string,string]>={2:['Trees','A dense tree blocks this way.'],3:['Tall grass','Wild Pokémon hide in the tall grass.'],4:['Water','The water is too deep to cross on foot.'],6:['Building','The wall is solid. Look for the doorway.'],8:['Weathered stone','A weathered stone blocks this way.'],10:['Wall','A sturdy wall shelters this room.'],12:['Furniture','The furniture is neatly arranged.'],13:['Shelves','Shelves hold supplies and well-used books.']};
    const description=descriptions[this.playerScene(p).tiles[y*WIDTH+x]];if(!description)return false;[result.title,result.text]=description;return true;
  }
  private interactObject(p:Player,object:SceneObject,result:ActionResult){
    result.title=object.name??(object.kind==='door'?'Door':object.kind==='item'?'Found an item':'Take a closer look');
    if(object.kind==='door'){this.enterDoor(p,object,p);return;}
    if(object.role==='merchant'){result.service='shop';return;}
    if(object.role==='breeder'){result.service='nursery';return;}
    if(object.role==='trainer'){this.startBattle(p,'trainer',object.name);return;}
    if(object.role==='healer'){this.heal(p,result);return;}
    if(object.kind==='waystone'){if(p.tutorial<5||this.allowedRegions){result.title='The Waystone';result.text=object.text??this.store.region(p.regionId)!.hook;return;}this.joinCoop(p);return;}
    if(object.kind==='item'){
      const key=this.itemKey(p,object);p.collectedItems??=[];if(p.collectedItems.includes(key)){result.text='You already collected this item.';return;}
      if(object.item==='potion')p.potions++;else if(object.item==='ball')p.balls++;else{result.text=object.text??'There is nothing to collect here.';return;}
      p.collectedItems.push(key);result.text=`You found a ${object.item==='potion'?'Potion':'Poké Ball'}!`;this.store.event(p.id,p.regionId,'item',`${p.name} found a ${object.item==='potion'?'Potion':'Poké Ball'}.`);return;
    }
    if(object.id==='room-pc'){result.title=object.name??'Pokémon PC';result.text=p.storage.length?`Your PC safely stores ${p.storage.length} Pokémon: ${p.storage.map(creature=>creatureInfo(creature).name).join(', ')}.`:'Your PC is ready. Pokémon caught when your party is full are safely stored here.';return;}
    result.text=object.text??(object.kind==='fence'?'A sturdy fence marks the edge of the path.':object.kind==='npc'?`${object.name??'The traveler'} waves hello.`:'Take a moment to look around.');
  }
  mark(p:Player,flag:string){if(!p.tutorialFlags.includes(flag))p.tutorialFlags.push(flag);}
  checkCare(p:Player,r:ActionResult){if(p.tutorial===3&&p.lessonRegion===p.regionId&&p.tutorialFlags.includes('healed')&&p.tutorialFlags.includes('switched'))this.complete(p,r);}
  startBattle(p:Player,kind:'wild'|'training'|'trainer',trainerName='Trainer Rowan') {
    if(p.battle&&!p.battle.finished)throw new GameError('You are already in a battle.');
    if(!p.party.length)throw new GameError('Choose a companion.');
    for(const creature of p.party)this.ensurePp(creature);
    if(!p.party.some(c=>c.hp>0))throw new GameError('Heal your team first.');if(!p.party[p.active]||p.party[p.active].hp<=0)p.active=p.party.findIndex(c=>c.hp>0);
    const species:Species=kind==='trainer'?'pikachu':(['pidgey','oddish','pikachu','squirtle'] as Species[])[hashSeed(p.id+p.steps)%4];
    const profile=kind==='wild'&&hashSeed(p.id+':'+p.steps)%3!==0?this.content.wild(this.store.region(p.regionId)!,hashSeed(p.regionId+':'+p.steps+p.id)):undefined;
    const enemy=profile?this.content.make(profile.base,3,profile):this.makeCreature(species,kind==='trainer'?5:3);
    const trainer=this.facingObject(p),trainerId=kind==='trainer'?`${p.regionId}:${p.sceneId??'outdoor'}:${trainer?.id??'trainer'}`:undefined;
    if(kind==='trainer'){const traits=this.content.npcTraits(this.store.region(p.regionId)!,trainer?.id??'trainer');enemy.traits=[traits.temperament==='bold'?'bold':'gentle'];}
    p.battle={id:crypto.randomUUID(),kind,enemy,trainerId,round:0,log:[`${kind==='trainer'?trainerName+' sent out':'A wild'} ${creatureInfo(enemy).name}${kind==='trainer'?'!':' appeared!'}`],won:false,finished:false,rewardGiven:false};
  }
  battleAction(p:Player,action:'attack'|'special'|'capture'|'run'|'close',result:ActionResult,ballId='poke-ball'){
    this.content.initialize(p);const b=p.battle;if(!b)throw new GameError('You are not in a battle.');
    if(action==='close'){if(!b.finished)throw new GameError('The battle is still going.');p.battle=null;return;}
    if(b.finished)throw new GameError('This battle is over.');
    if(b.kind==='coop'){if(action==='run'){this.leaveCoop(p);return;}if(action!=='attack'&&action!=='special')throw new GameError('Choose an attack or leave the shared encounter.');this.coopAction(p,action);return;}
    b.round++;const rng=random(hashSeed(b.id+':'+b.round));const mine=p.party[p.active];
    if(action==='run'){if(b.kind==='trainer')throw new GameError('Finish your trainer challenge.');b.finished=true;b.log.push('You returned safely to the path.');return;}
    if(action==='capture'){
      if(b.kind==='trainer')throw new GameError('You cannot catch another trainer’s Pokémon.');const ball=this.content.item(ballId);if(!ball||ball.effect!=='capture'||this.content.quantity(p,ballId)<1)throw new GameError('No capture item available. Visit a shop for supplies.');
      this.content.add(p,ballId,-1);b.log.push(`${p.name} threw a ${ball.name}!`);const weakened=b.enemy.hp<=b.enemy.maxHp*.6;
      if((p.tutorial===2&&weakened)||rng()<.25+(1-b.enemy.hp/b.enemy.maxHp)*.65+ball.power-(b.enemy.traits?.includes('elusive')?.08:0)){
        const caught={...b.enemy,id:crypto.randomUUID(),hp:b.enemy.maxHp,pp:{attack:ATTACK_PP,special:creatureInfo(b.enemy).specialPp}}, stored=p.party.length>=6;if(!stored)p.party.push(caught);else p.storage.push(caught);
        b.log.push(`Gotcha! ${creatureInfo(caught).name} ${stored?'is safely stored.':'joined your team!'}`);b.finished=true;b.won=true;
        this.store.event(p.id,p.regionId,'capture',`${p.name} caught ${creatureInfo(caught).name}.`);p.journal.unshift(`Caught ${creatureInfo(caught).name}.`);
        p.stats!.captures++;if(!p.stats!.caughtSpecies.includes(creatureKey(caught)))p.stats!.caughtSpecies.push(creatureKey(caught));
        if(p.tutorial===2&&p.lessonRegion===p.regionId)this.complete(p,result);return;
      }b.log.push('It broke free! Try weakening it a little more.');this.enemyTurn(p,b);return;
    }
    const move=this.moveChoice(mine,action,true),hit=damage(mine,b.enemy,move.special,rng());b.enemy.hp=Math.max(0,b.enemy.hp-hit);b.log.push(`${creatureInfo(mine).name} used ${move.name}! ${hit} damage.`);
    if(move.struggle){const recoil=Math.min(mine.hp,Math.max(1,Math.floor(mine.maxHp/4)));mine.hp-=recoil;b.log.push(`${creatureInfo(mine).name} took ${recoil} recoil damage.`);}
    if(b.enemy.hp===0){b.finished=true;b.won=true;this.reward(p,b);b.log.push('You won the battle!');
      if(p.tutorial===1&&b.kind!=='trainer'&&p.lessonRegion===p.regionId)this.complete(p,result);
      else if(p.tutorial===4&&b.kind==='trainer'&&p.lessonRegion===p.regionId){this.mark(p,'trainerWon');result.text='Well battled! Return to your guide and choose what the valley should become.';}
      if(mine.hp===0)this.resolveFaint(p,b);return;
    }if(mine.hp===0)this.resolveFaint(p,b);if(!b.finished)this.enemyTurn(p,b);
  }
  enemyTurn(p:Player,b:Battle){const c=p.party[p.active];const hit=Math.max(2,b.enemy.level+1+(b.enemy.traits?.includes('bold')?1:0)-(c.traits?.includes('gentle')?1:0));c.hp=Math.max(0,c.hp-hit);b.log.push(`${creatureInfo(b.enemy).name} fought back for ${hit} damage.`);
    if(c.hp===0)this.resolveFaint(p,b);
    b.log=b.log.slice(-8);
  }
  private resolveFaint(p:Player,b:Battle){const next=p.party.findIndex(creature=>creature.hp>0);if(next>=0){p.active=next;b.log.push(`${creatureInfo(p.party[next]).name} steps in!`);}else{b.finished=true;b.log.push('Your team needs rest. Your guide helped you recover.');for(const creature of p.party)this.restore(creature);const region=this.store.region(p.regionId)!,position=this.safeArrival(region,region.spawn??{x:16,y:14});p.sceneId=undefined;p.returnPosition=undefined;p.x=position.x;p.y=position.y;}}
  reward(p:Player,b:Battle){if(b.rewardGiven)return;this.content.initialize(p);if(b.kind==='trainer'&&b.trainerId&&!p.stats!.defeatedTrainers.includes(b.trainerId))p.stats!.defeatedTrainers.push(b.trainerId);b.rewardGiven=true;p.coins+=b.kind==='coop'?120:35;if(p.potions<30)p.potions++;const c=p.party[p.active];c.xp+=12;
    if(c.xp>=20&&c.level<50){c.level++;c.xp-=20;c.maxHp+=4;c.hp=Math.min(c.maxHp,c.hp+8);b.log.push(`${creatureInfo(c).name} grew to level ${c.level}!`);}
    this.store.event(p.id,p.regionId,'battle',`${p.name} won a ${b.kind} battle.`);
  }
  joinCoop(p:Player){
    if(this.allowedRegions)throw new GameError('The guardian encounter is outside the beginner preview. Connect Codex to continue the full adventure.','PREVIEW_BOUNDARY');
    if(p.tutorial<5)throw new GameError('Finish the beginner guide before challenging the guardian.');
    if(this.facingObject(p)?.kind!=='waystone')throw new GameError('Stand beside the Waystone and face it.');
    if(!p.party.some(c=>c.hp>0))throw new GameError('Heal your team before challenging the guardian.');
    for(const creature of p.party)this.ensurePp(creature);
    if(!p.party[p.active]||p.party[p.active].hp<=0)p.active=p.party.findIndex(c=>c.hp>0);
    let other=this.store.players().find(o=>o.id!==p.id&&this.online.has(o.id)&&o.regionId===p.regionId&&o.sceneId===p.sceneId&&o.battle?.kind==='coop'&&!o.battle.finished);
    if(other){const b=other.battle!;if((b.participants?.length??0)>=4)throw new GameError('That guardian group is full.');if(b.round>0)throw new GameError('The guardian battle has already begun.');b.participants!.push(p.id);b.roundStartedAt=Date.now();p.battle=structuredClone(b);for(const id of b.participants!)if(id!==p.id){const member=this.store.player(id)!;member.battle=structuredClone(b);this.store.savePlayer(member);}return;}
    p.battle={id:crypto.randomUUID(),kind:'coop',enemy:this.makeCreature('pikachu',12),round:0,roundStartedAt:Date.now(),log:['A Waystone guardian appeared. A friend can join you here!'],won:false,finished:false,rewardGiven:false,participants:[p.id],actions:{}};
  }
  coopAction(p:Player,action:'attack'|'special'){
    this.moveChoice(p.party[p.active],action);
    const b=p.battle!;b.actions??={};b.actions[p.id]=action;
    const members=this.coopMembers(b,p);
    const available=members.filter(m=>this.online.has(m.id));
    if(available.length<2&&b.round===0)throw new GameError('A second trainer must join at this Waystone.');
    if(available.every(m=>b.actions![m.id]))this.resolveCoopRound(b,available);
    this.saveCoop(b,members,p.id);
  }
  private coopMembers(b:Battle,current?:Player){
    return (b.participants??[]).map(id=>id===current?.id?current:this.store.player(id)).filter((p):p is Player=>!!p&&p.battle?.id===b.id&&!p.battle.finished);
  }
  private saveCoop(b:Battle,members:Player[],currentId?:string){
    b.log=b.log.slice(-8);for(const member of members){member.battle=structuredClone(b);if(member.id!==currentId)this.store.savePlayer(member);}
  }
  private resolveCoopRound(b:Battle,members:Player[],now=Date.now()){
    b.round++;for(const m of members){const c=m.party[m.active],action=b.actions?.[m.id];if(!action){b.log.push(`${m.name} guarded while their turn timed out.`);continue;}
      let move;try{move=this.moveChoice(c,action,true);}catch{delete b.actions![m.id];b.log.push(`${m.name} had no PP for that move and guarded.`);continue;}
      const hit=damage(c,b.enemy,move.special,.5);b.enemy.hp=Math.max(0,b.enemy.hp-hit);b.log.push(`${m.name} used ${move.name} and dealt ${hit} damage.`);
      if(move.struggle){const recoil=Math.min(c.hp-1,Math.max(1,Math.floor(c.maxHp/4)));c.hp-=recoil;b.log.push(`${creatureInfo(c).name} took ${recoil} recoil damage.`);}
    }
    if(b.enemy.hp===0){b.finished=true;b.won=true;b.log.push('Together, you calmed the guardian!');if(!b.rewardGiven)for(const m of members)this.reward(m,{...b,rewardGiven:false});b.rewardGiven=true;}
    else for(const m of members){const c=m.party[m.active];c.hp=Math.max(1,c.hp-(b.actions?.[m.id]?6:3));}
    b.actions={};b.roundStartedAt=now;
  }
  leaveCoop(p:Player){
    const original=p.battle;if(!original||original.kind!=='coop'||original.finished)return;
    const b=structuredClone(original);b.participants=(b.participants??[]).filter(id=>id!==p.id);delete b.actions?.[p.id];b.log.push(`${p.name} left the guardian encounter.`);
    const remaining=this.coopMembers(b);if(b.round===0&&remaining.length<2){b.finished=true;b.log.push('Gather two trainers at the Waystone to try again.');}
    else if(remaining.length&&remaining.every(m=>b.actions?.[m.id]))this.resolveCoopRound(b,remaining);
    this.saveCoop(b,remaining);p.battle={...original,finished:true,actions:{},log:[...original.log,'You left the guardian encounter.'].slice(-8)};
  }
  disconnect(pid:string){
    this.online.delete(pid);this.lastMove.delete(pid);this.lastMoveSeq.delete(pid);const p=this.store.player(pid);if(p?.battle?.kind==='coop'&&!p.battle.finished)this.store.transaction(()=>{this.leaveCoop(p);this.store.savePlayer(p);});
  }
  tick(now=Date.now()){
    this.actors.tick(this.store.players().filter(player=>this.online.has(player.id)),now);
    const seen=new Set<string>();for(const p of this.store.players()){
      const b=p.battle;if(!b||b.kind!=='coop'||b.finished||seen.has(b.id))continue;seen.add(b.id);
      if(now-(b.roundStartedAt??0)<30_000)continue;
      this.store.transaction(()=>{const members=this.coopMembers(b);if(!members.length)return;
        if(!Object.keys(b.actions??{}).length||(b.round===0&&members.length<2)){b.finished=true;b.log.push('The guardian settled down while the group was away. You can try again at the Waystone.');}
        else this.resolveCoopRound(b,members,now);this.saveCoop(b,members);
      });
    }
  }
  view(pid:string,generation:GenerationStatus):GameState{
    const me=this.store.player(pid)!;const region=this.actors.scene(this.store.region(me.regionId)!,me.sceneId,this.now());
    const npc=this.store.npc(region.id),publicNpc={...npc,visits:{[pid]:npc.visits[pid]??0},memories:[]};
    return {type:'state',variety:this.content.view(me),stepMs:this.stepDuration(me),serverTime:this.now(),preview:!!this.allowedRegions,me,region,players:this.store.players().filter(p=>this.online.has(p.id)&&p.regionId===me.regionId&&p.sceneId===me.sceneId).map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,facing:p.facing,color:p.color,ride:p.vehicleId&&!p.sceneId?this.content.vehicle(p.vehicleId):undefined,movement:p.movement,sceneId:p.sceneId,busy:!!p.battle&&!p.battle.finished})),
      events:this.store.events(10).filter(e=>e.kind!=='conversation'||e.playerId===pid),regions:this.store.regions().filter(r=>r.published).map(({id,name,gx,gy,source})=>({id,name,gx,gy,source})),generation:{state:generation.state,queued:generation.queued,completed:generation.completed,mode:generation.mode},worldName:this.store.meta('name')!,worldChoice:this.store.meta('choice'),npc:publicNpc,seq:this.store.sequence()};
  }
}
