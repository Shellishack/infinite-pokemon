// Explicitly authorized smoke test: one probe and at most five map jobs.
// This is not part of npm test and never retries model calls automatically.
import { createGameServer } from '../game/server/index.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const marker=resolve('data/live-smoke-authorization-used.json');
const prior=existsSync('research/results/live-smoke.json')?JSON.parse(readFileSync('research/results/live-smoke.json','utf8')):null;
const previousMarker=existsSync(marker)?JSON.parse(readFileSync(marker,'utf8')):null;
// A provider rejection before model execution did not perform a verification.
// Permit one compatibility retry after installing the required runtime; never retry a completed or uncertain model job.
const compatibilityRetry=previousMarker&&!previousMarker.compatibilityRetry&&!prior?.probe&&prior?.status?.used===0&&String(prior?.error).includes('requires a newer version of Codex');
if(previousMarker&&!compatibilityRetry)throw new Error('The bounded live-test allowance has already been used.');
mkdirSync('data',{recursive:true});mkdirSync('research/results',{recursive:true});
const app=await createGameServer({dataDir:resolve('data/live-world'),port:8810,adminPort:8811,dev:true});
const base=`http://127.0.0.1:${app.adminPort}`;
const post=async(path:string,data:unknown)=>{const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json','x-host-token':app.hostToken},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;};
const report:{startedAt:string;probe?:string;maps?:number;durationMs?:number;error?:string;status?:unknown}={startedAt:new Date().toISOString()};
const started=Date.now();let last='';const timer=setInterval(()=>{const s=app.generator.status;const line=`${s.state}: ${s.completed} accepted map jobs, ${s.failed} rejected, ${s.used}/5 attempted. ${s.message}`;if(line!==last){console.log(line);last=line;}},3000);
try{
  await post('/api/host/connect',{});
  if(compatibilityRetry)writeFileSync('research/results/live-smoke-runtime-rejection.json',JSON.stringify(prior,null,2));
  writeFileSync(marker,JSON.stringify({authorizedAt:new Date().toISOString(),maxSuccessfulProbeCalls:1,maxMapJobs:5,compatibilityRetry:!!compatibilityRetry},null,2));
  await post('/api/host/verify',{consent:true,limit:5});report.probe='passed';
  await post('/api/host/start',{sessionMode:'singleplayer'});
  // Playable readiness is immediate; the finite trial separately waits for
  // the tracked enrichment task. These polls never request additional jobs.
  const deadline=Date.now()+1_050_000;
  while(true){
    const state=await(await fetch(base+'/api/bootstrap')).json();
    if(!state.starting)break;
    if(Date.now()>deadline)throw new Error('Initial enrichment did not settle before the observation deadline.');
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  report.maps=app.generator.status.completed;
  console.log(`Live world ready: ${base}`);
}catch(error){report.error=(error as Error).message;console.error(report.error);}
finally{clearInterval(timer);report.durationMs=Date.now()-started;report.status=app.generator.status;writeFileSync('research/results/live-smoke.json',JSON.stringify(report,null,2));}
console.log('Host console remains open for review. No further generation can exceed the five-job limit.');
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
