# Phase 1: Project Setup

## Overview

This phase sets up the Electron + Angular project with all required dependencies and configuration.

## Prerequisites

- Node.js 20+ LTS
- npm 10+
- Git

## Steps

### 1.1 Initialize Angular Project

```bash
# Create new Angular project with standalone components
ng new cosmos-viewer --standalone --style=scss --routing --ssr=false

cd cosmos-viewer
```

### 1.2 Install Angular Dependencies

```bash
# Angular Material
ng add @angular/material
# Choose: Custom theme, Yes to typography, Yes to animations

# NgRx SignalStore
npm install @ngrx/signals @ngrx/operators

# Monaco Editor for Angular
npm install ngx-monaco-editor-v2 monaco-editor

# Additional utilities
npm install uuid
npm install -D @types/uuid
```

### 1.3 Install Electron Dependencies

```bash
# Electron core
npm install -D electron electron-builder

# Electron utilities
npm install electron-store

# Cosmos SDK (runs in main process)
npm install @azure/cosmos

# TypeScript for Electron
npm install -D ts-node
```

### 1.4 Create Electron Directory Structure

```bash
mkdir -p electron/services
touch electron/main.ts
touch electron/preload.ts
touch electron/tsconfig.json
touch electron/services/cosmos.service.ts
touch electron/services/storage.service.ts
touch electron/services/ipc-handlers.ts
```

### 1.5 Configure Electron TypeScript

Create `electron/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "../dist-electron",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 1.6 Create Electron Main Process

Create `electron/main.ts`:

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { registerCosmosHandlers } from './services/ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset', // macOS
    show: false,
  });

  // Show when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load Angular app
  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/cosmos-viewer/browser/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers
registerCosmosHandlers();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

### 1.7 Create Preload Script

Create `electron/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for exposed API
export interface ElectronAPI {
  cosmos: {
    testConnection: (config: any) => Promise<any>;
    listDatabases: (connectionId: string) => Promise<any>;
    listContainers: (connectionId: string, databaseId: string) => Promise<any>;
    executeQuery: (params: any) => Promise<any>;
    createDocument: (params: any) => Promise<any>;
    updateDocument: (params: any) => Promise<any>;
    deleteDocument: (params: any) => Promise<any>;
  };
  storage: {
    getConnections: () => Promise<any[]>;
    saveConnections: (connections: any[]) => Promise<void>;
  };
}

const electronAPI: ElectronAPI = {
  cosmos: {
    testConnection: (config) =>
      ipcRenderer.invoke('cosmos:test-connection', config),
    listDatabases: (connectionId) =>
      ipcRenderer.invoke('cosmos:list-databases', connectionId),
    listContainers: (connectionId, databaseId) =>
      ipcRenderer.invoke('cosmos:list-containers', connectionId, databaseId),
    executeQuery: (params) =>
      ipcRenderer.invoke('cosmos:execute-query', params),
    createDocument: (params) =>
      ipcRenderer.invoke('cosmos:create-document', params),
    updateDocument: (params) =>
      ipcRenderer.invoke('cosmos:update-document', params),
    deleteDocument: (params) =>
      ipcRenderer.invoke('cosmos:delete-document', params),
  },
  storage: {
    getConnections: () =>
      ipcRenderer.invoke('storage:get-connections'),
    saveConnections: (connections) =>
      ipcRenderer.invoke('storage:save-connections', connections),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

### 1.8 Update package.json Scripts

Add to `package.json`:

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "electron:build": "tsc -p electron/tsconfig.json",
    "electron:dev": "npm run electron:build && NODE_ENV=development electron .",
    "electron:start": "concurrently \"npm run start\" \"wait-on http://localhost:4200 && npm run electron:dev\"",
    "package": "npm run build && npm run electron:build && electron-builder",
    "package:mac": "npm run package -- --mac",
    "package:win": "npm run package -- --win",
    "package:linux": "npm run package -- --linux"
  }
}
```

Install concurrently and wait-on:

```bash
npm install -D concurrently wait-on
```

### 1.9 Create electron-builder.json

```json
{
  "appId": "com.cosmos-viewer.app",
  "productName": "Cosmos Viewer",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*"
  ],
  "mac": {
    "category": "public.app-category.developer-tools",
    "target": ["dmg", "zip"]
  },
  "win": {
    "target": ["nsis", "portable"]
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "category": "Development"
  }
}
```

### 1.10 Configure Angular for Electron

Update `angular.json` output path (already correct by default):

```json
{
  "projects": {
    "cosmos-viewer": {
      "architect": {
        "build": {
          "options": {
            "outputPath": "dist/cosmos-viewer"
          }
        }
      }
    }
  }
}
```

### 1.11 Create Application Folder Structure

```bash
# Core module
mkdir -p src/app/core/{services,models,utils,guards}

