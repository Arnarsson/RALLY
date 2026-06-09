import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from '../public/registerSW.js'
import { getActiveVars, getThemeName } from './theme.js'

// Apply theme CSS variables to :root and set data-theme before first paint.
// Flip ACTIVE_THEME in theme.js to revert — nothing else needs to change.
;(function applyTheme() {
  const root = document.documentElement
  root.setAttribute('data-theme', getThemeName())
  const vars = getActiveVars()
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

registerSW() // no-op on file:// + dev; installs the PWA service worker in prod
