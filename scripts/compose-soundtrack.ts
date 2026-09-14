import {scenarioScores,type Score} from './scenario-scores.js';
// Original score and synthesizer for Infinite Pokémon. No sampled songs.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const SR=22050,output=resolve('game/assets/audio');mkdirSync(output,{recursive:true});
const note=(name:string)=>{if(name==='-')return null;const m=/^([A-G])([#b]?)([1-6])$/.exec(name);if(!m)throw new Error('Invalid score note: '+name);return 12*(Number(m[3])+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1] as 'C'|'D'|'E'|'F'|'G'|'A'|'B'])+(m[2]==='#'?1:m[2]==='b'?-1:0);};
const scores:Score[]=[
 {id:'title',title:'A Map Without an Edge',bpm:112,chords:['C3 E3 G3','A2 C3 E3','F2 A2 C3','G2 B2 D3','C3 E3 G3','E2 G2 B2','F2 A2 C3','G2 B2 D3'],melody:['E5 - G5 A5 G5 E5 D5 -','C5 E5 A5 - G5 E5 C5 -','F5 - E5 D5 C5 A4 C5 D5','B4 D5 G5 - A5 G5 D5 -','E5 G5 C6 - B5 G5 E5 -','G5 E5 B4 D5 E5 - G5 -','A5 G5 F5 E5 D5 C5 A4 C5','D5 E5 G5 D5 B4 D5 G5 -'],beat:'light'},
 {id:'exploration',title:'Footsteps Beyond the Valley',bpm:120,chords:['G2 B2 D3','E2 G2 B2','C3 E3 G3','D3 F#3 A3','G2 B2 D3','B2 D3 F#3','C3 E3 G3','D3 F#3 A3'],melody:['G4 B4 D5 - E5 D5 B4 A4','G4 - B4 E5 D5 B4 G4 -','E5 G5 E5 D5 C5 - G4 E4','F#4 A4 D5 E5 F#5 E5 D5 -','B4 D5 G5 - F#5 D5 B4 D5','F#5 E5 D5 B4 A4 B4 D5 -','E5 D5 C5 G4 E4 G4 C5 E5','D5 A4 F#4 A4 D5 E5 F#5 -'],beat:'walk'},
 {id:'interior',title:'Lanterns and Linen',bpm:84,chords:['F2 A2 C3','C3 E3 G3','D3 F3 A3','Bb2 D3 F3','F2 A2 C3','A2 C3 E3','Bb2 D3 F3','C3 E3 G3'],melody:['A4 - - C5 - A4 G4 -','E4 - G4 - C5 - - -','F4 - A4 D5 - C5 A4 -','Bb4 - A4 - F4 - D4 -','C5 - A4 G4 F4 - - -','E4 A4 - C5 B4 - A4 -','F4 - Bb4 A4 G4 F4 - D4','E4 - G4 - C5 - G4 -'],beat:'soft'},
 {id:'battle',title:'Sparks at the Crossroads',bpm:144,chords:['D2 F2 A2','Bb1 D2 F2','G2 Bb2 D3','A2 C#3 E3','D2 F2 A2','C2 E2 G2','Bb1 D2 F2','A2 C#3 E3'],melody:['D5 A4 D5 F5 E5 D5 A4 C5','D5 F5 Bb5 A5 F5 D5 F5 -','G5 D5 G5 Bb5 A5 G5 F5 E5','C#5 E5 A5 G5 E5 C#5 E5 -','F5 E5 D5 A4 D5 F5 A5 D6','C6 G5 E5 D5 C5 E5 G5 -','Bb5 A5 F5 D5 F5 Bb5 A5 G5','E5 C#5 A4 C#5 E5 G5 A5 -'],beat:'drive'},
 {id:'victory',title:'A New Page',bpm:132,chords:['C3 E3 G3','F2 A2 C3','G2 B2 D3','C3 E3 G3'],melody:['G4 C5 E5 G5 C6 - G5 -','A5 G5 F5 E5 F5 - C5 -','D5 G5 B5 D6 C6 B5 G5 -','C6 - - - - - - -'],beat:'light',once:true},
];
scores.push(...scenarioScores);
const ids=new Set();
for(const song of scores){
 if(!/^[a-z][a-z0-9-]*$/.test(song.id)||ids.has(song.id))throw new Error('Invalid or duplicate track ID');ids.add(song.id);
 if(!Number.isFinite(song.bpm)||song.bpm<50||song.bpm>200||song.chords.length!==song.melody.length||song.chords.length<1||song.chords.length>64)throw new Error('Invalid score structure: '+song.id);
 if(!['soft','light','walk','drive'].includes(song.beat)||song.lead&&!['pulse','triangle','bell'].includes(song.lead))throw new Error('Unsupported instrument or rhythm');
 for(const chord of song.chords){const notes=chord.split(' ');if(notes.length!==3||notes.some(n=>n==='-'))throw new Error('Each chord needs three pitches');notes.forEach(note);}
 for(const bar of song.melody){const notes=bar.split(' ');if(notes.length!==8)throw new Error('Each melody bar needs eight steps');notes.forEach(note);}
}
const manifest=[];
for(const song of scores){
 const beat=60/song.bpm,bars=song.chords.length,total=bars*4*beat,data=new Float64Array(Math.round(total*SR));let seed=92571;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 function voice(midi:number|null,start:number,duration:number,amp:number,kind='pulse',pan=0){
  if(midi===null)return;const freq=440*2**((midi-69)/12),first=Math.round(start*SR),length=Math.floor(duration*SR),attack=.008,release=Math.min(.07,duration*.25);
  for(let j=0;j<length&&first+j<data.length;j++){const t=j/SR,p=freq*t;let wave=0;
   if(kind==='triangle'){for(let h=1;h<=9;h+=2)wave+=Math.sin(2*Math.PI*p*h)*((-1)**((h-1)/2))/(h*h);wave*=.8;}
   else if(kind==='bell'){wave=Math.sin(2*Math.PI*p)*.8+Math.sin(2*Math.PI*p*2)*.16;}
   else{for(let h=1;h<=Math.min(11,Math.floor(SR*.42/freq));h++)wave+=Math.sin(Math.PI*h*.28)*Math.cos(2*Math.PI*p*h)/h;wave*=.6;}
   const env=Math.min(1,t/attack,(duration-t)/release)*Math.exp(-t/(kind==='bell'?.26:2));data[first+j]+=wave*amp*Math.max(0,env);
  }
 }
 function drum(start:number,kind:string){const first=Math.round(start*SR),length=Math.round(SR*(kind==='kick'?.13:kind==='snare'?.1:.035));let previous=0;
  for(let j=0;j<length&&first+j<data.length;j++){const t=j/SR,noise=rand(),high=noise-previous;previous=noise;const v=kind==='kick'?Math.sin(2*Math.PI*(48*t+10*(1-Math.exp(-t*35))))*.17:high*(kind==='snare'?.038:.014);data[first+j]+=v*Math.exp(-t/(kind==='kick'?.035:.022));}
 }
 for(let bar=0;bar<bars;bar++){
  const chord=song.chords[bar].split(' ').map(note),melody=song.melody[bar].split(' ').map(note),start=bar*4*beat;
  for(let step=0;step<8;step++){
   let length=1;while(step+length<8&&melody[step+length]===null)length++;
   voice(melody[step],start+step*beat/2,beat/2*length*.88,song.beat==='drive'?.22:.19,song.lead??(song.id==='interior'?'bell':'pulse'));
   const arp=chord[[0,1,2,1,0,2,1,2][step]]!+12;voice(arp,start+step*beat/2,beat*.4,.075,'triangle');
  }
  for(let step=0;step<4;step++){voice(chord[step%2?2:0],start+step*beat,beat*.73,.17,'triangle');if(song.beat!=='soft'){drum(start+step*beat,step%2?'snare':'kick');drum(start+(step+.5)*beat,'hat');if(song.beat==='drive')drum(start+(step+.75)*beat,'hat');}}
 }
 // Short boundary envelopes avoid clicks without inserting silence between loops.
 const fade=Math.round(SR*(song.once ? .45 : .012));for(let i=0;i<fade;i++){data[i]*=Math.min(1,i/(SR*.012));data[data.length-1-i]*=i/fade;}
 let peak=0,sum=0;for(const v of data){peak=Math.max(peak,Math.abs(v));sum+=v*v;}const gain=.78/Math.max(peak,1e-6),wav=Buffer.alloc(44+data.length*2);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(data.length*2,40);
 for(let i=0;i<data.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,data[i]*gain))*32767),44+i*2);
 writeFileSync(resolve(output,song.id+'.wav'),wav);manifest.push({id:song.id,title:song.title,bpm:song.bpm,durationSeconds:data.length/SR,loop:!song.once,peak:.78,rms:Math.sqrt(sum/data.length)*gain,file:song.id+'.wav'});
}
writeFileSync(resolve(output,'soundtrack.json'),JSON.stringify({credit:'Original compositions and synthesized recordings created for Infinite Pokémon. No third-party samples.',sampleRate:SR,tracks:manifest},null,2));console.log(manifest);
