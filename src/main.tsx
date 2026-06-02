// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initTabletWobbleFix } from './utils/tabletGlobalFix';

// Initialize the global tablet wobble fix for UI elements
initTabletWobbleFix();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);