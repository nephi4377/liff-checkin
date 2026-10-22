/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIFF_ID?: string
  readonly VITE_SYNC_NAMESPACE?: string
  readonly VITE_SYNC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
