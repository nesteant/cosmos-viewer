# ADR-003: Monaco Editor for Query Input

## Status
**Accepted**

## Context

Users need to write CosmosSQL queries to retrieve and filter documents. The query input experience should support:

- Syntax highlighting for SQL-like queries
- Multi-line editing
- Basic code editing features (undo/redo, find/replace)
- Potential for autocomplete in the future

### Options Considered

1. **Plain Textarea** (standard HTML textarea)
2. **CodeMirror 6** (lightweight code editor)
3. **Monaco Editor** (VS Code's editor)
4. **Ace Editor** (older but stable editor)

## Decision

We will use **Monaco Editor** via the `ngx-monaco-editor-v2` Angular wrapper.

## Rationale

### Why Monaco Editor?

| Criterion | Textarea | CodeMirror | Monaco | Ace |
|-----------|----------|------------|--------|-----|
| Syntax highlighting | No | Yes | Yes | Yes |
| IntelliSense ready | No | Possible | Built-in | Possible |
| Bundle size | Tiny | ~100KB | ~2MB | ~500KB |
| Familiar to users | N/A | Less | VS Code | Less |
| Angular integration | Native | Custom | ngx-monaco-editor-v2 | Custom |
| Active development | N/A | Yes | Yes | Slower |

### Key Advantages

1. **VS Code Familiarity**: Users familiar with VS Code will feel at home
2. **IntelliSense Infrastructure**: Built-in support for autocomplete, hover info
3. **SQL Language Support**: Has SQL syntax highlighting out of the box
4. **Robust Features**: Find/replace, multiple cursors, minimap
5. **Future Extensibility**: Can add CosmosSQL language server later
6. **Angular Package**: `ngx-monaco-editor-v2` provides clean integration

### Trade-offs Accepted

1. **Bundle Size**: ~2MB for Monaco - acceptable for Electron app
2. **Complexity**: More complex than needed for basic queries
3. **Web Workers**: Monaco uses workers, need to configure in Electron

## Implementation

### Installation

```bash
npm install ngx-monaco-editor-v2 monaco-editor
```

### Angular Configuration

```typescript
// app.config.ts
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';

export const appConfig: ApplicationConfig = {
  providers: [
    provideMonacoEditor(),
    // ...
  ],
};
```

### Component Usage

```typescript
// query-input.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

@Component({
  selector: 'app-query-input',
  standalone: true,
  imports: [FormsModule, MonacoEditorModule],
  template: `
    <div class="query-editor">
      <ngx-monaco-editor
        [options]="editorOptions"
        [(ngModel)]="query"
        (ngModelChange)="queryChange.emit($event)"
        (onInit)="onEditorInit($event)"
      />
    </div>
    <div class="toolbar">
      <button mat-raised-button color="primary"
              [disabled]="isExecuting"
              (click)="execute.emit()">
        Execute (F5)
      </button>
    </div>
  `,
})
export class QueryInputComponent {
  @Input() query = 'SELECT * FROM c';
  @Input() isExecuting = false;
  @Output() queryChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<void>();

  editorOptions = {
    theme: 'vs-dark',
    language: 'sql',
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'on',
  };

  private editor: any;

  onEditorInit(editor: any) {
    this.editor = editor;

    // Add keyboard shortcut for execute
    editor.addAction({
      id: 'execute-query',
      label: 'Execute Query',
      keybindings: [monaco.KeyCode.F5],
      run: () => this.execute.emit(),
    });
  }
}
```

### Electron Configuration

Monaco requires web workers. In Electron, configure the asset path:

```typescript
// In Angular index.html or main.ts
(window as any).MonacoEnvironment = {
  getWorkerUrl: function (moduleId: string, label: string) {
    return './assets/monaco/editor.worker.js';
  }
};
```

### Future: CosmosSQL Language Support

Later, we can add custom language support:

```typescript
// Register CosmosSQL language
monaco.languages.register({ id: 'cosmosql' });

// Add syntax highlighting
monaco.languages.setMonarchTokensProvider('cosmosql', {
  keywords: [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
    'ORDER', 'BY', 'ASC', 'DESC', 'TOP', 'DISTINCT',
    'VALUE', 'JOIN', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
    'ARRAY_CONTAINS', 'CONTAINS', 'STARTSWITH', 'ENDSWITH',
  ],
  // ... tokenizer rules
});

// Add autocomplete
monaco.languages.registerCompletionItemProvider('cosmosql', {
  provideCompletionItems: (model, position) => {
    // Return suggestions based on schema
  }
});
```

## Consequences

### Positive
- Professional code editing experience
- Familiar to developers using VS Code
- Extensible for future enhancements (autocomplete, validation)
- Good keyboard navigation and shortcuts

### Negative
- Larger bundle size
- More complex setup than textarea
- Need to handle worker loading in Electron

### Neutral
- Users may expect more features than we initially provide
- Need to style editor to match application theme

## References

- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [ngx-monaco-editor-v2](https://github.com/peterblazejewicz/ngx-monaco-editor-v2)
- [CosmosDB SQL Syntax](https://docs.microsoft.com/en-us/azure/cosmos-db/sql-query-getting-started)
