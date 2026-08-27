import { defineConfig, mergeConfig } from "vite";
import type { Plugin } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/*
 * Set by ./dev.sh. rCTF answers with a fixed Access-Control-Allow-Origin naming
 * the deployed frontend, so a localhost page cannot call it directly: proxying
 * through the dev server makes the request from Node instead. Only rCTF is
 * proxied - the extras backend is cross-origin in production too, so its CORS
 * config stays under test here.
 */
const rctfUpstream = process.env.DEV_RCTF_ORIGIN;
const extrasOrigin = process.env.DEV_EXTRAS_ORIGIN ?? "http://localhost:8091";

const rctfProxy = rctfUpstream
  ? // changeOrigin rewrites the Host header, which rCTF's reverse proxy routes on.
    { target: rctfUpstream, changeOrigin: true }
  : undefined;

/** Stands in for the checked-in config.json */
function devRuntimeConfig(): Plugin {
  return {
    name: "dev-runtime-config",
    configureServer(server) {
      // Must run before Vite's static handler, which serves the config.json
      // sitting in the project root.
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/config.json") return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        // Empty rctfOrigin: the API clients then build same-origin URLs, hitting the proxy.
        res.end(JSON.stringify({ rctfOrigin: "", extrasOrigin }));
      });
    },
  };
}

const viteConfig = defineConfig({
  plugins: [react(), ...(rctfProxy ? [devRuntimeConfig()] : [])],
  server: rctfProxy
    ? {
        proxy: {
          "/api/v1": rctfProxy,
          "/api/v2": rctfProxy,
          // rCTF hands back attachment and avatar paths relative to its own origin.
          "/uploads": rctfProxy,
        },
      }
    : {},
});

const vitestConfig = defineVitestConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});

export default mergeConfig(viteConfig, vitestConfig);
