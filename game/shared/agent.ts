export interface AgentEvent {at:number;message:string}
export interface AgentJob {
  id:string;kind:'map'|'npc'|'verification';state:'running'|'complete'|'failed';
  startedAt:number;endedAt?:number;model?:string;effort?:string;
  tokens?:{input:number;output:number;total:number};events:AgentEvent[];
}
export interface AgentDetails {
  mode:string;state:string;paused:boolean;verified:boolean;mapQueued:number;npcQueued:number;
  used:number;limit:number;batchSize:number;jobs:AgentJob[];now:number;
}
export type AgentUpdate={message?:string;model?:string;effort?:string;tokens?:AgentJob['tokens']};
