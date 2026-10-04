import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base:process.env.GITHUB_ACTIONS ? "/FindLoop/" : "/",
  // This browser environment proxies localhost WebSockets. Disable Fast Refresh
  // and HMR so development uses reliable full-page reloads without a WS client.
  plugins:[react({fastRefresh:false})],
  server:{
    host:'127.0.0.1',
    port:5173,
    strictPort:true,
    hmr:false,
    headers:{'Cache-Control':'no-store'},
  },
});
