import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'connections',
    pathMatch: 'full',
  },
  {
    path: 'connections',
    loadChildren: () =>
      import('./features/connections/connections.routes').then(
        (m) => m.CONNECTIONS_ROUTES
      ),
  },
  {
    path: 'explorer',
    loadChildren: () =>
      import('./features/explorer/explorer.routes').then(
        (m) => m.EXPLORER_ROUTES
      ),
  },
];
