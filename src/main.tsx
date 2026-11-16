import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { APP_LANG } from './i18n/lang'
import { startTranslator } from './i18n/translator'

if (APP_LANG === 'en') startTranslator()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
