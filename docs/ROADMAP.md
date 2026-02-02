# Cosmos DB Viewer - Future Improvements Roadmap

## Overview
MVP is complete with data formatters, resizable panels, column resizing, query tabs, and import/export. This document outlines remaining enhancements.

---

## Completed Features

- ✅ **Data Type Formatters** - GUID, DateTime/Timestamp, Numbers, Booleans, URLs, Objects, Arrays, null/empty indicators
- ✅ **Resizable Layout Panels** - Draggable splitters (sidebar, query editor, results)
- ✅ **Column Resizing** - Drag header borders with visible handles
- ✅ **Query Tabs** - Multiple tabs per container with close functionality
- ✅ **Import/Export** - JSON and CSV formats
- ✅ **Inline Editing** - Cell editing with type selection (string, number, boolean, null, delete)
- ✅ **Monaco Editor** - For complex fields (objects, arrays, long text)
- ✅ **Query Autocomplete** - Field names from schema inference (nested paths), CosmosSQL keywords, functions, lowercase literals
- ✅ **Table Navigation** - Arrow keys to move between cells, Enter to edit, Escape to cancel/clear focus
- ✅ **Right-click Context Menu** - Row actions (Save, Discard, View JSON, Duplicate, Delete)
- ✅ **Row Numbering** - Sticky row numbers column
- ✅ **Query Persistence** - Queries saved per tab across refreshes/restarts
- ✅ **SQL Formatter** - Format query with comment preservation
- ✅ **JetBrains Mono Font** - Local font (no CDN dependency)
- ✅ **Column Highlighting** - Key (id), partition key, and system columns visually distinguished
- ✅ **Query Analyzer** - Query explanation, optimization hints, index metrics with Ctrl+Shift+A
- ✅ **Column Management** - Reorder via drag-drop, hide/show with picker, pin columns left, container presets
- ✅ **Table Sorting** - Click column header to sort (asc/desc/none cycle)
- ✅ **Table Filtering** - Global search + per-column filter inputs with highlighting

---

## Priority 1: Query Experience

### 1.1 Query History
- Auto-save executed queries
- Timestamp and execution stats (RU, time, rows)
- Re-run from history
- Search history

### 1.2 Saved Queries / Favorites
- Save queries with name and description
- Organize in folders
- Quick access from sidebar or command palette
- Share/export queries

---

## Priority 2: Keyboard & Navigation

### 2.1 Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Execute query | Cmd+Enter |
| New document | Cmd+N |
| Save changes | Cmd+S |
| Save all | Cmd+Shift+S |
| Find in results | Cmd+F |
| Command palette | Cmd+P |
| Close tab | Cmd+W |
| Toggle sidebar | Cmd+B |

### 2.2 Command Palette
- Fuzzy search for all actions
- Recent containers
- Recent queries
- Settings access

---

## Priority 3: Document Operations

### 3.1 Bulk Operations
- Multi-select rows (Shift+click, Cmd+click)
- Bulk delete with confirmation
- Bulk update (set field value for selected)
- Bulk export selected

### 3.2 Document Comparison
- Diff view between original and modified
- Side-by-side JSON comparison
- Highlight added/removed/changed fields

### 3.3 Clipboard Operations
- Copy cell value
- Copy row as JSON
- Copy selected rows as JSON array
- Paste JSON to create document

---

## Priority 4: Connection Enhancements

### 4.1 Connection Organization
- Connection groups/folders
- Color coding for connections
- Tags/labels

### 4.2 Authentication Methods
- Connection string import/parse
- Azure AD / Entra ID authentication
- Read-only mode toggle

---

## Priority 5: Performance & Monitoring

### 5.1 RU Tracking
- RU usage per query
- RU history chart
- Estimated RU before execution

### 5.2 Container Stats
- Document count
- Storage size
- Partition key distribution

---

## Priority 6: Import/Export Enhancements

### 6.1 Additional Formats
- Excel (.xlsx) export
- SQL INSERT statements export

### 6.2 Import Options
- Upsert mode (update if exists)
- Field mapping UI
- Preview before import

### 6.3 Schema Operations
- Generate TypeScript interfaces
- JSON Schema generation

---

## Priority 7: Advanced Features

### 7.1 Stored Procedures & Triggers
- View/list stored procedures
- Execute with parameters
- View triggers and UDFs

### 7.2 Change Feed Viewer
- Real-time change feed display
- Filter by operation type

### 7.3 Index Management
- View indexing policy
- Edit indexing policy

---

## Verification Checklist
For each feature:
1. Works with keyboard navigation
2. Handles loading/error states
3. Persists preferences where applicable
4. Performs well with 1000+ rows
