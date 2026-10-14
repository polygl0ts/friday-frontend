import { expect, it } from "vitest";
import nginxConf from "../nginx.conf?raw";
import { CALENDAR_FEED_URL } from "./calendarFeed";

it("nginx proxies the same feed URL", () => {
  const url = new URL(CALENDAR_FEED_URL);
  expect(nginxConf).toContain(`proxy_pass ${url.origin};`);
  expect(nginxConf).toContain(`rewrite ^ ${url.pathname}${url.search}? break;`);
});
