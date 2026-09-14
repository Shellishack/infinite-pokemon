import type {Region} from './model.js';
export const DEFAULT_RENDER_DEPTH=1,MAX_RENDER_DEPTH=3;
export const DEFAULT_GENERATION_BATCH_SIZE=3,MAX_GENERATION_BATCH_SIZE=8;
export const surroundingMapCount=(depth:number)=>2*depth*(depth+1);
export function mapPrepared(region:Region|undefined){return !!region&&(region.published||region.source!=='fallback'||region.prepared===true);}
export interface MapLoading {targetId:string;name:string;phase:'queued'|'generating'|'failed'|'paused'|'budget'|'disconnected'|'ready';queuePosition:number|null;elapsedMs:number;message:string}
export interface StreamingState {depth:number;nearbyReady:number;nearbyTotal:number;queued:number;background?:{active:number;queued:number;phase:MapLoading['phase']};travel?:MapLoading}
