import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { api } from './lib/api'
import './styles/globals.css'

// Screens ported from the original desktop app call `window.electronAPI.*`.
// This shim points those same calls at the web API client so screen code
// didn't need to be rewritten method-by-method.
;(window as any).electronAPI = api

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
