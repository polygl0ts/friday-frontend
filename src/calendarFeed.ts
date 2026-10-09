/**
 * Public Nextcloud export of the polygl0ts calendar.
 *
 * The page loads it same-origin from `CALENDAR_FEED_PATH`. Nextcloud sends no
 * CORS headers, so the dev server and nginx fetch `CALENDAR_FEED_URL` and
 * serve the body. The URL in `nginx.conf` has to stay the same as this one.
 */
export const CALENDAR_FEED_URL =
  "https://clic.epfl.ch/nextcloud/remote.php/dav/public-calendars/7efWxYZe9ECKSJMC?export";

export const CALENDAR_FEED_PATH = "/calendar.ics";
