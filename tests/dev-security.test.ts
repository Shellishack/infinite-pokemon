import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join,resolve,relative } from 'node:path';
import { createGameServer } from '../game/server/index.js';

test('development middleware serves the game without exposing world saves or harness context',{timeout:20_000},async()=>{
  const root=resolve('.test-data',randomUUID()),app=await createGameServer({dataDir:root,port:0,adminPort:0,host:'127.0.0.1',fixture:true,dev:true});
  const base=`http://127.0.0.1:${app.port}`,secret='private-world-state-'+randomUUID();writeFileSync(join(root,'private.json'),JSON.stringify({secret}));
  try{
    assert.equal((await fetch(base+'/')).status,200);
    for(const url of ['/'+relative(process.cwd(),join(root,'private.json')).replaceAll('\\','/'),'/@fs/'+join(root,'private.json').replaceAll('\\','/'),'/'+relative(process.cwd(),join(root,'world.sqlite')).replaceAll('\\','/')]){
      const response=await fetch(base+url),body=await response.text();
      if(url.startsWith('/@fs/'))assert.equal(response.status,403);
      else if(response.status!==403){assert.equal(response.status,200);assert.match(body,/<!doctype html>/i);assert.match(body,/src="\/main.tsx"/);}
      assert.ok(!body.includes(secret));
    }
  }finally{await app.close();}
});
