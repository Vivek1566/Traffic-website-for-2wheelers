/**
 * @file main.jsx
 * @description Main application entrypoint mounting the React DOM tree.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * Initializes and mounts the React application to the root DOM container.
 * @returns {void}
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

