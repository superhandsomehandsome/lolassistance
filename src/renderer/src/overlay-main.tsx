import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay } from './pages/Overlay'

createRoot(document.getElementById('overlay-root')!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>
)
