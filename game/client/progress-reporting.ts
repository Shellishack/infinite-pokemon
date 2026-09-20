import type {GameState} from '../shared/model';
const ENDPOINT='https://infinite-pokemon-blond.vercel.app/api/leaderboard',IDENTITY_KEY='infinite-pokemon-global-progress-v1';
interface Identity{playerId:string;secret:string}
let lastFingerprint='',pending=false,timer:ReturnType<typeof setTimeout>|undefined;
export function reportGlobalProgress(state:GameState,source:'browser'|'local'){
  if(new URLSearchParams(location.search).has('no-progress-report'))return;
  const me=state.me,stats=me.stats,progress={displayName:me.name,source,tutorial:me.tutorial,maps:new Set(me.visited).size,species:new Set(stats?.caughtSpecies??[]).size,captures:stats?.captures??0,trainers:new Set(stats?.defeatedTrainers??[]).size,tiles:stats?.tiles??0,steps:me.steps};
  const fingerprint=JSON.stringify(progress);if(fingerprint===lastFingerprint||pending)return;clearTimeout(timer);
  timer=setTimeout(async()=>{pending=true;try{let identity:Identity|undefined;try{identity=JSON.parse(localStorage.getItem(IDENTITY_KEY)??'null')??undefined;}catch{localStorage.removeItem(IDENTITY_KEY);}const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity,progress}),keepalive:true});if(response.status===401||response.status===404){localStorage.removeItem(IDENTITY_KEY);return;}if(!response.ok)return;const result=await response.json() as {identity?:Identity};if(result.identity)localStorage.setItem(IDENTITY_KEY,JSON.stringify(result.identity));lastFingerprint=fingerprint;}catch{/* Reporting never interrupts play. */}finally{pending=false;}},1500);
}
