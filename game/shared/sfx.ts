export const SFX_CUES=['select','menu-open','menu-close','footstep','bump','door','travel','interact','encounter','attack','hit','heal','pickup','purchase','save','capture-throw','capture-success','level-up','hatch','escape','error','send-out'] as const;
export type SfxCue=typeof SFX_CUES[number];
export const isSfxCue=(value:unknown):value is SfxCue=>typeof value==='string'&&(SFX_CUES as readonly string[]).includes(value);
