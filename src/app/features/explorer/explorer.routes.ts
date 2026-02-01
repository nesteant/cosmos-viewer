import { Routes } from '@angular/router';
import { connectionGuard } from '@core/guards';

export const EXPLORER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./explorer.component').then((m) => m.ExplorerComponent),
    canActivate: [connectionGuard],
  },
];
