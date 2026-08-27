# friday-frontend

The thing at https://friday.polygl0ts.ch/ .

It uses two backends, rctf for submission and our custom sauce for writeups etc.

## Develop

Run
```bash
./dev.sh
```
And access http://localhost:5173 (frontend) and http://localhost:8091/docs (backend).

Uses the live deployed rCTF instance.

Assumes that the `./friday-frontend` repo (this repo) is next to `./friday-extras-backend`. If that
is not the case, set the `BACKEND_DIR` env var to point to the backend directory.

It's live reload on frontend and backend changes.

The script leverages `./vite.config.ts` to override `./config.json` and set up some CORS magic.

## Deployment

The frontend loads its backend origins at startup from `./config.json`.
