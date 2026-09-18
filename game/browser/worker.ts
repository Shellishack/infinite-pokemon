// Browser demo runtime: runs the shared game engine in a Web Worker with an
// in-memory store backed by IndexedDB snapshots. Speaks the same command/state
// protocol as the local server so the client transport can be swapped 1:1.

import {World,GameError} from '../engine/world.js';
import {validateRegion,LAYOUT_VERSION} from '../engine/maps.js';
import {commandSchema,type GenerationStatus,type Player} from '../shared/model.js';
import {MemoryStore,type StoreSnapshot} from './memory-store.js';
import {createDemoStorage} from './storage.js';
import {buildPortableSave} from './portable.js';
import pack from '../content/tutorial-world.json' with { type: 'json' };


// Some web bundlers evaluate the worker entry twice in one global; only the
// first evaluation may own the save lock and message handler.
const workerGlobal = globalThis as { __ipDemoWorkerActive?: boolean };
if (!workerGlobal.__ipDemoWorkerActive) {
workerGlobal.__ipDemoWorkerActive = true;
	const PREVIEW_IDS = new Set(['0,0', '0,-1', '0,1', '-1,0', '1,0']);
	const generation: GenerationStatus = { state: 'ready', message: 'Five prepared tutorial maps. The browser demo makes no Codex requests.', queued: 0, completed: 0, failed: 0, limit: 0, used: 0, mode: 'preview' };
	
	const post = (message: unknown) => postMessage(message);
	
	
	let store: MemoryStore;
	let world: World;
	let storage: Awaited<ReturnType<typeof createDemoStorage>>;
	let pid: string | null = null;
	let lastRegionHash = '';
	let autosaveTimer: ReturnType<typeof setInterval> | undefined;
	
	function loadPack() {
	  if (store.meta('previewPackVersion') === String(LAYOUT_VERSION)) return;
	  const tutorial = pack as unknown as { version: number; seed: string; name: string; regions: Parameters<typeof validateRegion>[0][] };
	  if (tutorial.version !== LAYOUT_VERSION || tutorial.regions.length !== 5 || tutorial.regions.some(r => !PREVIEW_IDS.has(r.id) || r.source !== 'authored' || r.layoutVersion !== LAYOUT_VERSION || !r.published)) throw new Error('The prepared tutorial pack is invalid.');
	  for (const region of tutorial.regions) validateRegion(region);
	  store.transaction(() => {
	    store.setMeta('seed', tutorial.seed); store.setMeta('name', tutorial.name);
	    store.setMeta('previewPackVersion', String(tutorial.version)); store.setMeta('layoutVersion', String(LAYOUT_VERSION));
	    store.setMeta('previewPromoted', 'false'); store.setMeta('sessionMode', 'singleplayer');
	    for (const region of tutorial.regions) store.saveRegion(region);
	  });
	}
	
	async function autosave() {
	  if (!storage.available || !pid) return;
	  try { await storage.save(store.snapshot()); } catch { /* storage full/blocked: session continues, export stays available */ }
	}
	
	function view() {
	  const state = world.view(pid!, generation);
	  const hash = state.region.hash;
	  const message = { ...state, region: lastRegionHash === hash ? undefined : state.region };
	  lastRegionHash = hash;
	  return message;
	}
	
	let started = false;
	async function start() {
	  if (started) return; // Some web bundlers evaluate the worker entry twice; only one runtime may own the save lock.
	  started = true;
	  storage = await createDemoStorage();
	  store = new MemoryStore();
	  if (storage.available) {
	    const saved = await storage.load() as StoreSnapshot | undefined;
	    if (saved) { try { store.restore(saved); } catch { /* corrupt snapshot: start fresh */ } }
	  }
	  loadPack();
	  world = new World(store, PREVIEW_IDS);
	  world.onFrontier = () => {};
	  setInterval(() => world.tick(), 1000);
	  post({ type: 'hello', hasSave: store.playerIds().length > 0, storageAvailable: storage.available, storageBusy: storage.busy });
	}
	
	let updates: ReturnType<typeof setInterval> | undefined;
	let allowDebug = false;
	function beginUpdates() {
	  if (updates) return;
	  updates = setInterval(() => { if (pid) post(view()); }, 100);
	  autosaveTimer = setInterval(() => void autosave(), 4000);
	}
	
	onmessage = async (event: MessageEvent) => {
	  const data = event.data;
	  try {
	    if (data.type === 'configure') {
	      allowDebug = data.debug === true;
	      return;
	    }
	    if (data.type === 'debug-teleport') {
	      // Test/screenshot hook: only enabled when the page opts in with ?demo-debug=1.
	      if (!allowDebug || !pid) return;
	      const x = Number(data.x), y = Number(data.y);
	      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return;
	      const me = store.player(pid)!;
	      me.x = x; me.y = y;
	      if (typeof data.sceneId === 'string') me.sceneId = data.sceneId; else delete me.sceneId;
	      delete me.movement;
	      store.savePlayer(me);
	      post(view());
	      return;
	    }
	    if (data.type === 'create') {
	      if (pid) return;
	      const name = String(data.name ?? 'Trainer').trim().slice(0, 18) || 'Trainer';
	      const { player, token } = world.createPlayer(name);
	      pid = player.id;
	      store.setMeta('hostPlayerId', pid);
	      lastRegionHash = '';
	      post({ type: 'auth-ok', token, playerId: pid });
	      post(view());
	      beginUpdates();
	      await autosave();
	      return;
	    }
	    if (data.type === 'resume') {
	      if (pid) return;
	      const saved = store.playerIds()[0];
	      if (!saved) return post({ type: 'error', message: 'No demo save to resume.' });
	      pid = saved;
	      world.online.add(pid);
	      lastRegionHash = '';
	      post({ type: 'auth-ok', token: store.tokenFor(pid) ?? pid, playerId: pid });
	      post(view());
	      beginUpdates();
	      return;
	    }
	    if (data.type === 'auth') {
	      // The demo is single-player; treat any token as the active player.
	      const id = store.playerIds()[0];
	      if (!id) return post({ type: 'error', message: 'Create a trainer first.' });
	      pid = id; world.online.add(pid);
	      post(view()); beginUpdates();
	      return;
	    }
	    if (data.type === 'export') {
	      if (!pid) return post({ type: 'error', message: 'Nothing to export yet.' });
	      const me = store.player(pid)!;
	      if (me.battle && !me.battle.finished) return post({ type: 'error', code: 'BATTLE_ACTIVE', message: 'Finish the current battle before exporting your progress.' });
	      post({ type: 'export-data', save: buildPortableSave(store, me) });
	      return;
	    }
	    if (data.type === 'command' && pid) {
	      const parsed = commandSchema.parse(data);
	      const result = world.apply(pid, parsed.id, parsed.action);
	      post({ type: 'result', id: parsed.id, ...result });
	      post(view());
	      // Autosave settled actions (movement spam is throttled by the interval).
	      if (parsed.action.kind !== 'move') void autosave();
	      return;
	    }
	  } catch (error) {
	    const err = error as Error & { code?: string };
	    post({ type: 'error', code: err.code, message: err instanceof GameError ? err.message : 'Something went wrong in the demo world.' });
	  }
	};
	
	void start();
}
