// Release pipeline canary: exercises the company promotion + production deploy
// path end-to-end with no functional or visual change to the application.
// Staging preview verification is part of the same fail-closed release chain.
// The preview build is pinned to the topik-dev Supabase project for verification.
// The company production workflow now pins V13_CONTRACT_SHA, so this canary
// re-runs the app-only chain that previously stopped at the release env lock.
// The candidate build now pins its own Supabase target and asserts the built
// bundle, so this canary proves the production promote step end-to-end.
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './app/app';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
