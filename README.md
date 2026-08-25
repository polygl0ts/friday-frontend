# friday-frontend

The thing at https://friday.polygl0ts.ch/ .

It uses two backends, rctf for submission and our custom sauce for writeups etc.

## Develop

If you have both backends up and running, bring up the frontend like this:
```bash
npm install
VITE_RCTF_ORIGIN=http://localhost:8090 VITE_EXTRAS_ORIGIN=http://localhost:8091 npm run dev
```

You can also use these:
```bash
npm run dev   # vite dev server
npm run build # typecheck + prod build
npm run test  # vitest
npm run lint  # oxlint
```

