import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { bootstrapDemoIfNeeded } from './demo/fixture'
import './index.css'

bootstrapDemoIfNeeded()

// 強制拿到新協議 JS（換 Mantle 房間後舊 SW 不能繼續寫舊房）
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.update()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
