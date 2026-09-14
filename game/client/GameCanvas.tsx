import {useEffect,useRef} from 'react';
import {DIRECTIONS,WIDTH,HEIGHT,TILE,type GameState,type Direction,type MovementState} from '../shared/model';
import {sceneObjects,solidAt} from '../shared/scene';
import {drawMap,drawAvatar} from './pixels';
import {loadClassicAssets,classicImage} from './classic-assets';
import {TileMotion,sampleTrajectory} from './movement';

interface Props {
  state:GameState;onMove:(direction:Direction,seq:number)=>void;onInteract:()=>void;blocked:boolean;
  movementFeedback?:MovementState;moveRequest?:{direction:Direction;id:string};interactRequest?:{id:string};heldDirection?:Direction;
}
export default function GameCanvas(props:Props){
  const container=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
  useEffect(()=>{if(!props.blocked)container.current?.focus({preventScroll:true});},[props.blocked]);
  useEffect(()=>{
    let disposed=false,game:import('phaser').Game|undefined;
    void Promise.all([import('phaser'),loadClassicAssets()]).then(([{default:Phaser}])=>{
      if(disposed)return;
      class Scene extends Phaser.Scene {
        people=new Map<string,Phaser.GameObjects.Image>();labels=new Map<string,Phaser.GameObjects.Text>();
        rides=new Map<string,Phaser.GameObjects.Image>();
        npcSprites=new Map<string,Phaser.GameObjects.Image>();
        objects:Phaser.GameObjects.Image[]=[];background?:Phaser.GameObjects.Image;
        textureKey='';sceneKey='';owner?:TileMotion;facing:Direction='south';
        lastAck=-1;lastFeedback=-1;requestId='';interactId='';queuedDirection?:Direction;interactQueued=false;
        blockedStepAt=0;walkSince=0;lastWalk=0;clockOffset=0;lastClockTime=0;
        remote=new Map<string,MovementState[]>();keys!:Record<string,Phaser.Input.Keyboard.Key>;heldKeys=new Map<string,{direction:Direction;time:number}>();
        constructor(){super('world');}
        create(){
          for(let color=0;color<6;color++){
            const sheet=classicImage(`people/${color%2?'green_normal':'red_normal'}`);
            if(sheet)this.textures.addSpriteSheet(`trainer-${color}`,sheet,{frameWidth:16,frameHeight:32});
            else{const c=document.createElement('canvas');c.width=16;c.height=32;drawAvatar(c.getContext('2d')!,0,11,color);this.textures.addCanvas(`trainer-${color}`,c);}
            const bike=classicImage(`people/${color%2?'green_bike':'red_bike'}`);if(bike)this.textures.addSpriteSheet(`trainer-${color}-bike`,bike,{frameWidth:32,frameHeight:32});
          }
          for(const name of ['prof_oak','youngster','nurse','hiker','lass','fisher','scientist','green_normal','red_normal']){
            const sheet=classicImage(`people/${name}`);if(sheet)this.textures.addSpriteSheet(`npc-${name}`,sheet,{frameWidth:16,frameHeight:32});
          }
          this.keys=this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string,Phaser.Input.Keyboard.Key>;
          const keyDown=(event:KeyboardEvent)=>{
            if(latest.current.blocked||event.ctrlKey||event.metaKey||event.altKey||(event.target as HTMLElement)?.matches?.('input,textarea,select,[contenteditable=true]'))return;
            const direction=({ArrowUp:'north',KeyW:'north',ArrowDown:'south',KeyS:'south',ArrowLeft:'west',KeyA:'west',ArrowRight:'east',KeyD:'east'} as Record<string,Direction>)[event.code];
            if(direction){event.preventDefault();if(!this.heldKeys.has(event.code))this.heldKeys.set(event.code,{direction,time:performance.now()});if(!event.repeat)this.queuedDirection=direction;}
          };
          const keyUp=(event:KeyboardEvent)=>this.heldKeys.delete(event.code),blur=()=>{this.heldKeys.clear();this.queuedDirection=undefined;};
          window.addEventListener('keydown',keyDown,true);window.addEventListener('keyup',keyUp,true);window.addEventListener('blur',blur);
          this.events.once('shutdown',()=>{window.removeEventListener('keydown',keyDown,true);window.removeEventListener('keyup',keyUp,true);window.removeEventListener('blur',blur);});
          this.input.keyboard!.addCapture(['UP','DOWN','LEFT','RIGHT','SPACE']);
          this.input.keyboard!.on('keydown',(event:KeyboardEvent)=>{if(event.repeat||latest.current.blocked)return;const direction=({ArrowUp:'north',w:'north',W:'north',ArrowDown:'south',s:'south',S:'south',ArrowLeft:'west',a:'west',A:'west',ArrowRight:'east',d:'east',D:'east'} as Record<string,Direction>)[event.key];if(direction)this.queuedDirection=direction;});
          for(const code of ['E','SPACE'])this.input.keyboard!.on(`keydown-${code}`,(event:KeyboardEvent)=>{if(!event.repeat&&!latest.current.blocked)this.interactQueued=true;});
          this.cameras.main.setBounds(0,0,WIDTH*TILE,HEIGHT*TILE);
        }
        direction():Direction|undefined{
          if(latest.current.heldDirection)return latest.current.heldDirection;
          const native=[...this.heldKeys.values()].sort((a,b)=>b.time-a.time)[0];if(native)return native.direction;
          const keys:[Direction,Phaser.Input.Keyboard.Key][]=[['north',this.keys.UP],['north',this.keys.W],['south',this.keys.DOWN],['south',this.keys.S],['west',this.keys.LEFT],['west',this.keys.A],['east',this.keys.RIGHT],['east',this.keys.D]];
          return keys.filter(([,key])=>key.isDown).sort((a,b)=>b[1].timeDown-a[1].timeDown)[0]?.[0];
        }
        drawScene(state:GameState,key:string){
          const camera=this.cameras.main;
          if(state.region.theme==='interior'){
            const floor=state.region.tiles.flatMap((tile,index)=>tile!==10?[{x:index%WIDTH,y:Math.floor(index/WIDTH)}]:[]);
            if(floor.length){
              const left=Math.min(...floor.map(p=>p.x))*TILE,right=(Math.max(...floor.map(p=>p.x))+1)*TILE;
              const top=(Math.min(...floor.map(p=>p.y))-1)*TILE,bottom=(Math.max(...floor.map(p=>p.y))+1)*TILE;
              const width=Math.max(camera.width,right-left),height=Math.max(camera.height,bottom-top);
              camera.setBounds((left+right-width)/2,(top+bottom-height)/2,width,height);
            }
          }else camera.setBounds(0,0,WIDTH*TILE,HEIGHT*TILE);
          this.background?.destroy();for(const object of this.objects)object.destroy();this.objects=[];this.npcSprites.clear();
          if(this.textures.exists('region'))this.textures.remove('region');
          const canvas=document.createElement('canvas');canvas.width=WIDTH*TILE;canvas.height=HEIGHT*TILE;
          drawMap(canvas.getContext('2d')!,state.region,{includeNpcs:false,dynamicObjects:true,collectedItems:state.me.collectedItems});
          this.textures.addCanvas('region',canvas);this.background=this.add.image(0,0,'region').setOrigin(0).setDepth(-100);
          for(const object of sceneObjects(state.region).filter(o=>o.kind==='npc')){
            const preferred=`npc-${object.sprite??(object.role==='trainer'?'youngster':object.role==='healer'?'nurse':'prof_oak')}`;
            const texture=this.textures.exists(preferred)?preferred:'npc-prof_oak';if(!this.textures.exists(texture))continue;
            const frame=object.facing==='north'?1:object.facing==='west'||object.facing==='east'?2:0;
            const sprite=this.add.image(object.x*TILE+8,object.y*TILE+16,texture,frame).setOrigin(.5,1).setFlipX(object.facing==='east').setDepth(object.y*TILE+16);this.objects.push(sprite);this.npcSprites.set(object.id,sprite);
          }
          const interior=classicImage('interior');
          if(interior){
            if(!this.textures.exists('field-pc')){const pc=document.createElement('canvas');pc.width=16;pc.height=32;const ctx=pc.getContext('2d')!;for(const [id,y]of[[98,0],[35,16]])ctx.drawImage(interior,id%32*16,Math.floor(id/32)*16,16,16,0,y,16,16);this.textures.addCanvas('field-pc',pc);}
            for(const object of sceneObjects(state.region).filter(o=>o.sprite==='pc'))this.objects.push(this.add.image(object.x*TILE+8,object.y*TILE+16,'field-pc').setOrigin(.5,1).setDepth(object.y*TILE+16));
          }
          this.textureKey=key;
        }
        update(time:number){
          const props=latest.current,state=props.state,me=state.me;
          const identity=`${state.region.id}:${state.region.sceneId??'outdoor'}`,changed=identity!==this.sceneKey;
          if(changed||!this.owner){
            this.sceneKey=identity;this.owner=new TileMotion({x:me.x,y:me.y},me.movement?.seq??0);this.facing=me.facing;
            this.lastAck=me.movement?.seq??-1;this.lastFeedback=this.lastAck;this.remote.clear();this.interactQueued=false;
            for(const person of this.people.values())person.destroy();for(const label of this.labels.values())label.destroy();for(const ride of this.rides.values())ride.destroy();this.rides.clear();this.people.clear();this.labels.clear();
            this.cameras.main.fadeIn(150,0,0,0);
          }
          const textureKey=`${state.region.staticHash??state.region.hash}:${(me.collectedItems??[]).join('|')}`;
          if(textureKey!==this.textureKey)this.drawScene(state,textureKey);
          const belongs=(m:MovementState)=>!m.regionId||`${m.regionId}:${m.sceneId??'outdoor'}`===identity;
          const feedback=props.movementFeedback;
          if(feedback&&feedback.seq>this.lastFeedback&&belongs(feedback)){this.owner!.acknowledge(feedback,time);this.lastFeedback=feedback.seq;}
          if(me.movement&&me.movement.seq>this.lastAck&&belongs(me.movement)){this.owner!.acknowledge(me.movement,time);this.lastAck=me.movement.seq;}
          this.owner!.settle(time);this.owner!.sync({x:me.x,y:me.y},me.movement?.seq??0,time);
          const players=new Set(state.players.map(p=>p.id));
          for(const [id,sprite] of this.people)if(!players.has(id)){sprite.destroy();this.people.delete(id);this.labels.get(id)?.destroy();this.labels.delete(id);this.remote.delete(id);this.rides.get(id)?.destroy();this.rides.delete(id);}
          const serverTime=(state as GameState&{serverTime?:number}).serverTime;
          if(serverTime&&serverTime!==this.lastClockTime){const observed=serverTime-Date.now();this.clockOffset=this.lastClockTime?this.clockOffset*.85+observed*.15:observed;this.lastClockTime=serverTime;}
          for(const object of sceneObjects(state.region).filter(object=>object.kind==='npc')){
            const sprite=this.npcSprites.get(object.id);if(!sprite)continue;
            const now=Date.now()+this.clockOffset,position=object.motion?sampleTrajectory(object.motion,now):object;
            const moving=object.motion&&now<object.motion.startedAt+object.motion.duration;
            const direction=object.facing==='north'?1:object.facing==='west'||object.facing==='east'?2:0;
            const frame=moving?[3+direction*2,direction,4+direction*2,direction][Math.floor(now/80)%4]:direction;
            sprite.setPosition(position.x*TILE+8,position.y*TILE+16).setDepth(position.y*TILE+16).setFrame(frame).setFlipX(object.facing==='east');
          }
          for(const p of state.players){
            let sprite=this.people.get(p.id);
            if(!sprite){sprite=this.add.image(p.x*TILE+8,p.y*TILE+16,`trainer-${p.color}`,0).setOrigin(.5,1);this.people.set(p.id,sprite);this.labels.set(p.id,this.add.text(0,0,p.name,{fontFamily:'monospace',fontSize:'7px',color:'#fff',backgroundColor:'#304048cc',padding:{x:2,y:1}}).setOrigin(.5,1).setVisible(p.id!==me.id));}
            let position={x:p.x,y:p.y},moving=false,facing=p.facing;
            if(p.id===me.id){position=this.owner!.position(time);moving=this.owner!.moving(time);facing=this.facing;}
            else if(p.movement){
              const track=this.remote.get(p.id)??[];if(!track.some(m=>m.seq===p.movement!.seq)){track.push(p.movement);if(track.length>8)track.shift();this.remote.set(p.id,track);}
              const now=Date.now()+this.clockOffset-100,segment=[...track].reverse().find(m=>m.startedAt<=now)??track[0];
              position=sampleTrajectory(segment,now);moving=segment.accepted&&segment.duration>0&&now<segment.startedAt+segment.duration;
            }
            sprite.setPosition(position.x*TILE+8,position.y*TILE+16).setDepth(position.y*TILE+16);
            const classicRider=p.ride?.id==='bicycle'&&this.textures.exists(`trainer-${p.color}-bike`),trainerTexture=`trainer-${p.color}${classicRider?'-bike':''}`;if(sprite.texture.key!==trainerTexture)sprite.setTexture(trainerTexture);
            let ride=this.rides.get(p.id);
            if(p.ride&&!classicRider){const key='ride-'+p.ride.form+p.ride.color;
              if(!this.textures.exists(key)){const c=document.createElement('canvas');c.width=26;c.height=13;const ctx=c.getContext('2d')!;ctx.fillStyle='#35434a';ctx.fillRect(1,7,7,6);ctx.fillRect(18,7,7,6);ctx.fillStyle='#d7dfd2';ctx.fillRect(3,9,3,2);ctx.fillRect(20,9,3,2);ctx.fillStyle=p.ride.color;ctx.fillRect(4,5,18,3);ctx.fillRect(18,0,2,7);if(p.ride.form==='cart')ctx.fillRect(4,1,18,6);if(p.ride.form==='mount'){ctx.fillRect(3,0,18,9);ctx.fillRect(18,0,6,6);}this.textures.addCanvas(key,c);}
              if(!ride){ride=this.add.image(0,0,key).setOrigin(.5,1);this.rides.set(p.id,ride);}ride.setTexture(key).setPosition(sprite.x,sprite.y+3).setDepth(sprite.depth+.1).setFlipX(facing==='west');
            }else if(ride){ride.destroy();this.rides.delete(p.id);}
            const dir=facing==='south'?0:facing==='north'?1:2;let frame=dir;
            if(moving){if(p.id===me.id){if(time-this.lastWalk>45)this.walkSince=time;this.lastWalk=time;}const phase=Math.floor((time-(p.id===me.id?this.walkSince:0))/80)%4;frame=[3+dir*2,dir,4+dir*2,dir][phase];}
            sprite.setFrame(frame).setFlipX(facing==='east');this.labels.get(p.id)!.setPosition(sprite.x,sprite.y-26).setDepth(1000);
          }
          const position=this.owner!.position(time);this.cameras.main.centerOn(position.x*TILE+8,position.y*TILE+8);
          const element=this.game.canvas;
          element.dataset.playerX=String(position.x*TILE);element.dataset.playerY=String(position.y*TILE);element.dataset.moving=String(this.owner!.moving(time));element.dataset.moveSeq=String(this.owner!.sequence);element.dataset.region=identity;
          const keyboard=this.input.keyboard!;
          if(props.blocked){keyboard.disableGlobalCapture();this.queuedDirection=undefined;this.interactQueued=false;this.heldKeys.clear();return;}
          keyboard.enableGlobalCapture();
          if(props.interactRequest&&props.interactRequest.id!==this.interactId){this.interactId=props.interactRequest.id;this.interactQueued=true;}
          if(props.moveRequest&&props.moveRequest.id!==this.requestId){this.requestId=props.moveRequest.id;this.queuedDirection=props.moveRequest.direction;}
          if(!this.owner!.ready(time))return;
          if(this.interactQueued){this.interactQueued=false;props.onInteract();return;}
          const direction=this.queuedDirection??this.direction();if(!direction)return;this.queuedDirection=undefined;this.facing=direction;
          const [dx,dy]=DIRECTIONS[direction],from=this.owner!.destination(time),target={x:from.x+dx,y:from.y+dy};
          const outside=target.x<0||target.y<0||target.x>=WIDTH||target.y>=HEIGHT;
          const visibleObjects=sceneObjects(state.region).filter(o=>o.kind!=='item'||!me.collectedItems?.includes(`${state.region.id}:${state.region.sceneId??'outdoor'}:${o.id}`));
          const door=visibleObjects.some(o=>o.kind==='door'&&o.x===target.x&&o.y===target.y);
          const obstacle=!outside&&solidAt({...state.region,objects:visibleObjects},target.x,target.y);
          if(obstacle&&time-this.blockedStepAt<130)return;if(obstacle)this.blockedStepAt=time;
          const seq=this.owner!.begin(outside||door||obstacle?from:target,time,!outside&&!door&&!obstacle,state.stepMs);
          if(seq!==null)props.onMove(direction,seq);
        }
      }
      game=new Phaser.Game({type:Phaser.CANVAS,parent:container.current!,width:240,height:160,pixelArt:true,roundPixels:true,backgroundColor:'#101820',scene:Scene,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},audio:{noAudio:true}});
    });
    return()=>{disposed=true;game?.destroy(true);};
  },[]);
  return <div ref={container} className="game-canvas" tabIndex={0} onPointerDown={()=>container.current?.focus({preventScroll:true})} role="img" aria-label={`${props.state.region.name}. Hold arrows or WASD to walk. Face an object and press E to interact.`}/>;
}
