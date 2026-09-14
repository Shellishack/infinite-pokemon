import assert from 'node:assert/strict';
import {expect,type Page} from '@playwright/test';
import {DIRECTIONS,WIDTH,HEIGHT,TILE,SPECIES,creatureInfo,type Direction,type Player,type Region,type SceneObject} from '../game/shared/model.js';
import {getScene,solidAt,sceneObjects,objectContains} from '../game/shared/scene.js';

const keys:Record<Direction,string>={north:'ArrowUp',south:'ArrowDown',west:'ArrowLeft',east:'ArrowRight'};
export class BrowserGame {
  constructor(public page:Page,public player:()=>Player,public region:(id:string)=>Region|undefined){}
  scene(){const p=this.player(),scene=getScene(this.region(p.regionId)!,p.sceneId);return {...scene,objects:sceneObjects(scene).filter(o=>o.kind!=='item'||!p.collectedItems?.includes(p.regionId+':'+(p.sceneId??'outdoor')+':'+o.id))};}
  pathTo(goal:{x:number;y:number}):Direction[]|undefined{
    const p=this.player(),scene=this.scene(),start=p.y*WIDTH+p.x,target=goal.y*WIDTH+goal.x;
    const costs=new Map([[start,0]]),prior=new Map<number,{id:number;direction:Direction}>(),open=[start];
    while(open.length){open.sort((a,b)=>costs.get(a)!-costs.get(b)!);const id=open.shift()!;if(id===target){const result:Direction[]=[];let current=id;while(current!==start){const previous=prior.get(current)!;result.push(previous.direction);current=previous.id;}return result.reverse();}
      const x=id%WIDTH,y=Math.floor(id/WIDTH);
      for(const [direction,[dx,dy]] of Object.entries(DIRECTIONS) as [Direction,readonly[number,number]][]){const nx=x+dx,ny=y+dy,n=ny*WIDTH+nx;if(nx<0||ny<0||nx>=WIDTH||ny>=HEIGHT||solidAt(scene,nx,ny))continue;
        if(n!==target&&sceneObjects(scene).some(o=>o.kind==='door'&&objectContains(o,nx,ny)))continue;
        const score=costs.get(id)!+(scene.tiles[n]===3?30:scene.tiles[n]===1?1:2);if(score>=(costs.get(n)??Infinity))continue;costs.set(n,score);prior.set(n,{id,direction});if(!open.includes(n))open.push(n);
      }
    }
  }
  async settle(){
    await expect(this.page.locator('.game-canvas canvas')).toHaveAttribute('data-moving','false',{timeout:8000});
    await expect.poll(()=>{const m=this.player().movement;return !m?.accepted||Date.now()>=m.startedAt+m.duration;},{timeout:2000,intervals:[20]}).toBe(true);
    await expect.poll(async()=>Number(await this.page.locator('.game-canvas canvas').getAttribute('data-player-x'))).toBe(this.player().x*TILE);
    await expect.poll(async()=>Number(await this.page.locator('.game-canvas canvas').getAttribute('data-player-y'))).toBe(this.player().y*TILE);
  }
  async goTo(goal:{x:number;y:number}){
    for(let retry=0;retry<8;retry++){
      if(this.player().x===goal.x&&this.player().y===goal.y){await this.settle();return;}
      const path=this.pathTo(goal);assert.ok(path,'No path to '+JSON.stringify(goal)+' in '+this.scene().name);
      let interrupted=false;
      for(let index=0;index<path.length;){
        const direction=path[index],[dx,dy]=DIRECTIONS[direction];let count=1;while(path[index+count]===direction)count++;
        const expected={x:this.player().x+dx*count,y:this.player().y+dy*count},sceneId=this.player().sceneId;
        await this.page.locator('.game-canvas canvas').focus();await this.page.keyboard.down(keys[direction]);
        try{await expect.poll(()=>!!this.player().battle||this.player().sceneId!==sceneId||this.player().x===expected.x&&this.player().y===expected.y,{timeout:Math.max(5000,count*500),intervals:[15,20]}).toBe(true);}
        finally{await this.page.keyboard.up(keys[direction]);}
        if(this.player().battle){await this.runAway();interrupted=true;break;}
        if(this.player().sceneId!==sceneId){await this.settle();return;}
        await this.settle();index+=count;
      }
      if(!interrupted){assert.equal(this.player().x,goal.x);assert.equal(this.player().y,goal.y);return;}
    }
    throw new Error('Too many incidental encounters while navigating');
  }
  candidates(object:SceneObject){
    const scene=this.scene(),options:Array<{x:number;y:number;direction:Direction;path:Direction[]}>=[];
    for(let y=object.y;y<object.y+(object.height??1);y++)for(let x=object.x;x<object.x+(object.width??1);x++)for(const [direction,[dx,dy]] of Object.entries(DIRECTIONS) as [Direction,readonly[number,number]][]){
      const point={x:x-dx,y:y-dy};if(solidAt(scene,point.x,point.y)||objectContains(object,point.x,point.y))continue;const path=this.pathTo(point);if(path)options.push({...point,direction,path});
    }
    return options.sort((a,b)=>a.path.length-b.path.length);
  }
  async face(object:SceneObject){
    const option=this.candidates(object)[0];assert.ok(option,'Object has no reachable interaction edge: '+object.id);
    await this.goTo(option);const before={x:this.player().x,y:this.player().y};
    if(this.player().facing!==option.direction){await this.page.locator('.game-canvas canvas').focus();await this.page.keyboard.down(keys[option.direction]);try{await expect.poll(()=>this.player().facing,{intervals:[15,20]}).toBe(option.direction);}finally{await this.page.keyboard.up(keys[option.direction]);}}
    await this.settle();assert.equal(this.player().x,before.x);assert.equal(this.player().y,before.y);return option;
  }
  object(roleOrId:string){const result=sceneObjects(this.scene()).find(o=>o.role===roleOrId||o.id===roleOrId);assert.ok(result,'Missing object '+roleOrId+' in '+this.scene().name);return result;}
  async interact(object:SceneObject){await this.face(object);await expect(this.page.getByRole('button',{name:'Interact',exact:true})).toBeEnabled();await this.page.getByRole('button',{name:'Interact',exact:true}).click();}
  async continue(){await this.page.getByRole('dialog').getByRole('button',{name:/Continue/}).click();}
  async practice(){await this.interact(this.object('guide'));await this.page.getByRole('dialog').getByRole('button',{name:/Practice battle|Practice catching/}).click();await this.readyBattle();}
  async readyBattle(){await expect(this.page.locator('.gba-battle')).toHaveAttribute('data-playback','ready',{timeout:25000});}
  async attack(special=false){await this.readyBattle();const before=this.player().battle!.round;await this.page.getByRole('button',{name:'FIGHT',exact:true}).click();const current=this.player().party[this.player().active],struggle=current.pp?.attack===0&&current.pp.special===0;await this.page.getByRole('button',{name:struggle?'Struggle':special?creatureInfo(current).move:'Tackle',exact:true}).click();await expect.poll(()=>this.player().battle?.round).toBeGreaterThan(before);await this.readyBattle();}
  async closeBattle(){await expect(this.page.getByRole('button',{name:'Back to the adventure',exact:true})).toBeEnabled({timeout:25000});await this.page.getByRole('button',{name:'Back to the adventure',exact:true}).click();await expect(this.page.locator('.gba-battle')).toHaveCount(0);await this.settle();}
  async winBattle(){for(let i=0;i<16&&!this.player().battle?.finished;i++)await this.attack(true);assert.equal(this.player().battle?.won,true);await this.closeBattle();}
  async runAway(){await this.readyBattle();if(!this.player().battle?.finished){await this.page.getByRole('button',{name:'RUN',exact:true}).click();await expect.poll(()=>this.player().battle?.finished).toBe(true);}await this.closeBattle();}
  async travel(direction:Direction,targetId:string){
    const scene=this.scene(),next=this.region(targetId),edge:Array<{x:number;y:number;path:Direction[]}>=[];
    for(let k=0;k<(direction==='north'||direction==='south'?WIDTH:HEIGHT);k++){
      const point={x:direction==='west'?0:direction==='east'?WIDTH-1:k,y:direction==='north'?0:direction==='south'?HEIGHT-1:k};
      if(solidAt(scene,point.x,point.y))continue;
      const arrival={x:direction==='west'?WIDTH-1:direction==='east'?0:point.x,y:direction==='north'?HEIGHT-1:direction==='south'?0:point.y};
      if(next&&solidAt(next,arrival.x,arrival.y))continue;const path=this.pathTo(point);if(path)edge.push({...point,path});
    }
    edge.sort((a,b)=>a.path.length-b.path.length);assert.ok(edge[0],'No reachable exit '+direction);await this.goTo(edge[0]);
    await this.page.locator('.game-canvas canvas').focus();await this.page.keyboard.down(keys[direction]);try{await expect.poll(()=>this.player().regionId,{timeout:5000,intervals:[15,20]}).toBe(targetId);}finally{await this.page.keyboard.up(keys[direction]);}await this.settle();
  }
}
