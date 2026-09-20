import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { networkInterfaces } from 'node:os';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { Store } from './store.js';
import { SaveLibrary } from './saves.js';
import {stageGameReset} from './reset.js';
import { MapStreaming } from './streaming.js';
import {MAX_GENERATION_BATCH_SIZE} from '../shared/streaming.js';
import { World,GameError } from '../engine/world.js';
import { Generator } from './harness.js';
import { loadPreviewPack,PREVIEW_REGION_IDS } from './preview.js';
import { parsePortableSave,applyPortableSave } from './import.js';
import { upgradeLegacyLayouts } from '../engine/maps.js';
import { commandSchema } from '../shared/model.js';

async function body(req:IncomingMessage,maxBytes=8192){let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw new Error('Request is too large.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function send(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export interface ServerOptions { dataDir?:string;port?:number;adminPort?:number;host?:string;dev?:boolean;fixture?:boolean;preview?:boolean;parentUrl?:string;saveLibrary?:SaveLibrary }
export interface GameServer {world:World;store:Store;generator:Generator;port:number;adminPort:number;hostToken:string;readonly ready:boolean;readonly preview:boolean;previewChildren:ReadonlySet<GameServer>;close():Promise<void>}
const sessionModeSchema=z.enum(['singleplayer','multiplayer']);
export async function createGameServer(options:ServerOptions={}):Promise<GameServer>{
  let store=new Store(resolve(options.dataDir??process.env.INFINITE_DATA_DIR??'data'));
  if(options.preview)loadPreviewPack(store);
  upgradeLegacyLayouts(store);
  let previewActive=options.preview===true&&store.meta('previewPromoted')!=='true';
  let saveLibrary=options.saveLibrary??new SaveLibrary(store.root),savedRun=saveLibrary.register(store,previewActive),runId=savedRun.id;
  let world=new World(store,previewActive?PREVIEW_REGION_IDS:undefined), generator=new Generator(store,options.fixture??false);
  let streaming=new MapStreaming(world,generator,()=>previewActive);
  const viewState=(pid:string)=>({...world.view(pid,generator.status),streaming:streaming.view(pid)});
  function wireGeneration(){world.onFrontier=previewActive?()=>{}:()=>streaming.refresh();world.onNpc=previewActive?()=>{}:id=>generator.enqueueNpc(id);}
  wireGeneration();if(previewActive){generator.status.mode='preview';generator.status.message='Five prepared tutorial maps. Preview makes no Codex requests.';store.setMeta('sessionMode','singleplayer');}
  let resetting=false,resetTask:Promise<{reset:boolean;warning?:string}>|undefined;
  let ready=previewActive,starting=false,configuring=false,closing=false,closePromise:Promise<void>|undefined,startupTask:Promise<void>|undefined,startupError:string|null=null,adminPort=options.adminPort??8788,port=options.port??8787;
  const previewChildren=new Set<GameServer>();let latestChild:GameServer|undefined,openingChild:Promise<GameServer>|undefined;
  const hostToken=randomBytes(32).toString('hex');
  if(!store.meta('sessionMode'))store.setMeta('sessionMode','singleplayer');
  if(!store.meta('hostPlayerId')&&store.players().length)store.setMeta('hostPlayerId',store.players()[0].id);
  const sockets=new Map<string,WebSocket>();
  const sessionMode=()=>previewActive?'singleplayer' as const:sessionModeSchema.parse(store.meta('sessionMode'));
  const addresses=()=>Object.values(networkInterfaces()).flat().filter(a=>a?.family==='IPv4'&&!a.internal).map(a=>`http://${a!.address}:${port}`);
  const publicUrl=()=>(options.parentUrl?undefined:process.env.INFINITE_PUBLIC_URL)||addresses()[0]||`http://127.0.0.1:${port}`;
  const localUrl=()=>`http://127.0.0.1:${adminPort}`;
  const onHostJoined=()=>{saveLibrary.ensureInitial(store);saveLibrary.activate(runId);};
  let switchingRun=false;
  async function openSavedRun(id:string):Promise<GameServer>{
    if(closing||saveLibrary.closing)throw new Error('The save library is shutting down.');
    const live=saveLibrary.servers.get(id) as GameServer|undefined;if(live)return live;
    const pending=saveLibrary.opening.get(id) as Promise<GameServer>|undefined;if(pending)return pending;
    const task=(async()=>{const run=saveLibrary.run(id);
      if(!existsSync(join(saveLibrary.path(run.directory),'world.sqlite')))throw new Error('This run directory is missing. Restore its save files first.');
      let child:GameServer;try{child=await createGameServer({dataDir:saveLibrary.path(run.directory),port:run.port??0,adminPort:run.adminPort??0,host:options.host,dev:options.dev,fixture:options.fixture,preview:run.preview,parentUrl:options.parentUrl??localUrl()+gameBase+'?world=main',saveLibrary});}catch(error){throw new Error(`The saved run's local ports could not be opened. Close another instance using them and try again. ${(error as Error).message}`);}
      previewChildren.add(child);return child;
    })();saveLibrary.opening.set(id,task);try{return await task;}finally{saveLibrary.opening.delete(id);}
  }
  function canSwitchRuns(){
    if([...world.online].some(id=>id!==store.meta('hostPlayerId')))throw new Error('Guests are still in this run. Close multiplayer from Session before switching runs.');
    if(starting||configuring||closing)throw new Error('Wait for the current host operation to finish.');
  }
  async function switchRun(id:string){
    canSwitchRuns();saveLibrary.run(id);const previousPause=generator.paused,previousMode=sessionMode();switchingRun=true;try{saveLibrary.catalog(store);if(id!==runId){changeSession('singleplayer');generator.paused=true;await generator.transport.cancelActive('The host switched runs.');}
    const destination=await openSavedRun(id);
    destination.generator.paused=false;saveLibrary.activate(id);if(destination.generator.verified)void destination.generator.pump();
    return {url:`http://127.0.0.1:${destination.adminPort}/?play=1`,runId:id,preview:destination.preview};
    }catch(error){generator.paused=previousPause;changeSession(previousMode);throw error;}finally{switchingRun=false;}
  }
  async function childWorld(requirePreview:boolean):Promise<GameServer>{
    if(closing)throw new Error('The world server is shutting down.');if(openingChild)return openingChild;
    if(latestChild&&(!requirePreview||latestChild.preview))return latestChild;
    openingChild=(async()=>{
      let id=store.meta('latestPreviewId');if(id&&!z.string().uuid().safeParse(id).success)throw new Error('The saved preview reference is invalid.');
      if(id&&!existsSync(join(store.root,'previews',id,'world.sqlite')))throw new Error('The saved tutorial world is missing. Restore its previews directory together with the original world data.');
      if(requirePreview&&id){
        const savedRoot=join(store.root,'previews',id);
        if(latestChild&&!latestChild.preview)id=null;
        else if(existsSync(join(savedRoot,'world.sqlite'))){const saved=new Store(savedRoot);try{if(saved.meta('previewPromoted')==='true')id=null;}finally{saved.close();}}
      }
      id??=randomUUID();const savedPorts=store.meta('previewPorts:'+id);
      const ports=savedPorts?z.object({port:z.number().int().min(1).max(65535),adminPort:z.number().int().min(1).max(65535)}).parse(JSON.parse(savedPorts)):{port:0,adminPort:0};
      let child:GameServer;try{child=await createGameServer({dataDir:join(store.root,'previews',id),...ports,host:options.host,dev:options.dev,preview:true,parentUrl:localUrl()+gameBase+'?world=main',saveLibrary});}
      catch(error){throw new Error(`The saved tutorial world's local ports could not be opened. Close another instance using them, then try again. ${(error as Error).message}`);}
      previewChildren.add(child);latestChild=child;store.setMeta('latestPreviewId',id);store.setMeta('previewPorts:'+id,JSON.stringify({port:child.port,adminPort:child.adminPort}));saveLibrary.activate(child.store.meta('runId')!);return child;
    })();try{return await openingChild;}finally{openingChild=undefined;}
  }
  function changeSession(mode:z.infer<typeof sessionModeSchema>){
    store.setMeta('sessionMode',mode);let disconnected=0;
    if(mode==='singleplayer')for(const [pid,ws] of sockets)if(pid!==store.meta('hostPlayerId')){sockets.delete(pid);world.disconnect(pid);ws.close(1000,'The host closed the multiplayer session. Your progress is saved.');disconnected++;}
    return {sessionMode:mode,disconnected,publicUrl:publicUrl(),addresses:addresses()};
  }
  async function resetGame(){
    if(options.saveLibrary||options.parentUrl)throw new Error('Open Home settings in the original host window to reset the entire game.');
    if(resetting||closing||configuring||switchingRun)throw new Error('Wait for the current host operation to finish.');
    resetting=true;saveLibrary.closing=true;
    const root=store.root,oldPreview=previewActive,oldReady=ready;
    let staged:ReturnType<typeof stageGameReset>|undefined,closedStores=false;
    const reopen=(fresh:boolean)=>{
      store=new Store(root);saveLibrary=new SaveLibrary(root);previewActive=fresh?false:oldPreview;
      savedRun=saveLibrary.register(store,previewActive);runId=savedRun.id;
      world=new World(store,previewActive?PREVIEW_REGION_IDS:undefined);generator=new Generator(store,options.fixture??false);streaming=new MapStreaming(world,generator,()=>previewActive);wireGeneration();
      if(previewActive){generator.status.mode='preview';generator.status.message='Five prepared tutorial maps. Preview makes no Codex requests.';}
      if(!store.meta('sessionMode'))store.setMeta('sessionMode','singleplayer');
      ready=fresh?false:oldReady;starting=false;startupTask=undefined;startupError=null;
      latestChild=undefined;openingChild=undefined;previewChildren.clear();
      const registered=saveLibrary.run(runId);registered.port=port;registered.adminPort=adminPort;saveLibrary.put(registered);saveLibrary.servers.set(runId,app);
    };
    try{
      for(const ws of wss.clients)ws.close(1008,'The host reset the entire game.');sockets.clear();world.online.clear();
      await Promise.allSettled([...saveLibrary.opening.values()]);if(openingChild)await Promise.allSettled([openingChild]);
      const others=[...saveLibrary.servers.values()].filter(server=>server!==app) as GameServer[];
      await Promise.all(others.map(server=>server.close()));
      await generator.close();await startupTask;
      store.close();saveLibrary.close();closedStores=true;
      staged=stageGameReset(root);
      try{reopen(true);}catch(error){
        // Discard any partially initialized fresh files before restoring originals.
        try{store.close();}catch{}try{saveLibrary.close();}catch{}
        const partial=stageGameReset(root);staged.rollback();staged=undefined;partial.commit();reopen(false);closedStores=false;throw error;
      }
      closedStores=false;
      let warning:string|undefined;
      try{staged.commit();}catch{warning='The game was reset, but some old files could not be deleted from the data directory.';}
      return {reset:true,warning};
    }catch(error){if(closedStores)reopen(false);throw error;}
    finally{resetting=false;saveLibrary.closing=false;}
  }
  // The standalone game always uses the Vite build. Website exports belong to
  // infinite-pokemon-website; ignore any stale out/ directory from older builds.
  const gameBase='/game/';
  const vite=options.dev?await(await import('vite')).createServer({server:{middlewareMode:true,hmr:false,ws:false,watch:options.fixture?null:{ignored:['**/.test-data/**','**/context/**','**/generation/**','**/generated-content/**',store.root.replaceAll('\\','/')+'/**']},fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/*.sqlite*','**/context/**','**/generation/**','**/generated-content/**',store.root.replaceAll('\\','/')+'/**']}},appType:'spa'}):null;
  const rates=new Map<string,{at:number,count:number}>();
  async function configure<T>(run:()=>Promise<T>){configuring=true;try{return await run();}finally{configuring=false;}}
  function checkRate(req:IncomingMessage){const key=req.socket.remoteAddress??'?';const now=Date.now();const r=rates.get(key);if(!r||now-r.at>60_000){rates.set(key,{at:now,count:1});return;}if(++r.count>120)throw new Error('Too many requests. Please wait a minute.');}
  async function handler(req:IncomingMessage,res:ServerResponse,admin:boolean){
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    try{
      if(resetting)return send(res,503,{error:'The game is resetting. Please wait.'});
      const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`);
      const isHost=admin&&equal(String(req.headers['x-host-token']??''),hostToken);
      if(url.pathname==='/api/agent'&&req.method==='GET'){
        const token=String(req.headers.authorization??'').replace(/^Bearer /,'');
        if(!isHost&&!store.byToken(token))return send(res,403,{error:'Join this run to view agent activity.'});
        send(res,200,generator.agentDetails());return;
      }
      if(req.method==='POST'&&req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host)return send(res,403,{error:'Cross-origin requests are not permitted.'});}
      if(url.pathname==='/api/info'){send(res,200,{name:store.meta('name'),ready,preview:previewActive,sessionMode:sessionMode(),online:sockets.size,capacity:8,generation:{state:generator.status.state,mode:generator.status.mode},hostAvailable:admin,gamePort:port,gameBase});return;}
      if(url.pathname==='/api/bootstrap'&&admin){
        if(!['127.0.0.1','localhost'].includes(url.hostname))return send(res,403,{error:'Use the local host console.'});
        send(res,200,{hostToken,rememberedConnection:generator.hasRememberedConnection(),harnessExecutable:store.meta('harnessExecutable')??'',renderDepth:world.renderDepth(),generationBatchSize:generator.batchSize(),status:generator.status,ready,preview:previewActive,parentUrl:options.parentUrl??null,harnessReady:generator.verified,starting,startupError,sessionMode:sessionMode(),name:store.meta('name'),addresses:addresses(),publicUrl:publicUrl(),gamePort:port});return;
      }
      if(url.pathname==='/api/saves'&&req.method==='GET'){if(!isHost)return send(res,403,{error:'Only the local host can browse runs and checkpoints.'});send(res,200,saveLibrary.catalog(store));return;}
      if(url.pathname.startsWith('/api/host/')){
        if(!isHost)return send(res,403,{error:'Host administration is local and authenticated.'});
        if(saveLibrary.closing)throw new Error('The save library is shutting down.');
        if(switchingRun)throw new Error('A run is opening. Wait for it to finish.');
        if(req.method!=='POST')return send(res,405,{error:'Use POST.'});const data=await body(req,url.pathname==='/api/host/import'?4*1024*1024:8192);
        if(configuring&&url.pathname!=='/api/host/backup')throw new Error('Wait for the current harness connection or verification request to finish.');
        if(starting&&['/api/host/connect','/api/host/login','/api/host/verify','/api/host/budget'].includes(url.pathname))throw new Error('Wait for the opening maps to finish before changing the harness or its budget.');
        switch(url.pathname){
          case '/api/host/reset-game': {
            if(data.confirmation!=='RESET')return send(res,400,{error:'Type RESET to confirm erasing all game data.'});
            resetTask=resetGame();try{send(res,200,await resetTask);}finally{resetTask=undefined;}return;
          }
          case '/api/host/generation-batch': {
            const batchSize=z.number().int().min(1).max(MAX_GENERATION_BATCH_SIZE).parse(data.batchSize);store.setMeta('generationBatchSize',String(batchSize));if(!previewActive)void generator.pump();send(res,200,{batchSize});return;
          }
          case '/api/host/render-depth': {
            const depth=z.number().int().min(0).max(3).parse(data.depth);store.setMeta('renderDepth',String(depth));if(ready)streaming.refresh();send(res,200,{depth});return;
          }
          case '/api/host/saves/checkpoint': {
            if(!ready)throw new Error('Enter the run before saving.');
            const name=z.string().trim().min(1).max(48).parse(data.name??'Checkpoint'),requestId=z.string().uuid().parse(data.requestId);
            send(res,200,{checkpoint:saveLibrary.save(store,name,requestId),catalog:saveLibrary.catalog(store)});return;
          }
          case '/api/host/saves/fork': {
            canSwitchRuns();const checkpointId=z.string().uuid().parse(data.checkpointId),name=z.string().trim().min(1).max(48).parse(data.name??'Branch');
            const run=saveLibrary.fork(checkpointId,name,z.string().uuid().optional().parse(data.requestId));send(res,200,await switchRun(run.id));return;
          }
          case '/api/host/saves/new': {
            canSwitchRuns();const name=z.string().trim().min(1).max(48).parse(data.name??'New run');
            const run=saveLibrary.fresh(previewActive,name,z.string().uuid().optional().parse(data.requestId));send(res,200,await switchRun(run.id));return;
          }
          case '/api/host/saves/open': send(res,200,await switchRun(z.string().uuid().parse(data.runId)));return;
          case '/api/host/preview': {
            if(options.parentUrl){if(!previewActive)return send(res,409,{error:'Return to the original world menu to create another tutorial preview.',parentUrl:options.parentUrl});send(res,200,{previewUrl:localUrl(),preview:true,parentUrl:options.parentUrl});return;}
            const child=await childWorld(true);send(res,200,{previewUrl:`http://127.0.0.1:${child.adminPort}`,preview:true,parentUrl:localUrl()+gameBase+'?world=main'});return;
          }
          case '/api/host/import': {
            if(options.parentUrl)return send(res,409,{error:'Return to the original world menu to import a save.',parentUrl:options.parentUrl});
            // Import is host-only and always creates a new isolated run; nothing existing is overwritten.
            const text=typeof data.save==='string'?data.save:JSON.stringify(data.save??null);
            const save=parsePortableSave(text);
            const child=await childWorld(true);
            applyPortableSave(child.store,save);
            send(res,200,{previewUrl:`http://127.0.0.1:${child.adminPort}`,preview:true,imported:true,parentUrl:localUrl()+gameBase+'?world=main'});return;
          }
          case '/api/host/resume': {
            const active=saveLibrary.active();if(!options.parentUrl&&active&&active!==runId){const child=await openSavedRun(active);send(res,200,{url:`http://127.0.0.1:${child.adminPort}`,redirect:true,preview:child.preview,parentUrl:localUrl()+gameBase+'?world=main'});return;}
            if(options.parentUrl||!store.meta('latestPreviewId')){send(res,200,{url:localUrl(),redirect:false,preview:previewActive,parentUrl:options.parentUrl??null});return;}
            const child=await childWorld(false);send(res,200,{url:`http://127.0.0.1:${child.adminPort}`,redirect:true,preview:child.preview,parentUrl:localUrl()+gameBase+'?world=main',hasOriginalWorld:store.players().length>0});return;
          }
          case '/api/host/disconnect': await configure(()=>generator.disconnect());send(res,200,{disconnected:true});return;
          case '/api/host/switch-connection': send(res,200,await configure(()=>generator.switchConnection(z.string().trim().max(500).parse(data.executable??''))));return;
          case '/api/host/switch-account': send(res,200,await configure(()=>generator.switchAccount()));return;
          case '/api/host/session-check': await configure(()=>generator.checkSession());send(res,200,{connected:generator.verified});return;
          case '/api/host/connect': if(previewActive)generator.status.mode='codex';send(res,200,await configure(()=>generator.connect(z.string().max(500).optional().parse(data.executable)||undefined)));return;
          case '/api/host/login': if(previewActive)generator.status.mode='codex';send(res,200,await configure(()=>generator.login()));return;
          case '/api/host/verify': if(previewActive)generator.status.mode='codex';await configure(()=>generator.verify(data.consent===true,data.limit===undefined?Number.MAX_SAFE_INTEGER:z.number().int().min(5).max(1000).parse(data.limit)));if(ready&&!previewActive)streaming.refresh();send(res,200,{status:generator.status});return;
          case '/api/host/start': {
            if(!generator.verified)throw new Error('Connect and verify your harness first.');
            const mode=sessionModeSchema.parse(data.sessionMode??sessionMode());
            if(previewActive){previewActive=false;world.allowedRegions=undefined;store.setMeta('previewPromoted','true');generator.status.mode='codex';wireGeneration();const host=store.player(store.meta('hostPlayerId')??'');if(host)world.onFrontier(world.neighbors(store.region(host.regionId)!));}
            if(ready){send(res,200,{ready:true,starting,...changeSession(mode)});return;}
            if(data.name)store.setMeta('name',z.string().trim().min(2).max(48).parse(data.name));world.warmStart();
            const spawn=store.region('0,0')!;spawn.published=true;store.saveRegion(spawn);ready=true;starting=true;startupError=null;
            changeSession(mode);
            startupTask=(async()=>{try{
              await generator.initial(streaming.plan());
              if(!generator.verified)throw new Error('The harness disconnected while the opening maps were being prepared.');
            }catch(error){startupError=(error as Error).message;if(!closing){generator.status.state='error';generator.status.message=`Opening maps could not be prepared: ${startupError}`;}}
            finally{starting=false;startupTask=undefined;}})();
            send(res,202,{ready:true,starting:true,sessionMode:mode});return;
          }
          case '/api/host/session': {
            if(!ready)throw new Error('Prepare the world before changing the session.');
            const mode=sessionModeSchema.parse(data.sessionMode);if(mode==='multiplayer'&&(previewActive||!generator.verified))throw new Error('Connect and verify Codex, then continue the full game before opening multiplayer.');
            send(res,200,changeSession(mode));return;
          }
          case '/api/host/budget': generator.status.limit=z.number().int().min(generator.status.used).max(1000).parse(data.limit);generator.paused=data.paused===true;void generator.pump();send(res,200,{status:generator.status});return;
          case '/api/host/backup': {const dir=join(store.root,'backups');mkdirSync(dir,{recursive:true});const name=`world-${Date.now()}.sqlite`;await store.backupTo(join(dir,name));send(res,200,{message:`Backup saved on the server: backups/${name}`});return;}
          default:send(res,404,{error:'Unknown host action'});return;
        }
      }
      if(url.pathname==='/api/join'&&req.method==='POST'){
        checkRate(req);if(admin&&!isHost)return send(res,403,{error:'Open the local game menu to play as the host.'});
        if(!isHost&&sessionMode()==='singleplayer')return send(res,403,{error:'This world is currently a single-player game. The host can open multiplayer from the game menu.'});
        if(!ready)throw new Error('The host is still preparing this world.');const data=await body(req);
        if(isHost){
          const saved=store.player(store.meta('hostPlayerId')??'');
          if(saved){const existing=typeof data.token==='string'?store.byToken(data.token):undefined,token=existing?.id===saved.id?data.token:store.rotatePlayerToken(saved.id);onHostJoined();send(res,200,{token,playerId:saved.id,resumed:true});return;}
        }
        if(typeof data.token==='string'){
          const player=store.byToken(data.token);if(!player)return send(res,401,{code:'INVALID_SESSION',error:'This browser save does not belong to this world. Start a new trainer to join.'});
          if(!isHost&&player.id===store.meta('hostPlayerId'))return send(res,403,{error:'The host trainer plays through the local game menu.'});
          if(isHost){store.setMeta('hostPlayerId',player.id);onHostJoined();}send(res,200,{token:data.token,playerId:player.id,resumed:true});return;
        }
        if(!generator.verified&&!previewActive)throw new Error('The host needs to reconnect generation before new trainers can join.');
        if(sockets.size>=8)throw new Error('This world is full.');
        const name=z.string().trim().min(2).max(18).regex(/^[\p{L}\p{N} _-]+$/u,'Use letters, numbers, spaces, underscores or hyphens.').parse(data.name??'Trainer');
        const {player,token}=world.createPlayer(name);if(isHost){store.setMeta('hostPlayerId',player.id);onHostJoined();}send(res,200,{token,playerId:player.id,resumed:false});return;
      }
      if(url.pathname==='/api/maps'&&req.method==='GET'){
        if(sessionMode()==='singleplayer'&&!isHost)return send(res,403,{error:'This is a single-player world.'});
        const player=store.byToken(String(req.headers.authorization??'').replace(/^Bearer /,''));if(!player)return send(res,401,{error:'Join the world first.'});send(res,200,store.regions().filter(r=>r.published).map(({id,name,hash,gx,gy})=>({id,name,hash,gx,gy})));return;
      }
      if(url.pathname.startsWith('/api/'))return send(res,404,{error:'Not found.'});
      if(vite){vite.middlewares(req,res,()=>send(res,404,{error:'Not found.'}));return;}
      const root=resolve('dist');
      const pathname=decodeURIComponent(url.pathname);
      let file=resolve(root,'.'+pathname);
      const safe=file===root||file.startsWith(root+'/')||file.startsWith(root+'\\');if(!safe)return send(res,403,{error:'Invalid path.'});
      if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
      if(!existsSync(file)&&!extname(file)&&existsSync(file+'.html'))file=file+'.html';
      if(!existsSync(file)){
        if(pathname==='/'||pathname==='/game'||pathname==='/game/'){const fallback=join(root,'index.html');if(existsSync(fallback))file=fallback;}
        else{const notFound=join(root,'404.html');if(existsSync(notFound)){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});createReadStream(notFound).pipe(res);return;}}
      }
      if(!existsSync(file))return send(res,existsSync(join(root,'index.html'))?404:503,{error:existsSync(join(root,'index.html'))?'Not found.':'Build the client with npm run build before starting production.'});
      const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'};
      res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'});createReadStream(file).pipe(res);
    }catch(e){send(res,400,{error:e instanceof z.ZodError?e.issues[0].message:(e as Error).message});}
  }
  const publicServer=createServer((q,s)=>void handler(q,s,false));
  const adminServer=createServer((q,s)=>void handler(q,s,true));
  const wss=new WebSocketServer({noServer:true,maxPayload:8192});
  const socketChannels=new WeakMap<WebSocket,boolean>();
  function upgrade(req:IncomingMessage,socket:any,head:Buffer,admin:boolean){
    if(closing||req.url!=='/play'||wss.clients.size>=64){socket.destroy();return;}
    if(!admin&&sessionMode()==='singleplayer'){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}}
    wss.handleUpgrade(req,socket,head,ws=>{socketChannels.set(ws,admin);wss.emit('connection',ws,req);});
  }
  publicServer.on('upgrade',(req,socket,head)=>upgrade(req,socket,head,false));adminServer.on('upgrade',(req,socket,head)=>upgrade(req,socket,head,true));
  wss.on('connection',(ws)=>{
    let pid:string|null=null,lastHash='',count=0,windowStart=Date.now();
    const timer=setTimeout(()=>{if(!pid)ws.close(1008,'Authentication required');},5000);
    ws.on('message',raw=>{try{
      if(Date.now()-windowStart>1000){windowStart=Date.now();count=0;}if(++count>30){ws.close(1008,'Command rate exceeded');return;}
      if(resetting){ws.close(1008,'The game is resetting.');return;}
      const data=JSON.parse(raw.toString());
      if(!pid){
        if(data.type!=='auth'||typeof data.token!=='string'||!ready)throw new Error('Join the world first.');const p=store.byToken(data.token);if(!p)throw new Error('This browser save is no longer active.');
        const local=socketChannels.get(ws)===true,isHostPlayer=p.id===store.meta('hostPlayerId');
        if((local&&!isHostPlayer)||(!local&&(sessionMode()==='singleplayer'||isHostPlayer))){ws.close(1008,'Use the correct local or multiplayer game connection.');return;}
        if(sockets.size>=8&&!sockets.has(p.id))throw new Error('The world is full.');pid=p.id;sockets.get(pid)?.close(1000,'Session opened elsewhere');sockets.set(pid,ws);world.online.add(pid);clearTimeout(timer);streaming.refresh();ws.send(JSON.stringify(viewState(pid)));return;
      }
      if(sockets.get(pid)!==ws){ws.close(1008,'Session opened elsewhere');return;}
      const command=commandSchema.parse(data);
      if(command.action.kind==='cancelTravel'||command.action.kind==='retryTravel'){if(command.action.kind==='cancelTravel')streaming.cancel(pid);else streaming.retry(pid);ws.send(JSON.stringify({type:'result',id:command.id}));ws.send(JSON.stringify(viewState(pid)));return;}
      if(streaming.pending.has(pid)&&command.action.kind!=='save')throw new GameError('This map is still being prepared. Cancel travel to stay here.','MAP_LOADING');
      const result=world.apply(pid,command.id,command.action);
      if(command.action.kind==='save'&&pid===store.meta('hostPlayerId')){const checkpoint=saveLibrary.save(store,'Checkpoint',command.id);result.title='Checkpoint saved';result.text=`${checkpoint.summary.location} — checkpoint saved. Keep playing on this run, or open SAVES to branch from an earlier checkpoint. Your progress also saves automatically.`;}
      ws.send(JSON.stringify({type:'result',id:command.id,...result}));
      if(result.movement?.accepted&&result.movement.duration===0){const state=viewState(pid);ws.send(JSON.stringify(state));lastHash=state.region.hash;}
    }catch(e){ws.send(JSON.stringify({type:'error',code:e instanceof GameError?e.code:undefined,message:e instanceof z.ZodError?'Invalid game command.':(e as Error).message}));}});
    ws.on('close',()=>{clearTimeout(timer);if(pid&&sockets.get(pid)===ws){sockets.delete(pid);world.disconnect(pid);streaming.cancel(pid);}});
    const updates=setInterval(()=>{if(resetting||!pid||ws.readyState!==WebSocket.OPEN||ws.bufferedAmount>200_000)return;const state=viewState(pid);const hash=state.region.hash;ws.send(JSON.stringify({...state,region:lastHash===hash?undefined:state.region}));lastHash=hash;},100);
    ws.on('close',()=>clearInterval(updates));
  });
  const listen=(s:ReturnType<typeof createServer>,p:number,host:string)=>new Promise<number>((resolve,reject)=>{s.once('error',reject);s.listen(p,host,()=>resolve((s.address() as {port:number}).port));});
  try{port=await listen(publicServer,port,options.host??'0.0.0.0');adminPort=await listen(adminServer,adminPort,'127.0.0.1');}catch(error){await generator.close();wss.close();if(publicServer.listening)await new Promise<void>(done=>publicServer.close(()=>done()));if(adminServer.listening)await new Promise<void>(done=>adminServer.close(()=>done()));await vite?.close();store.close();if(!options.saveLibrary)saveLibrary.close();throw error;}
  const roundTimer=setInterval(()=>{if(!resetting)world.tick();},1000);roundTimer.unref();
  const streamTimer=setInterval(()=>{if(!resetting)streaming.tick();},100);streamTimer.unref();
  const app:GameServer={get world(){return world;},get store(){return store;},get generator(){return generator;},port,adminPort,hostToken,previewChildren,get ready(){return ready;},get preview(){return previewActive;},close(){
    if(closePromise)return closePromise;closing=true;
    closePromise=(async()=>{
      if(resetTask)await resetTask.catch(()=>{});
      if(!options.saveLibrary){saveLibrary.closing=true;await Promise.allSettled([...saveLibrary.opening.values()]);}
      clearInterval(roundTimer);clearInterval(streamTimer);await generator.close();await startupTask;if(openingChild)await Promise.allSettled([openingChild]);await Promise.all([...previewChildren].map(child=>child.close()));
      await Promise.all([...wss.clients].map(ws=>new Promise<void>(done=>{ws.once('close',()=>done());ws.terminate();})));
      await new Promise<void>(done=>wss.close(()=>done()));
      await Promise.all([new Promise<void>(done=>publicServer.close(()=>done())),new Promise<void>(done=>adminServer.close(()=>done()))]);
      await vite?.close();saveLibrary.servers.delete(runId);store.close();if(!options.saveLibrary)saveLibrary.close();
    })();return closePromise;
  }};
  const registered=saveLibrary.run(runId);registered.port=port;registered.adminPort=adminPort;saveLibrary.put(registered);saveLibrary.servers.set(runId,app);return app;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const app=await createGameServer({port:Number(process.env.PORT??8787),adminPort:Number(process.env.ADMIN_PORT??8788),dev:import.meta.url.endsWith('.ts')});
  console.log(`Infinite Pokémon\nHost console: http://127.0.0.1:${app.adminPort}\nGuest game: http://localhost:${app.port}\nWorld data: ${app.store.root}`);
  for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
}
