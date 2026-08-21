/**
 * Entra ID (AAD) authentication for Cosmos accounts that have key-based
 * ("local") authentication disabled.
 *
 * Connections are configured with a connection string, which says nothing about
 * how the account wants to be authenticated, so auth is resolved at runtime:
 * the account key is tried first and, when the account rejects it, the request
 * is retried with an Entra ID token (see nextAuthState).
 *
 * Tokens come from DefaultAzureCredential, so any of the standard sources
 * works: environment variables, a signed-in Azure CLI / Azure Developer CLI /
 * PowerShell / VS Code, or a managed identity when running on Azure.
 */

import { DefaultAzureCredential } from '@azure/identity';
import type { TokenCredential } from '@azure/identity';

/** How a request authenticates against the account */
export interface AuthState {
  mode: 'key' | 'entra';
  /** Entra only - the tenant the account trusts, when it is not the default one */
  tenantId?: string;
}

/**
 * GUI apps launched from Finder/Explorer inherit a minimal PATH, so the
 * developer credentials in the chain cannot find the `az` / `azd` binaries.
 */
const CLI_PATHS: Record<string, string[]> = {
  darwin: ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'],
  linux: ['/usr/local/bin', '/usr/bin', '/bin', '/snap/bin'],
  win32: [
    'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin',
    'C:\\Program Files (x86)\\Microsoft SDKs\\Azure\\CLI2\\wbin',
  ],
};

let pathPatched = false;

function ensureCliOnPath(): void {
  if (pathPatched) return;
  pathPatched = true;

  const extras = CLI_PATHS[process.platform] ?? [];
  if (extras.length === 0) return;

  const separator = process.platform === 'win32' ? ';' : ':';
  const current = (process.env['PATH'] ?? '').split(separator).filter(Boolean);
  const missing = extras.filter((dir) => !current.includes(dir));
  if (missing.length > 0) {
    process.env['PATH'] = [...current, ...missing].join(separator);
  }
}

// One credential per tenant - each keeps its own token cache
const credentials = new Map<string, TokenCredential>();

/**
 * Get (or create) a DefaultAzureCredential for the given tenant.
 * Omit tenantId to use whichever tenant the underlying credential defaults to.
 */
export function getEntraCredential(tenantId?: string): TokenCredential {
  ensureCliOnPath();

  const tenant = tenantId?.trim();
  const cacheKey = tenant || 'default';

  let credential = credentials.get(cacheKey);
  if (!credential) {
    credential = new DefaultAzureCredential(tenant ? { tenantId: tenant } : {});
    credentials.set(cacheKey, credential);
  }
  return credential;
}

/** The account names the tenants it trusts when it rejects a token from another one */
function trustedTenant(message: string): string | undefined {
  const tenants = message.match(/AAD tenant\(s\) \[([^\]]+)\]/)?.[1];
  return tenants?.split(',')[0]?.trim() || undefined;
}

/**
 * Given the auth that just failed, the auth worth trying next - or null when
 * the failure is not something a different credential would fix.
 */
export function nextAuthState(message: string, current: AuthState): AuthState | null {
  // The account has keys switched off - only an Entra token will be accepted
  if (current.mode === 'key' && message.includes('Local Authorization is disabled')) {
    return { mode: 'entra' };
  }

  // Signed in, but to the wrong tenant - the account tells us which one it trusts
  if (current.mode === 'entra' && message.includes('is not trusted by this database account')) {
    const tenant = trustedTenant(message);
    if (tenant && tenant !== current.tenantId) {
      return { mode: 'entra', tenantId: tenant };
    }
  }

  return null;
}

/** Human-readable form of an auth state, for messages and logs */
export function describeAuthState(state: AuthState): string {
  if (state.mode === 'key') return 'account key';
  return state.tenantId ? `Entra ID (tenant ${state.tenantId})` : 'Entra ID';
}

/**
 * Add actionable guidance to auth failures - the raw SDK messages describe what
 * went wrong but never what to do about it.
 */
export function explainAuthError(message: string, state: AuthState): string {
  if (message.includes('Local Authorization is disabled')) {
    return `${message}\n\nThis account requires Entra ID sign-in. Sign in with "az login", or set AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET, then retry.`;
  }

  if (state.mode !== 'entra') return message;

  if (
    message.includes('CredentialUnavailableError') ||
    message.includes('failed to retrieve a token') ||
    message.includes('DefaultAzureCredential')
  ) {
    return `${message}\n\nNo Azure identity was found. Sign in with "az login", or set AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET, then retry.`;
  }

  if (message.includes('is not trusted by this database account')) {
    const tenant = trustedTenant(message);
    return `${message}\n\nYou are signed in to a different tenant. Run "az login --tenant ${tenant ?? '<tenant-id>'}" and retry.`;
  }

  if (message.includes('"code":"Forbidden"') || message.includes('403')) {
    return `${message}\n\nSigned in, but the identity has no Cosmos DB data-plane role on this account. Assign one with "az cosmosdb sql role assignment create" (e.g. Cosmos DB Built-in Data Contributor) - Azure control-plane roles such as Owner do not grant data access.`;
  }

  return message;
}
