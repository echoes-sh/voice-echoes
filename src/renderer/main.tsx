import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import App from './App'
import SettingsPage from './SettingsPage'

const isSettings = window.location.hash === '#settings'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSettings ? <SettingsPage /> : <App />}
  </React.StrictMode>
)