# Shared module
mkdir -p src/app/shared/{components,pipes,directives}
mkdir -p src/app/shared/components/{loading-spinner,confirm-dialog,json-viewer,error-display}

# Features
mkdir -p src/app/features/connections/{store,services,containers/connections-page,components/{connection-list,connection-form,connection-card}}
mkdir -p src/app/features/explorer/{store,services,containers/explorer-page,components/{database-tree,context-menu}}
mkdir -p src/app/features/query-editor/{store,services,containers/query-page,components/{query-input,results-table,editable-cell,document-editor,pagination-controls,changes-toolbar,import-export}}

# Layout
mkdir -p src/app/layout/{main-layout,sidebar,header}

# Styles
mkdir -p src/styles
```

### 1.12 Configure Monaco Editor

Update `src/app/app.config.ts`:

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideMonacoEditor(),
  ],
};
```

### 1.13 Configure Angular Material Theme

Update `src/styles.scss`:

```scss
@use '@angular/material' as mat;

// Custom theme
$cosmos-primary: mat.m2-define-palette(mat.$m2-indigo-palette);
$cosmos-accent: mat.m2-define-palette(mat.$m2-cyan-palette);
$cosmos-warn: mat.m2-define-palette(mat.$m2-red-palette);

$cosmos-theme: mat.m2-define-dark-theme((
  color: (
    primary: $cosmos-primary,
    accent: $cosmos-accent,
    warn: $cosmos-warn,
  ),
  typography: mat.m2-define-typography-config(),
  density: 0,
));

@include mat.all-component-themes($cosmos-theme);

// Global styles
html, body {
  height: 100%;
  margin: 0;
  font-family: Roboto, "Helvetica Neue", sans-serif;
}

body {
  background-color: #1e1e1e;
  color: #e0e0e0;
}

// Scrollbar styling
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #2d2d2d;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #666;
}
```

### 1.14 Add Electron Type Declarations

Create `src/electron.d.ts`:

```typescript
import type { ElectronAPI } from '../electron/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

Update `tsconfig.app.json` to include the type:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": [
    "src/main.ts",
    "src/electron.d.ts"
  ],
  "include": [
    "src/**/*.d.ts"
  ]
}
```

## Verification

1. Run Angular dev server:
   ```bash
   npm start
   # Should open at http://localhost:4200
   ```

2. Run Electron in dev mode:
   ```bash
   npm run electron:start
   # Should open Electron window with Angular app
   ```

3. Check folder structure exists:
   ```bash
   ls -la src/app/features/
   ls -la electron/
   ```

## Checklist

- [ ] Angular project created with standalone components
- [ ] Angular Material installed and themed
- [ ] NgRx SignalStore installed
- [ ] Monaco Editor installed and configured
- [ ] Electron main process created
- [ ] Preload script with context bridge created
- [ ] IPC type definitions added
- [ ] electron-builder configured
- [ ] Folder structure created
- [ ] Dark theme applied
- [ ] Dev server runs successfully
- [ ] Electron dev mode runs successfully

## Next Phase

Proceed to [Phase 2: Core Infrastructure](./phase-2-core.md)
