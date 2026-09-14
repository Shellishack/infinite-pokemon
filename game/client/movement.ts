import { WALK_MS,type MovementState,type Point } from '../shared/model';
interface Step {seq:number;from:Point;to:Point;at:number;duration:number;acknowledged:boolean}
/** One predicted tile at a time, reconciled by explicit server acknowledgments. */
export class TileMotion {
  private anchor:Point;private step?:Step;private correction?:{from:Point;to:Point;at:number;duration:number};
  sequence:number;acknowledgedSequence:number;
  constructor(position:Point,seq=0){this.anchor={...position};this.sequence=seq;this.acknowledgedSequence=seq;}
  reset(position:Point,seq=0){this.anchor={...position};this.step=undefined;this.correction=undefined;this.sequence=Math.max(this.sequence,seq);this.acknowledgedSequence=seq;}
  position(now:number):Point{
    if(this.correction){const c=this.correction,t=Math.min(1,Math.max(0,(now-c.at)/c.duration));if(t===1){this.anchor={...c.to};this.correction=undefined;}return{x:c.from.x+(c.to.x-c.from.x)*t,y:c.from.y+(c.to.y-c.from.y)*t};}
    if(!this.step)return{...this.anchor};
    const s=this.step,t=s.duration?Math.min(1,Math.max(0,(now-s.at)/s.duration)):1;return{x:s.from.x+(s.to.x-s.from.x)*t,y:s.from.y+(s.to.y-s.from.y)*t};
  }
  settle(now:number){if(this.step&&this.step.acknowledged&&now>=this.step.at+this.step.duration){this.anchor={...this.step.to};this.step=undefined;}this.position(now);}
  ready(now:number){this.settle(now);return !this.step&&!this.correction;}
  moving(now:number){return !!this.correction||!!this.step&&now<this.step.at+this.step.duration&&(this.step.to.x!==this.step.from.x||this.step.to.y!==this.step.from.y);}
  destination(now:number){this.settle(now);return this.step?{...this.step.to}:{...this.anchor};}
  begin(to:Point,now:number,animate=true,duration=WALK_MS){if(!this.ready(now))return null;const seq=++this.sequence;this.step={seq,from:{...this.anchor},to:{...to},at:now,duration:animate?duration:0,acknowledged:false};return seq;}
  acknowledge(m:MovementState,now:number){
    if(m.seq<this.acknowledgedSequence)return;const newer=m.seq>this.acknowledgedSequence;this.acknowledgedSequence=m.seq;this.sequence=Math.max(this.sequence,m.seq);const point={x:m.toX,y:m.toY};
    if(this.step&&m.seq<this.step.seq)return;
    if(m.accepted&&m.duration===0){this.step=undefined;this.correction=undefined;this.anchor=point;return;}
    if(this.step&&m.seq===this.step.seq){const prior=this.position(now);
      if(point.x!==this.step.to.x||point.y!==this.step.to.y){this.step=undefined;const distance=Math.abs(prior.x-point.x)+Math.abs(prior.y-point.y);if(distance>0&&distance<2)this.correction={from:prior,to:point,at:now,duration:64};else this.anchor=point;}
      else{this.step.acknowledged=true;if(!m.accepted)this.step.duration=0;}
    }else{this.step=undefined;if(newer)this.correction=undefined;this.anchor=point;}
    this.settle(now);
  }
  sync(position:Point,seq:number,now:number){
    if(this.step&&!this.step.acknowledged&&now-this.step.at>1500){this.reset(seq>=this.acknowledgedSequence?position:this.anchor,Math.max(seq,this.acknowledgedSequence));return;}
    if(!this.step&&!this.correction&&seq>=this.acknowledgedSequence){this.anchor={...position};this.acknowledgedSequence=seq;this.sequence=Math.max(this.sequence,seq);}
  }
}
export function sampleTrajectory(m:MovementState,time:number):Point{const t=m.duration?Math.min(1,Math.max(0,(time-m.startedAt)/m.duration)):1;return{x:m.fromX+(m.toX-m.fromX)*t,y:m.fromY+(m.toY-m.fromY)*t};}
