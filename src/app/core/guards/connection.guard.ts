import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Guard that ensures a connection is active before accessing protected routes
 */
export const connectionGuard: CanActivateFn = () => {
  const router = inject(Router);

  // Check if there's an active connection in session storage
  const activeConnection = sessionStorage.getItem('activeConnectionId');

  if (!activeConnection) {
    router.navigate(['/connections']);
    return false;
  }

  return true;
};
