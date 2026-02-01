# ADR-002: NgRx SignalStore for State Management

## Status
**Accepted**

## Context

The application requires state management for:
- Connection configurations
- Database/container tree state
- Query execution state and results
- Document modifications and dirty tracking
- UI state (loading, errors, selections)

### Options Considered

1. **Angular Services with Signals** (simple signal-based services)
2. **NgRx Store (classic)** (actions, reducers, effects, selectors)
3. **NgRx SignalStore** (signal-based, less boilerplate)
4. **NGXS** (decorator-based state management)
5. **Akita** (entity-based state management)

## Decision

We will use **NgRx SignalStore** for all application state management.

## Rationale

### Why NgRx SignalStore?

| Criterion | Services+Signals | NgRx Classic | SignalStore | NGXS | Akita |
|-----------|------------------|--------------|-------------|------|-------|
| Boilerplate | Minimal | High | Low | Medium | Medium |
| Type safety | Good | Excellent | Excellent | Good | Good |
| DevTools | No | Yes | Yes | Yes | Yes |
| Signal-native | Yes | No* | Yes | No | No |
| Learning curve | Low | High | Medium | Medium | Medium |
| RxJS integration | Manual | Built-in | Built-in | Built-in | Built-in |
| Community/Support | N/A | Excellent | Good | Good | Medium |

*NgRx Store has signal adapters but isn't signal-native

### Key Advantages

1. **Signal-Native**: Built on Angular signals for optimal change detection
2. **Less Boilerplate**: No separate action/reducer/effect files
3. **Type Safety**: Full TypeScript inference
4. **RxJS Integration**: `rxMethod` for async operations
5. **Computed Signals**: Derived state with `withComputed`
6. **NgRx Ecosystem**: Compatible with NgRx DevTools

### Trade-offs Accepted

1. **Newer API**: Less community examples than classic NgRx
2. **Different patterns**: Team needs to learn SignalStore patterns
3. **Less strict**: More flexible but requires discipline

## Implementation

### Store Pattern

```typescript
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';

interface FeatureState {
  items: Item[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: FeatureState = {
  items: [],
  selectedId: null,
  isLoading: false,
  error: null,
};

export const FeatureStore = signalStore(
  { providedIn: 'root' },

  // State
  withState(initialState),

  // Derived state (computed signals)
  withComputed(({ items, selectedId }) => ({
    selectedItem: computed(() =>
      items().find(i => i.id === selectedId())
    ),
    itemCount: computed(() => items().length),
  })),

  // Methods (actions + effects combined)
  withMethods((store) => {
    const electronService = inject(ElectronService);

    return {
      // Sync method
      selectItem: (id: string) => {
        patchState(store, { selectedId: id });
      },

      // Async method with rxMethod
      loadItems: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true })),
          switchMap(() => from(electronService.getItems())),
          tapResponse({
            next: (items) => patchState(store, { items, isLoading: false }),
            error: (err) => patchState(store, { error: err.message, isLoading: false }),
          })
        )
      ),

      clearError: () => patchState(store, { error: null }),
    };
  })
);
```

### Usage in Components

```typescript
@Component({
  selector: 'app-feature-page',
  standalone: true,
  template: `
    @if (isLoading()) {
      <app-loading-spinner />
    }

    @for (item of items(); track item.id) {
      <app-item-card
        [item]="item"
        [isSelected]="item.id === selectedId()"
        (select)="onSelect(item.id)"
      />
    }

    @if (error(); as errorMsg) {
      <app-error-display [message]="errorMsg" />
    }
  `,
})
export class FeaturePageComponent implements OnInit {
  private store = inject(FeatureStore);

  // Expose signals to template
  items = this.store.items;
  selectedId = this.store.selectedId;
  isLoading = this.store.isLoading;
  error = this.store.error;

  ngOnInit() {
    this.store.loadItems();
  }

  onSelect(id: string) {
    this.store.selectItem(id);
  }
}
```

### Store Dependencies

Stores can depend on each other:

```typescript
export const QueryStore = signalStore(
  withMethods((store) => {
    // Inject other stores
    const connectionsStore = inject(ConnectionsStore);
    const explorerStore = inject(ExplorerStore);

    return {
      executeQuery: rxMethod<void>(
        pipe(
          switchMap(() => {
            // Read from other stores
            const connection = connectionsStore.activeConnection();
            const container = explorerStore.selectedContainer();
            // ...
          })
        )
      ),
    };
  })
);
```

## Consequences

### Positive
- Significantly less code than classic NgRx
- Natural fit with Angular's signal-based reactivity
- Easier to understand and maintain
- Good TypeScript support

### Negative
- Team needs to learn new patterns
- Fewer examples in community
- May need to adapt some NgRx classic patterns

### Neutral
- Still uses RxJS for async operations
- DevTools work similarly to classic NgRx

## References

- [NgRx SignalStore Documentation](https://ngrx.io/guide/signals/signal-store)
- [NgRx SignalStore rxMethod](https://ngrx.io/guide/signals/rxjs-integration)
- [Angular Signals](https://angular.io/guide/signals)
