/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RCTF_ORIGIN: string;
  readonly VITE_EXTRAS_ORIGIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
