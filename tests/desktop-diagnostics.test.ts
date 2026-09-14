import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {serverFailure}=createRequire(import.meta.url)('../desktop/server-diagnostics.cjs') as {serverFailure:(stderr:string,code:number|null,signal:string|null)=>string};

test('desktop distinguishes missing SQLite exports from occupied ports',()=>{
  const error=serverFailure("file:///game/store.js:2\nimport { DatabaseSync, backup } from 'node:sqlite';\nSyntaxError: The requested module 'node:sqlite' does not provide an export named 'backup'\nNode.js v22.14.0\n",1,null);
  assert.match(error,/SyntaxError.*backup/);assert.match(error,/Node.js v22.14.0/);assert.match(error,/NODE_BINARY/);assert.doesNotMatch(error,/conflicting server|ports are free/);
  assert.match(error,/Update and rebuild/);assert.match(error,/22.16/);
  assert.match(serverFailure('Error: listen EADDRINUSE: address already in use 127.0.0.1:8788',1,null),/Choose another PORT/);
});

test('desktop diagnostics handle generic failures, empty output, signals and terminal escapes',()=>{
  assert.match(serverFailure('\u001b[31mError: EACCES: permission denied\u001b[0m',1,null),/EACCES/);
  assert.doesNotMatch(serverFailure('\u001b[31mError: failed\u001b[0m',1,null),/\u001b/);
  assert.match(serverFailure('',null,'SIGTERM'),/signal SIGTERM.*No error output/s);
  assert.ok(serverFailure('Error: '+ 'x'.repeat(12000),1,null).length<1100);
});
