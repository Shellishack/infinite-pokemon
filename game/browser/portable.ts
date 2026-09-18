// Versioned portable save builder, shared by the browser demo worker and tests.
// Contains: demo-pack version, trainer, party, inventory, tutorial progress,
// world changes, and continuity history. No credentials, session tokens,
// executable content, or filesystem paths.

import type {Player} from '../shared/model.js';
import {LAYOUT_VERSION} from '../engine/maps.js';
import type {MemoryStore} from './memory-store.js';

export const SAVE_FORMAT='infinite-pokemon-save';
export const SAVE_FORMAT_VERSION=1;

export function buildPortableSave(store:MemoryStore,me:Player){
  const events=store.eventsFor(me.id);
  return {
    format:SAVE_FORMAT,
    formatVersion:SAVE_FORMAT_VERSION,
    demoPackVersion:Number(store.meta('previewPackVersion')??LAYOUT_VERSION),
    exportedAt:new Date().toISOString(),
    world:{name:store.meta('name'),seed:store.meta('seed')},
    trainer:{id:me.id,name:me.name,coins:me.coins,steps:me.steps,visited:me.visited,journal:me.journal,stats:me.stats,vehicles:me.ownedVehicles},
    party:me.party,
    storage:me.storage,
    inventory:{balls:me.balls,potions:me.potions,items:me.items??{}},
    egg:me.egg??null,
    tutorial:{step:me.tutorial,flags:me.tutorialFlags,introDone:me.introDone},
    position:{regionId:me.regionId,sceneId:me.sceneId,x:me.x,y:me.y,facing:me.facing},
    worldChanges:store.regions().map(r=>({id:r.id,hash:r.hash})),
    continuity:events.slice(-120),
  };
}
