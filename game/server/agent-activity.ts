import {randomUUID} from 'node:crypto';
import type {AgentJob,AgentUpdate} from '../shared/agent.js';

// Deliberately record operational metadata, never raw tool output or reasoning.
export class AgentActivity {
  jobs:AgentJob[]=[];
  begin(kind:AgentJob['kind']){
    const job:AgentJob={id:randomUUID(),kind,state:'running',startedAt:Date.now(),events:[]};
    this.jobs=[job,...this.jobs.filter(item=>item.state==='running'),...this.jobs.filter(item=>item.state!=='running').slice(0,8)];
    const update=(event:AgentUpdate)=>{
      if(job.state!=='running')return;
      if(event.model)job.model=event.model;
      if(event.effort)job.effort=event.effort;
      if(event.tokens)job.tokens=event.tokens;
      if(event.message){job.events.push({at:Date.now(),message:event.message});job.events=job.events.slice(-24);}
    };
    update({message:kind==='verification'?'Checking the local Codex connection.':'Preparing saved context and agent skill.'});
    return {update,finish:(error?:unknown)=>{
      update({message:error?failureSummary(error):kind==='verification'?'Codex connection confirmed.':'Validated result saved to this run.'});
      job.state=error?'failed':'complete';job.endedAt=Date.now();
    }};
  }
}
function failureSummary(error:unknown){
  const message=error instanceof Error?error.message:'';
  if(/time.*budget|timed out/i.test(message))return 'Agent time limit reached. Retry from generation settings or the destination.';
  if(/disconnect|account|harness changed/i.test(message))return 'Harness connection changed. The host needs to reconnect and verify.';
  if(/stale|changed before|snapshot mismatch/i.test(message))return 'Saved context changed; the result was discarded.';
  if(/schema|structured output|invalid|validation/i.test(message))return 'Agent output did not pass validation.';
  if(/interrupt|cancel|shutting down/i.test(message))return 'Agent job was interrupted.';
  return 'Agent job failed. Diagnostic details were saved on the host.';
}
