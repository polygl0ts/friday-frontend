# friday-frontend

The thing at https://friday.polygl0ts.ch/ .

It uses two backends, rctf for submission and our custom sauce for writeups etc.

## Develop

If you have both backends up and running, bring up the frontend like this:
```bash
npm install
npm run dev
```

The frontend loads its backend origins at startup from `./config.json`.

You can also use these:
```bash
npm run dev   # vite dev server
npm run build # typecheck + prod build
npm run test  # vitest
npm run lint  # oxlint
```
