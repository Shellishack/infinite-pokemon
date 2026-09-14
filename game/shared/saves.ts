export interface SaveSummary { location:string; trainer:string; tutorial:number; companions:number; places:number; eventSeq:number }
export interface SavedRun { id:string;name:string;createdAt:number;parentCheckpointId:string|null;headCheckpointId:string|null;preview:boolean;summary:SaveSummary|null }
export interface Checkpoint { id:string;runId:string;parentId:string|null;name:string;createdAt:number;summary:SaveSummary;hash:string }
export interface SaveCatalog { currentRunId:string;runs:SavedRun[];checkpoints:Checkpoint[] }
