import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ui/Toast'
import { LanguageProvider } from './context/LanguageContext'
import { applyWebSettingsToDOM, getWebSettings } from './utils/webSettings'

// Initialize stored theme, font scaling and language before rendering
applyWebSettingsToDOM(getWebSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>
  </StrictMode>,
)
