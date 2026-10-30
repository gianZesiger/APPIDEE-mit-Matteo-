/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics auf der Startseite, leer = aus (Standard) */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
  readonly VITE_SINGLEFILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
