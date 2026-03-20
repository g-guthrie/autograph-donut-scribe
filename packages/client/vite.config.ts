import { defineConfig } from "vite";

const clientPort = Number(process.env.OLYMPUS_CLIENT_PORT ?? "5173");
const workerPort = Number(process.env.OLYMPUS_WORKER_PORT ?? "8787");

export default defineConfig({
  define: {
    __OLYMPUS_WORKER_PORT__: JSON.stringify(workerPort)
  },
  server: {
    host: "127.0.0.1",
    port: clientPort,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${workerPort}`,
        changeOrigin: true,
        ws: true
      },
      "/health": {
        target: `http://127.0.0.1:${workerPort}`,
        changeOrigin: true
      }
    }
  }
});
