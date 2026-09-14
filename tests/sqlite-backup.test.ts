import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../game/server/store.js';
import {createGameServer} from '../game/server/index.js';

test('backups include committed WAL data and can replace a previous backup',async()=>{
  mkdirSync('.test-data',{recursive:true});const root=mkdtempSync(resolve('.test-data/sqlite-backup-')),store=new Store(root),dest=join(root,"backup's world.sqlite");
  try{
    store.setMeta('checkpoint','first');await store.backupTo(dest);
    store.setMeta('checkpoint','second');await store.backupTo(dest);
    const copy=new DatabaseSync(dest);
    try{assert.equal(copy.prepare("SELECT value FROM metadata WHERE key='checkpoint'").get()?.value,'second');assert.equal(copy.prepare('PRAGMA integrity_check').get()?.integrity_check,'ok');}finally{copy.close();}
    assert.equal(store.meta('checkpoint'),'second');assert.equal(readdirSync(root).some(name=>name.endsWith('.tmp')),false);
    await assert.rejects(store.backupTo(join(root,'missing','backup.sqlite')));
    assert.equal(store.meta('checkpoint'),'second');
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('the server starts and serves its host endpoint on the selected Node runtime',async()=>{
  mkdirSync('.test-data',{recursive:true});const root=mkdtempSync(resolve('.test-data/sqlite-start-'));
  const app=await createGameServer({dataDir:root,port:0,adminPort:0,host:'127.0.0.1',preview:true});
  try{const response=await fetch(`http://127.0.0.1:${app.adminPort}/api/info`);assert.equal(response.status,200);assert.equal((await response.json()).hostAvailable,true);}
  finally{await app.close();rmSync(root,{recursive:true,force:true});}
});
