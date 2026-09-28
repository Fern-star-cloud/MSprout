import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/tokens.css'
import './styles/global.css'
import App from './App.tsx'
import { pwaUpdateController } from './pwa/update-controller'
import { profileStore } from './offline/profile-store'

pwaUpdateController.setUnsafeLocalWorkChecker(() => profileStore.hasUnsafeLocalWork())
pwaUpdateController.start(registerSW)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
