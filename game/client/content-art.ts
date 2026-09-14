import type {Creature} from '../shared/model';
import type {ItemProfile,VehicleProfile} from '../shared/content';

const svgUrl=(body:string,size=32)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${body}</svg>`);
const rect=(x:number,y:number,w:number,h:number,color:string)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
const cache=new Map<string,string>();
export function creatureImage(creature:Pick<Creature,'species'|'profile'>,back=false){
  const p=creature.profile;if(!p)return '/classic/pokemon/'+creature.species+(back?'-back':'')+'.png';
  const key=p.id+':'+back;if(cache.has(key))return cache.get(key)!;
  const a=p.art,dark='#34444b',main=a.primary,accent=a.accent;let body='';
  const tone=(color:string,amount:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.max(0,parseInt(color.slice(i,i+2),16)+amount)).toString(16).padStart(2,'0')).join('');
  const block=(x:number,y:number,w:number,h:number,color=main)=>{body+=rect(x,y-1,w,1,dark)+rect(x-1,y,w+2,h,dark)+rect(x,y+h,w,1,dark)+rect(x,y,w,h,color)+rect(x+1,y+1,Math.max(1,w-2),Math.min(2,h),tone(color,22))+rect(x+1,y+h-2,Math.max(1,w-2),2,tone(color,-20));};
  if(a.wings){block(2,12,7,8,accent);block(23,12,7,8,accent);body+=rect(0,11,6,4,accent)+rect(26,11,6,4,accent);}
  if(a.form==='fish'){block(23,11,6,14,accent);block(8,12,15,13);block(4,14,7,9);body+=rect(12,9,8,4,accent);}
  else if(a.form==='serpent'){block(5,24,15,4);block(16,17,7,10);block(11,9,12,12);block(8,7,12,7);}
  else if(a.form==='bird'){block(8,16,16,10);block(11,7,12,12);block(23,11,5,4,accent);body+=rect(10,27,4,3,dark)+rect(20,27,4,3,dark);}
  else if(a.form==='golem'){block(8,12,16,14);block(10,6,12,9);block(3,15,4,10,accent);block(25,15,4,10,accent);body+=rect(9,27,5,3,dark)+rect(19,27,5,3,dark);}
  else if(a.form==='sprite'){block(10,13,12,12);block(9,7,14,12);block(5,3,4,10,accent);block(23,3,4,10,accent);body+=rect(6,20,4,5,accent)+rect(22,20,4,5,accent);}
  else{block(7,17,19,9);block(8,8,14,13);block(7,4,4,8,accent);block(20,4,4,8,accent);block(26,14,3,10,accent);body+=rect(8,27,4,3,dark)+rect(22,27,4,3,dark);}
  if(a.horns){body+=rect(10,2,3,6,accent)+rect(19,2,3,6,accent);}
  if(a.pattern==='spots')body+=rect(10,20,3,3,accent)+rect(19,18,3,3,accent)+rect(16,24,2,2,accent);
  if(a.pattern==='stripes')body+=rect(10,20,11,2,accent)+rect(11,24,10,2,accent);
  if(a.pattern==='crest')body+=rect(13,3,6,6,accent)+rect(15,1,3,3,accent);
  if(!back){const y=a.form==='fish'?15:11;body+=rect(11,y,3,4,'#fff8db')+rect(18,y,3,4,'#fff8db')+rect(12,y+1,2,3,dark)+rect(19,y+1,2,3,dark)+rect(14,y+6,4,1,dark);}
  else body+=rect(12,11,8,3,accent);
  const url=svgUrl(body);cache.set(key,url);return url;
}
export function itemImage(item:ItemProfile){const c=item.color,d='#394850';let b='';
  if(item.icon==='orb')b=rect(8,5,16,23,d)+rect(5,8,22,17,d)+rect(7,9,18,8,c)+rect(7,18,18,6,'#f5edd6')+rect(13,14,6,6,d)+rect(15,16,2,2,'#ffffff');
  else if(item.icon==='herb')b=rect(15,11,3,19,d)+rect(5,8,10,8,c)+rect(18,5,9,9,c)+rect(10,18,9,6,c);
  else if(item.icon==='charm')b=rect(13,4,6,24,d)+rect(7,10,18,12,d)+rect(10,11,12,10,c)+rect(14,6,4,20,c);
  else b=rect(12,3,8,6,d)+rect(10,8,12,3,d)+rect(7,11,18,18,d)+rect(9,13,14,14,c)+rect(11,15,3,9,'#fff3d6');
  return svgUrl(b);
}
export function vehicleImage(vehicle:VehicleProfile){const d='#35434a',c=vehicle.color;let b=rect(2,22,8,8,d)+rect(22,22,8,8,d)+rect(4,24,4,4,'#ccd4cc')+rect(24,24,4,4,'#ccd4cc');
  if(vehicle.form==='mount')b=rect(6,12,20,11,c)+rect(20,6,8,14,c)+rect(7,22,4,8,d)+rect(22,22,4,8,d)+rect(12,10,7,4,d);
  else if(vehicle.form==='cart')b+=rect(5,9,22,13,c)+rect(8,11,16,8,'#d6cba9');
  else b+=rect(6,20,20,3,c)+rect(12,14,3,9,c)+rect(22,10,3,14,c)+rect(20,8,9,3,d)+rect(9,12,10,3,d);
  return svgUrl(b);
}
