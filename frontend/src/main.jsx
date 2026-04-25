import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { migrateFromLocalStorage } from './lib/draftStore.js'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
