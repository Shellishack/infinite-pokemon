// WebSocket-compatible transport backed by the in-browser demo worker.
// App.tsx swaps this in when no game server is reachable (static site demo).

export interface DemoHello { hasSave: boolean; storageAvailable: boolean; storageBusy: boolean; }

type Listener=((event:never)=>void)|null;

export class DemoSocket {
  static readonly CONNECTING=0; static readonly OPEN=1; static readonly CLOSING=2; static readonly CLOSED=3;
  readyState: number=DemoSocket.CONNECTING;
  onopen: Listener=null; onmessage: ((event:{data:string})=>void)|null=null;
  onclose: ((event:{code:number;reason:string})=>void)|null=null; onerror: Listener=null;
  private worker: Worker;
  hello: Promise<DemoHello>;
  private resolveHello!: (hello:DemoHello)=>void;
  onExport: ((save:unknown)=>void)|null=null;
  onHello: ((hello:DemoHello)=>void)|null=null;

  constructor(debug=false){
    this.hello=new Promise(resolve=>{this.resolveHello=resolve;});
    this.worker=new Worker(new URL('../../game/browser/worker.ts',import.meta.url));
    if(debug)this.worker.postMessage({type:'configure',debug:true});
    this.worker.onmessage=(event:MessageEvent)=>{
      const data=event.data;
      if(data?.type==='hello'){const hello=data as DemoHello;this.resolveHello(hello);this.onHello?.(hello);return;}
      if(data?.type==='export-data'){this.onExport?.(data.save);return;}
      if(data?.type==='auth-ok'){this.readyState=DemoSocket.OPEN;this.onopen?.(undefined as never);return;}
      if(data?.type==='error'&&this.readyState!==DemoSocket.OPEN){this.readyState=DemoSocket.CLOSED;this.onclose?.({code:1008,reason:String(data.message??'Demo error')});return;}
      this.onmessage?.({data:JSON.stringify(data)});
    };
    this.worker.onerror=()=>{this.readyState=DemoSocket.CLOSED;this.onclose?.({code:1011,reason:'The demo worker failed to start.'});};
  }

  send(data:string){this.worker.postMessage(JSON.parse(data));}
  close(){this.readyState=DemoSocket.CLOSED;this.worker.terminate();this.onclose?.({code:1000,reason:''});}
  /** Demo-only lifecycle messages (create/resume/export/hello). */
  control(message:Record<string,unknown>){this.worker.postMessage(message);}
  downloadSave(save:unknown){
    const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='infinite-pokemon-save.json';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),10_000);
  }
}

// Some web bundlers emit duplicate worker entries for this module; the demo must
// only ever create one worker per page, so the socket is a page-global singleton.
const socketRegistry = globalThis as { __infinitePokemonDemoSocket?: DemoSocket };
export function acquireDemoSocket(debug=false):DemoSocket{
  if(!socketRegistry.__infinitePokemonDemoSocket)socketRegistry.__infinitePokemonDemoSocket=new DemoSocket(debug);
  return socketRegistry.__infinitePokemonDemoSocket;
}
