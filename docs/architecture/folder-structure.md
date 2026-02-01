# Project Folder Structure

## Complete Directory Structure

```
cosmos-viewer/
│
├── docs/                           # Documentation
│   ├── CLAUDE.md                   # AI implementation guide
│   ├── architecture/               # Architecture documentation
│   │   ├── overview.md
│   │   ├── folder-structure.md     # This file
│   │   └── data-flow.md
│   ├── adr/                        # Architecture Decision Records
│   │   ├── 001-electron-platform.md
│   │   ├── 002-ngrx-signalstore.md
│   │   ├── 003-monaco-editor.md
│   │   ├── 004-cosmos-sdk-integration.md
│   │   └── 005-dirty-state-tracking.md
│   ├── features/                   # Feature specifications
│   │   ├── connections.md
│   │   ├── explorer.md
│   │   ├── query-editor.md
│   │   └── crud-operations.md
│   ├── implementation/             # Implementation guides
│   │   ├── phase-1-setup.md
│   │   ├── phase-2-core.md
│   │   ├── phase-3-connections.md
│   │   ├── phase-4-explorer.md
│   │   ├── phase-5-query.md
│   │   └── phase-6-polish.md
│   └── api/                        # API documentation
│       ├── stores.md
│       ├── services.md
│       └── models.md
│
├── electron/                       # Electron main process
│   ├── main.ts                     # Main entry point
│   ├── preload.ts                  # Context bridge (exposes API to renderer)
│   ├── tsconfig.json               # TypeScript config for Electron
│   └── services/                   # Main process services
│       ├── cosmos.service.ts       # @azure/cosmos SDK wrapper
│       ├── storage.service.ts      # electron-store wrapper
│       └── ipc-handlers.ts         # IPC message handlers
│
├── src/                            # Angular application (renderer process)
│   ├── index.html                  # HTML entry point
│   ├── main.ts                     # Angular bootstrap
│   ├── styles.scss                 # Global styles
│   │
│   ├── app/
│   │   ├── app.component.ts        # Root component
│   │   ├── app.component.html
│   │   ├── app.component.scss
│   │   ├── app.config.ts           # Application configuration
│   │   ├── app.routes.ts           # Root routing configuration
│   │   │
│   │   ├── core/                   # Singleton services, models, utilities
│   │   │   ├── services/
│   │   │   │   ├── electron.service.ts      # IPC bridge to main process
│   │   │   │   └── notification.service.ts  # Snackbar notifications
│   │   │   │
│   │   │   ├── models/
│   │   │   │   ├── connection.model.ts      # CosmosConnection interface
│   │   │   │   ├── document.model.ts        # CosmosDocument interface
│   │   │   │   ├── query.model.ts           # Query-related types
│   │   │   │   └── tree-node.model.ts       # Tree structure types
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── json-flattener.ts        # Flatten nested JSON
│   │   │   │   ├── column-detector.ts       # Detect columns from docs
│   │   │   │   ├── diff-tracker.ts          # Track document changes
│   │   │   │   └── path-utils.ts            # JSON path utilities
│   │   │   │
│   │   │   └── guards/
│   │   │       └── connection.guard.ts      # Require active connection
│   │   │
│   │   ├── shared/                 # Reusable components, pipes, directives
│   │   │   ├── components/
│   │   │   │   ├── loading-spinner/
│   │   │   │   │   └── loading-spinner.component.ts
│   │   │   │   ├── confirm-dialog/
│   │   │   │   │   └── confirm-dialog.component.ts
│   │   │   │   ├── json-viewer/
│   │   │   │   │   └── json-viewer.component.ts
│   │   │   │   └── error-display/
│   │   │   │       └── error-display.component.ts
│   │   │   │
│   │   │   ├── pipes/
│   │   │   │   ├── json-path.pipe.ts        # Access nested values
│   │   │   │   └── truncate.pipe.ts         # Truncate long strings
│   │   │   │
│   │   │   └── directives/
│   │   │       └── auto-focus.directive.ts
│   │   │
│   │   ├── features/               # Feature modules (lazy loaded)
│   │   │   │
│   │   │   ├── connections/        # Connection management feature
│   │   │   │   ├── connections.routes.ts
│   │   │   │   ├── store/
│   │   │   │   │   ├── connections.store.ts
│   │   │   │   │   └── connections.models.ts
│   │   │   │   ├── containers/                    # Smart components
│   │   │   │   │   └── connections-page/
│   │   │   │   │       ├── connections-page.component.ts
│   │   │   │   │       ├── connections-page.component.html
│   │   │   │   │       └── connections-page.component.scss
│   │   │   │   └── components/                    # Dumb components
│   │   │   │       ├── connection-list/
│   │   │   │       │   ├── connection-list.component.ts
│   │   │   │       │   ├── connection-list.component.html
│   │   │   │       │   └── connection-list.component.scss
│   │   │   │       ├── connection-form/
│   │   │   │       │   ├── connection-form.component.ts
│   │   │   │       │   ├── connection-form.component.html
│   │   │   │       │   └── connection-form.component.scss
│   │   │   │       └── connection-card/
│   │   │   │           ├── connection-card.component.ts
│   │   │   │           ├── connection-card.component.html
│   │   │   │           └── connection-card.component.scss
│   │   │   │
│   │   │   ├── explorer/           # Database explorer feature
│   │   │   │   ├── explorer.routes.ts
│   │   │   │   ├── store/
│   │   │   │   │   ├── explorer.store.ts
│   │   │   │   │   └── explorer.models.ts
│   │   │   │   ├── containers/
│   │   │   │   │   └── explorer-page/
│   │   │   │   │       ├── explorer-page.component.ts
│   │   │   │   │       ├── explorer-page.component.html
│   │   │   │   │       └── explorer-page.component.scss
│   │   │   │   └── components/
│   │   │   │       ├── database-tree/
│   │   │   │       │   ├── database-tree.component.ts
│   │   │   │       │   ├── database-tree.component.html
│   │   │   │       │   └── database-tree.component.scss
│   │   │   │       └── context-menu/
│   │   │   │           └── context-menu.component.ts
│   │   │   │
│   │   │   └── query-editor/       # Query editor feature
│   │   │       ├── query-editor.routes.ts
│   │   │       ├── store/
│   │   │       │   ├── query.store.ts
│   │   │       │   ├── documents.store.ts
│   │   │       │   └── query.models.ts
│   │   │       ├── containers/
│   │   │       │   └── query-page/
│   │   │       │       ├── query-page.component.ts
│   │   │       │       ├── query-page.component.html
│   │   │       │       └── query-page.component.scss
│   │   │       └── components/
│   │   │           ├── query-input/
│   │   │           │   ├── query-input.component.ts
│   │   │           │   ├── query-input.component.html
│   │   │           │   └── query-input.component.scss
│   │   │           ├── results-table/
│   │   │           │   ├── results-table.component.ts
│   │   │           │   ├── results-table.component.html
│   │   │           │   └── results-table.component.scss
│   │   │           ├── editable-cell/
│   │   │           │   ├── editable-cell.component.ts
│   │   │           │   ├── editable-cell.component.html
│   │   │           │   └── editable-cell.component.scss
│   │   │           ├── document-editor/
│   │   │           │   ├── document-editor.component.ts
│   │   │           │   ├── document-editor.component.html
│   │   │           │   └── document-editor.component.scss
│   │   │           ├── pagination-controls/
│   │   │           │   └── pagination-controls.component.ts
│   │   │           ├── changes-toolbar/
│   │   │           │   ├── changes-toolbar.component.ts
│   │   │           │   ├── changes-toolbar.component.html
│   │   │           │   └── changes-toolbar.component.scss
│   │   │           └── import-export/
│   │   │               ├── import-dialog.component.ts
│   │   │               └── export-dialog.component.ts
│   │   │
│   │   └── layout/                 # Layout components
│   │       ├── main-layout/
│   │       │   ├── main-layout.component.ts
│   │       │   ├── main-layout.component.html
│   │       │   └── main-layout.component.scss
│   │       ├── sidebar/
│   │       │   ├── sidebar.component.ts
│   │       │   └── sidebar.component.html
│   │       └── header/
│   │           ├── header.component.ts
│   │           └── header.component.html
│   │
│   ├── styles/                     # Global styles
│   │   ├── _variables.scss         # SCSS variables
│   │   ├── _theme.scss             # Angular Material theme
│   │   ├── _typography.scss        # Typography styles
│   │   └── _utilities.scss         # Utility classes
│   │
│   └── environments/               # Environment configs
│       ├── environment.ts
│       └── environment.prod.ts
│
├── angular.json                    # Angular CLI configuration
├── package.json                    # NPM dependencies
├── tsconfig.json                   # TypeScript base config
├── tsconfig.app.json               # App TypeScript config
├── tsconfig.spec.json              # Test TypeScript config
└── electron-builder.json           # Electron packaging config
```

