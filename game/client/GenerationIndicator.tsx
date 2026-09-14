import type {StreamingState} from '../shared/streaming';

export function GenerationIndicator({background,connected,battle,onOpen}:{background:StreamingState['background'];connected:boolean;battle:boolean;onOpen:()=>void}){
  if(!background)return null;
  const remaining=background.active+background.queued;
  if(!remaining)return null;
  const phase=connected?background.phase:'disconnected';
  const labels={generating:'Generating blocks',queued:'Blocks queued',paused:'Generation paused',budget:'Generation limit reached',disconnected:'Generation disconnected',failed:'Generation failed',ready:'Finishing blocks'};
  return <button type="button" className={`generation-indicator${battle?' in-battle':''}`} aria-label="View agent activity" aria-haspopup="dialog" onClick={onOpen} data-phase={phase}>
    <span className="generation-light" aria-hidden="true"/>
    <span aria-live="polite" aria-atomic="true">{labels[phase]}<small>{remaining} {remaining===1?'block':'blocks'} remaining · Details ›</small></span>
  </button>;
}
