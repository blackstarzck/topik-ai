// Release pipeline canary: exercises the company promotion + production deploy
// path end-to-end with no functional or visual change to the application.
// Staging preview verification is part of the same fail-closed release chain.
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './app/app';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
