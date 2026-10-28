/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Öffentliche Adresse, z.B. https://example.ch (für canonical, OG-Bild, Sitemap) */
  readonly VITE_SITE_URL?: string;
  /** Messung auf der Landingpage: umami, plausible oder leer (aus) */
  readonly VITE_ANALYTICS?: string;
  readonly VITE_ANALYTICS_SRC?: string;
  readonly VITE_ANALYTICS_ID?: string;
  readonly VITE_SINGLEFILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
