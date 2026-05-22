import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { migrateFromLocalStorage, migrateLegacyNewKey } from './lib/draftStore.js'

// Ask the browser to keep our IndexedDB durable through storage pressure (Safari ITP eviction
// in particular). PWAs installed to the home screen on iOS get this automatically; on web it
// requires user gesture or browser-discretion grant. Best effort — we just log the result.
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((granted) => {
    if (granted) console.log('[draftStore] persistent storage granted')
    else console.log('[draftStore] persistent storage NOT granted (iOS Safari ITP risk)')
  }).catch(() => {})
}

// One-time migration from localStorage drafts → IndexedDB. Idempotent.
migrateFromLocalStorage().then(({ migrated }) => {
  if (migrated > 0) console.log(`[draftStore] migrated ${migrated} drafts from localStorage`)
}).catch((e) => console.error('[draftStore] migration failed', e))

// Migra o singleton legacy 'new' pra uma UUID. Resgata qualquer rascunho de ficha que estava
// preso nesse slot — vai aparecer no /fichas como linha local-only pra Camila continuar.
// Idempotente: depois de migrado, 'new' não existe mais em STORE_SURGERIES.
migrateLegacyNewKey().then((uuid) => {
  if (uuid) console.log(`[draftStore] migrated legacy 'new' singleton -> ${uuid}`)
}).catch((e) => console.error('[draftStore] migrateLegacyNewKey failed', e))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