## Key Conventions

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case | `connection-card.component.ts` |
| Services | kebab-case | `electron.service.ts` |
| Stores | kebab-case | `connections.store.ts` |
| Models | kebab-case | `connection.model.ts` |
| Interfaces | PascalCase | `CosmosConnection` |
| Store classes | PascalCase + Store | `ConnectionsStore` |

### Component Structure

**Smart Components (Containers)**
```typescript
// Located in: features/{feature}/containers/{name}/
@Component({
  selector: 'app-feature-page',
  standalone: true,
  imports: [/* ... */],
  templateUrl: './feature-page.component.html',
  styleUrl: './feature-page.component.scss',
})
export class FeaturePageComponent {
  // Inject stores
  private store = inject(FeatureStore);

  // Expose signals to template
  items = this.store.items;
  isLoading = this.store.isLoading;

  // Event handlers call store methods
  onItemSelect(id: string) {
    this.store.selectItem(id);
  }
}
```

**Dumb Components (Presentational)**
```typescript
// Located in: features/{feature}/components/{name}/
@Component({
  selector: 'app-item-card',
  standalone: true,
  imports: [/* ... */],
  templateUrl: './item-card.component.html',
  styleUrl: './item-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCardComponent {
  // Inputs
  @Input({ required: true }) item!: Item;
  @Input() isSelected = false;

  // Outputs
  @Output() select = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
}
```

### Store Structure

```typescript
// Located in: features/{feature}/store/{feature}.store.ts
export const FeatureStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(/* derived signals */),
  withMethods(/* actions and async operations */)
);
```

### File Organization Rules

1. **One component per file** - Each component in its own file
2. **Co-locate related files** - Template, styles, and spec in same folder
3. **Feature-first organization** - Group by feature, not by type
4. **Lazy load features** - Each feature has its own routes file
5. **Core is singleton** - Services in core are app-wide singletons
6. **Shared is reusable** - Components in shared used across features
