interface ImportMetaEnv {
  readonly VITE_FINNHUB_API_KEY?: string;
  readonly VITE_FMP_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
