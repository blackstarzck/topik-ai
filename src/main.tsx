// Release pipeline canary: exercises the company promotion + production deploy
// path end-to-end with no functional or visual change to the application.
// Staging preview verification is part of the same fail-closed release chain.
// The preview build is pinned to the topik-dev Supabase project for verification.
// The company production workflow now pins V13_CONTRACT_SHA, so this canary
// re-runs the app-only chain that previously stopped at the release env lock.
// The candidate build now pins its own Supabase target and asserts the built
// bundle, so this canary proves the production promote step end-to-end.
// promote/rollback/logs now pin the team scope as well, so this run should
// reach the Production alias switch.
// Production is two releases behind and topik-prod still lacks the permission
// alignment migration, so this canary opens a fresh source SHA for the manual
// app-db release that ships the pending migration and the app together.
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './app/app';
// 🚨 순서가 중요하다 — 생성된 CSS 변수가 global.css 보다 **먼저** 들어와야 var() 가 해석된다.
import './styles/generated-design-tokens.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
