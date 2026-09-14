import {existsSync,lstatSync,mkdirSync,realpathSync,renameSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';

// Only app-owned content inside the configured data directory is reset.
const owned=['world.sqlite','world.sqlite-wal','world.sqlite-shm','save-library','previews','context','generated-content','generation','harness','backups'];
export function stageGameReset(directory:string){
  const root=realpathSync(resolve(directory));
  const paths=owned.map(name=>({name,path:resolve(root,name)})).filter(item=>existsSync(item.path));
  for(const item of paths){
    if(!item.path.startsWith(root+sep)||lstatSync(item.path).isSymbolicLink())throw new Error('Reset refused: a game data path is outside its expected location.');
  }
  const staging=join(root,'.reset-'+randomUUID());mkdirSync(staging);
  const moved:typeof paths=[];
  const rollback=()=>{for(const item of [...moved].reverse())renameSync(join(staging,item.name),item.path);rmSync(staging,{recursive:true,force:true});};
  try{for(const item of paths){renameSync(item.path,join(staging,item.name));moved.push(item);}}
  catch(error){rollback();throw error;}
  return {rollback,commit:()=>rmSync(staging,{recursive:true,force:true})};
}
