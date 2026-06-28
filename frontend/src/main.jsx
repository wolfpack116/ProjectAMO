import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.jsx'
import 'pretendard-gov/dist/web/static/pretendard-gov.css'
import './shared/theme/tokens.css'
import './app/App.css'
import { loadStoredFont } from './shared/theme/fontPrefs.js'

loadStoredFont()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
