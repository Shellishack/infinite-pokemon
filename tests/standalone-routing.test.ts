import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createGameServer} from '../game/server/index.js';

test('standalone server serves /game from Vite, not an old website export', {skip:!existsSync(resolve('dist/index.html'))}, async()=>{
  const app=await createGameServer({dataDir:resolve('.test-data','routing-'+randomUUID()),port:0,adminPort:0,host:'127.0.0.1',fixture:true});
  const origin=`http://127.0.0.1:${app.adminPort}`;
  try{
    const info=await(await fetch(origin+'/api/info')).json();
    assert.equal(info.gameBase,'/game/');
    for(const route of ['/','/game','/game/','/game/?embed=1']){
      const response=await fetch(origin+route);
      assert.equal(response.status,200,route);
      const html=await response.text();
      assert.match(html,/id="root"/);
      assert.doesNotMatch(html,/_next|infinite-pokemon-site/);
      const asset=html.match(/src="([^"]+\.js)"/);
      assert.ok(asset);
      assert.equal((await fetch(origin+asset[1])).status,200);
    }
    assert.equal((await fetch(origin+'/guides/')).status,404);
    assert.equal((await fetch(origin+'/missing.js')).status,404);
  }finally{await app.close();}
});
