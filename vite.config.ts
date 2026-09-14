import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const fromRoot=(path:string)=>fileURLToPath(new URL(path,import.meta.url));
export default defineConfig({
  root:fromRoot('./game/client/'),
  publicDir:fromRoot('./game/assets/'),
  plugins:[react()],
  build:{
    outDir:fromRoot('./dist/'),
    emptyOutDir:true,
    chunkSizeWarningLimit:1500,
    rollupOptions:{output:{manualChunks:{phaser:['phaser']}}},
  },
});
