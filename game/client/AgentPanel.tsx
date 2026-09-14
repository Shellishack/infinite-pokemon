import {useEffect,useState} from 'react';
import type {AgentDetails} from '../shared/agent';

export default function AgentPanel({token}:{token:string}){
  const [data,setData]=useState<AgentDetails|null>(null),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function refresh(){
      try{
        const response=await fetch('/api/agent',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
        if(!response.ok)throw new Error('Agent activity is unavailable. Rejoin the session if this continues.');
        const result:AgentDetails=await response.json();if(controller.signal.aborted)return;
        setData(result);setError('');
      }catch(error){if(!controller.signal.aborted)setError((error as Error).message);}
      if(!controller.signal.aborted)timer=setTimeout(refresh,1000);
    }
    void refresh();return()=>{controller.abort();clearTimeout(timer);};
  },[token]);
  const state=data?.mode==='preview'?'Preview — no agent runs':data?.paused?'Paused':data&&!data.verified?'Connect and verify Codex':data?.jobs.some(job=>job.state==='running')?'Working':data&&data.used>=data.limit?'Job limit reached':'Ready';
  return <div className="agent-panel">
    {error?<p role="alert">Connection lost: {error} {data?'Showing the last received activity.':''}</p>:null}
    {!data?<p role="status">Connecting to agent activity…</p>:<>
      <p className="agent-state" role="status">{state}</p>
      <dl className="agent-facts"><div><dt>Harness</dt><dd>{data.mode==='test'?'Deterministic test harness':data.mode==='preview'?'Not connected':'Host’s local Codex'}</dd></div><div><dt>Batch size</dt><dd>Up to {data.batchSize} blocks at once</dd></div><div><dt>Waiting jobs</dt><dd>{data.mapQueued} maps · {data.npcQueued} NPCs</dd></div><div><dt>Generation jobs</dt><dd>{data.used} used</dd></div><div><dt>Skill</dt><dd>infinite-pokemon-region</dd></div></dl>
      <p className="small-copy">Recent agent runs from this server session. Token counts appear when reported by the harness.</p>
      {!data.jobs.length?<p>No agent activity yet.</p>:data.jobs.map((job,index)=><details key={job.id} className="agent-job" open={index===0?true:undefined}>
        <summary><span>{job.kind==='map'?'World generation':job.kind==='npc'?'NPC behavior':'Harness verification'}</span><span className={`agent-result ${job.state}`}>{job.state} · {Math.max(0,Math.floor(((job.endedAt??data.now)-job.startedAt)/1000))}s</span></summary>
        <dl className="agent-facts"><div><dt>Model</dt><dd>{job.model??(data.mode==='test'?'Test fixture':'Waiting for harness')}</dd></div><div><dt>Effort</dt><dd>{job.effort??'Not reported'}</dd></div><div><dt>Reported tokens</dt><dd>{job.tokens?`${job.tokens.total.toLocaleString()} total · ${job.tokens.input.toLocaleString()} input · ${job.tokens.output.toLocaleString()} output`:'Not reported yet'}</dd></div></dl>
        <ol className="agent-timeline" aria-label="Agent activity timeline">{job.events.map((event,i)=><li key={`${event.at}-${i}`}><time>{new Date(event.at).toLocaleTimeString()}</time><span>{event.message}</span></li>)}</ol>
      </details>)}
    </>}
  </div>;
}
