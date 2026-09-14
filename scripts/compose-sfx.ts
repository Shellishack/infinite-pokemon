// Original short effects synthesized locally; no recorded samples.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const rate=22050,root=resolve('game/assets/audio/sfx');mkdirSync(root,{recursive:true});
const tone=(at:number,duration:number,from:number,to=from,wave:'sine'|'square'|'noise'='sine')=>({at,duration,from,to,wave});
const notes=(frequencies:number[],step=.09)=>frequencies.map((f,i)=>tone(i*step,step*1.25,f));
const effects={
 'select':{peak:.22,parts:[tone(0,.055,850,1150)]},
 'menu-open':{peak:.25,parts:notes([440,660,880],.055)},
 'menu-close':{peak:.23,parts:notes([880,660,440],.05)},
 'footstep':{peak:.09,parts:[tone(0,.045,90,55,'noise')]},
 'bump':{peak:.18,parts:[tone(0,.08,130,65,'square')]},
 'door':{peak:.3,parts:[tone(0,.12,170,80,'noise'),tone(.09,.16,260,140)]},
 'travel':{peak:.3,parts:notes([330,440,660,880],.08)},
 'interact':{peak:.24,parts:notes([740,880],.07)},
 'encounter':{peak:.42,parts:[tone(0,.18,180,1200,'square'),tone(.18,.17,1000,250,'square')]},
 'attack':{peak:.35,parts:[tone(0,.14,700,110,'noise'),tone(0,.12,330,90,'square')]},
 'hit':{peak:.36,parts:[tone(0,.1,180,45,'noise'),tone(0,.08,95,50)]},
 'heal':{peak:.4,parts:notes([392,523,659,784,1047,784],.14)},
 'pickup':{peak:.3,parts:notes([659,880,1047],.07)},
 'purchase':{peak:.3,parts:notes([988,1319,988,1568],.065)},
 'save':{peak:.38,parts:notes([523,659,784,1047],.13)},
 'capture-throw':{peak:.3,parts:[tone(0,.25,220,1500,'sine'),tone(.2,.08,900,500,'noise')]},
 'capture-success':{peak:.4,parts:notes([523,659,784,659,1047],.1)},
 'level-up':{peak:.42,parts:notes([392,494,587,784,988,1175],.09)},
 'hatch':{peak:.4,parts:[tone(0,.1,200,400,'noise'),...notes([523,784,659,1047,1319],.13).map(part=>({...part,at:part.at+.18}))]},
 'escape':{peak:.3,parts:[tone(0,.25,700,220),tone(.09,.22,1100,330)]},
 'error':{peak:.24,parts:[tone(0,.09,180,150,'square'),tone(.13,.12,150,100,'square')]},
 'send-out':{peak:.34,parts:notes([330,494,659,988],.06)},
};
const manifest=[];
for(const [id,cue] of Object.entries(effects)){
 const duration=Math.max(...cue.parts.map(p=>p.at+p.duration))+.02,samples=new Float64Array(Math.ceil(duration*rate));let seed=5821;
 for(const part of cue.parts){let phase=0,previous=0;const start=Math.round(part.at*rate),length=Math.round(part.duration*rate);
  for(let i=0;i<length;i++){const t=i/rate,u=i/length,f=part.from*(part.to/part.from)**u;phase+=2*Math.PI*f/rate;let value;
   if(part.wave==='noise'){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;value=(noise+previous)*.5;previous=noise;}
   else if(part.wave==='square'){value=0;for(let h=1;h<=5&&h*f<rate*.45;h+=2)value+=Math.sin(phase*h)/h;}
   else value=Math.sin(phase)+.15*Math.sin(phase*2);
   const envelope=Math.min(1,t/.004,(part.duration-t)/.025)*Math.exp(-u*2.3);samples[start+i]+=value*Math.max(0,envelope);
  }
 }
 let peak=0;for(const value of samples)peak=Math.max(peak,Math.abs(value));const gain=cue.peak/peak,wav=Buffer.alloc(44+samples.length*2);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)wav.writeInt16LE(Math.round(samples[i]*gain*32767),44+i*2);
 writeFileSync(resolve(root,id+'.wav'),wav);manifest.push({id,file:id+'.wav',durationSeconds:samples.length/rate,peak:cue.peak});
}
writeFileSync(resolve(root,'manifest.json'),JSON.stringify({credit:'Original synthesized effects for Infinite Pokémon; no third-party samples.',sampleRate:rate,effects:manifest},null,2));console.log(`Rendered ${manifest.length} original effects.`);
