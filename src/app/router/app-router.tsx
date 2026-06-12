import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminShell } from '../../shared/layout/admin-shell';
import { renderAdminRouteElement } from './route-elements';
import {
  adminRouteDefinitions,
  type AdminRouteDefinition
} from './routes';

const NotFoundPage = lazy(
  () => import('../../shared/ui/not-found/not-found-page')
);

function renderAdminRoute(route: AdminRouteDefinition): JSX.Element {
  return (
    <Route
      key={route.path}
      path={route.path}
      element={renderAdminRouteElement(route)}
    />
  );
}

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<AdminShell />}>
        {adminRouteDefinitions.map(renderAdminRoute)}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
