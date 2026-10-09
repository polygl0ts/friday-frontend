import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, mergeConfig } from "vite";
import type { Plugin } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { CALENDAR_FEED_PATH, CALENDAR_FEED_URL } from "./src/calendarFeed.ts";

/*
 * Set by ./dev.sh. rCTF answers with a fixed Access-Control-Allow-Origin naming
 * the deployed frontend, so a localhost page cannot call it directly: proxying
 * through the dev server makes the request from Node instead. The extras
 * backend stays cross-origin, so its CORS config is still exercised here.
 * The public calendar is the other exception: Nextcloud sends no CORS
 * headers, so `calendarProxy` below fetches it server-side.
 */
const rctfUpstream = process.env.DEV_RCTF_ORIGIN;
const extrasOrigin = process.env.DEV_EXTRAS_ORIGIN ?? "http://localhost:8091";
const slidesOrigin =
  process.env.DEV_SLIDES_ORIGIN ??
  "https://raw.githubusercontent.com/polygl0ts/slides/main";

const rctfProxy = rctfUpstream
  ? // changeOrigin rewrites the Host header, which rCTF's reverse proxy routes on.
    { target: rctfUpstream, changeOrigin: true }
  : undefined;

/**
 * Serves the public calendar at `/calendar.ics`. The browser cannot fetch
 * Nextcloud directly: that host sends no CORS headers. Production does the
 * same thing in nginx.conf.
 */
function calendarProxy(): Plugin {
  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split("?")[0] !== CALENDAR_FEED_PATH) return next();
    fetch(CALENDAR_FEED_URL)
      .then(async (upstream) => {
        res.statusCode = upstream.ok ? 200 : upstream.status;
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(await upstream.text());
      })
      .catch((err: unknown) => {
        res.statusCode = 502;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(err instanceof Error ? err.message : "calendar feed unavailable");
      });
  };
  return {
    name: "calendar-ics",
    configureServer(server) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
}

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
        res.end(JSON.stringify({ rctfOrigin: "", extrasOrigin, slidesOrigin }));
      });
    },
  };
}

const viteConfig = defineConfig({
  plugins: [react(), calendarProxy(), ...(rctfProxy ? [devRuntimeConfig()] : [])],
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
