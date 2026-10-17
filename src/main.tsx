import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PwaPrompt } from './components/PwaPrompt'
import './index.css'
import { applyTheme, savedTheme } from './lib/theme'

applyTheme(savedTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaPrompt />
  </StrictMode>,
)
