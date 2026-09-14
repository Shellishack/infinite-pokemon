import { createGameServer } from '../game/server/index.js';
import { resolve } from 'node:path';
const app=await createGameServer({dataDir:resolve('.test-data','visual-fixture'),port:8800,adminPort:8801,fixture:true,dev:true});
console.log(`Visual test fixture (no AI): http://127.0.0.1:${app.adminPort}`);
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
