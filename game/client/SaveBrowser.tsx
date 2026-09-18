import {useEffect,useState,useRef} from 'react';
import type {SaveCatalog,Checkpoint} from '../shared/saves';
import {commandId} from './identity';

export default function SaveBrowser({hostToken,onClose}:{hostToken:string;onClose:()=>void}){
  const [catalog,setCatalog]=useState<SaveCatalog>(),[selectedRun,setSelectedRun]=useState(''),[selectedCheckpoint,setSelectedCheckpoint]=useState('');
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const pending=useRef<{key:string;id:string}|undefined>(undefined);
  async function api(path:string,data?:unknown){const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'x-host-token':hostToken,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error??'The save could not be opened.');return result;}
  useEffect(()=>{let active=true;void api('/api/saves').then((value:SaveCatalog)=>{if(active){setCatalog(value);setSelectedRun(value.currentRunId);}}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[hostToken]);
  async function perform(task:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setNotice('');try{await task();}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
  const go=async(path:string,data:Record<string,unknown>)=>{const key=path+JSON.stringify(data);if(pending.current?.key!==key)pending.current={key,id:commandId()};const result=await api(path,{...data,requestId:pending.current!.id});pending.current=undefined;location.assign(result.url);};
  if(!catalog)return <p role="status">{error||'Opening your saves…'}</p>;
  const current=catalog.runs.find(run=>run.id===catalog.currentRunId)!,run=catalog.runs.find(run=>run.id===selectedRun)??current;
  const checkpoint=catalog.checkpoints.find(checkpoint=>checkpoint.id===selectedCheckpoint);
  const children=new Map<string|null,Checkpoint[]>();for(const checkpoint of catalog.checkpoints){const siblings=children.get(checkpoint.parentId)??[];siblings.push(checkpoint);children.set(checkpoint.parentId,siblings);}
  const rows:Array<{checkpoint:Checkpoint;depth:number}>=[],stack=(children.get(null)??[]).map(checkpoint=>({checkpoint,depth:0})).reverse(),seen=new Set<string>();
  while(stack.length){const row=stack.pop()!;if(seen.has(row.checkpoint.id))continue;seen.add(row.checkpoint.id);rows.push(row);stack.push(...(children.get(row.checkpoint.id)??[]).map(checkpoint=>({checkpoint,depth:row.depth+1})).reverse());}
  const date=(at:number)=>new Date(at).toLocaleString(undefined,{dateStyle:'short',timeStyle:'short'});
  return <div className="save-browser">
    <p className="save-current">Playing <strong>{current.name}</strong> · {current.preview?'Tutorial preview':'Full world'}</p>
    <p className="save-explanation">Progress saves automatically in this run. Checkpoints preserve an exact moment. Branching makes a separate world and story history.</p>
    <form className="save-create" onSubmit={event=>{event.preventDefault();void perform(async()=>{const result=await api('/api/host/saves/checkpoint',{name:name.trim()||'Checkpoint',requestId:commandId()});setCatalog(result.catalog);setSelectedCheckpoint(result.checkpoint.id);setNotice('Checkpoint saved. You can keep playing from here.');setName('');});}}>
      <label className="field">Save or run name<input maxLength={48} value={name} onChange={event=>setName(event.target.value)} placeholder="Give this moment a name"/></label>
      <div className="button-row"><button className="button primary" disabled={busy||!current.summary}>Save checkpoint</button><button type="button" className="button" disabled={busy} onClick={()=>void perform(()=>go('/api/host/saves/new',{name:name.trim()||'New run'}))}>New {current.preview?'tutorial ':''}run</button></div>
    </form>
    <div className="save-import">
      <h3>Import a browser-demo save</h3>
      <p className="small-copy">Bring a save exported from the website demo into a new isolated run. Your existing runs are never changed.</p>
      <input type="file" accept="application/json,.json" aria-label="Choose a demo save file" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;void perform(async()=>{const text=await file.text();const result=await api('/api/host/import',{save:text});location.assign(result.previewUrl);});}}/>
    </div>
    {error?<p role="alert" className="save-error">{error}</p>:null}{notice?<p role="status" className="save-success">{notice}</p>:null}
    <div className="save-columns">
      <section aria-label="Runs"><h3>Your runs</h3><div className="save-run-list">{catalog.runs.map(item=><button key={item.id} className={'save-run '+(run.id===item.id?'selected':'')} aria-pressed={run.id===item.id} onClick={()=>{setSelectedRun(item.id);setSelectedCheckpoint('');}}><strong>{item.name}</strong><small>{item.id===current.id?'CURRENT · ':''}{item.summary?.location??'Not started'}{item.parentCheckpointId?' · BRANCH':''}</small></button>)}</div>
        <p className="save-run-detail">{run.summary?`${run.summary.companions} Pokémon · ${run.summary.places} places · ${run.summary.tutorial}/5 lessons`:'A new adventure is waiting.'}</p>
        {run.parentCheckpointId?<p className="save-origin">Branched from “{catalog.checkpoints.find(item=>item.id===run.parentCheckpointId)?.name??'checkpoint'}”.</p>:null}
        <button className="button" disabled={busy} onClick={()=>run.id===current.id?onClose():void perform(()=>go('/api/host/saves/open',{runId:run.id}))}>Continue run</button>
      </section>
      <section aria-label="Checkpoint tree"><h3>Checkpoint tree</h3>{rows.length?<ul className="checkpoint-tree">{rows.map(({checkpoint:item,depth})=><li key={item.id} style={{marginLeft:Math.min(depth,8)*14}}><button className={'checkpoint-node '+(checkpoint?.id===item.id?'selected':'')} aria-pressed={checkpoint?.id===item.id} onClick={()=>setSelectedCheckpoint(item.id)}><strong>{item.name}</strong><small>{catalog.runs.find(run=>run.id===item.runId)?.name} · {date(item.createdAt)}</small><small>{item.summary.location} · {item.summary.tutorial}/5 lessons</small></button></li>)}</ul>:<p>No checkpoints yet. Start a run to create its first checkpoint.</p>}</section>
    </div>
    {checkpoint?<section className="save-branch-detail" aria-label="Selected checkpoint"><h3>{checkpoint.name}</h3><p>{checkpoint.summary.trainer} · {checkpoint.summary.companions} Pokémon · {checkpoint.summary.places} places · {checkpoint.summary.tutorial}/5 lessons</p><p>Continue from this moment in a new branch. Later events in the original run stay there.</p><button className="button primary" disabled={busy} onClick={()=>void perform(()=>go('/api/host/saves/fork',{checkpointId:checkpoint.id,name:name.trim()||'Branch from '+checkpoint.name.slice(0,28)}))}>Branch from checkpoint</button></section>:null}
    <p className="save-footnote">The host manages the shared run in multiplayer. Close the session before switching while guests are connected. Full-world branches may need their Codex connection verified.</p>
  </div>;
}
