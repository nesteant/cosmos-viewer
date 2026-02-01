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

---

## Priority 1: Column & Table Enhancements

### 1.1 Column Management
- **Reorder columns** via drag-and-drop
- **Hide/show columns** with column picker dropdown
- **Pin columns** left (freeze while scrolling)
- Persist column preferences per container

### 1.2 Table Sorting & Filtering
- Click column header to sort (asc/desc/none)
- Quick filter input per column
- Global search across all visible data

---

## Priority 2: Query Experience

### 2.1 Query History
- Auto-save executed queries
- Timestamp and execution stats (RU, time, rows)
- Re-run from history
- Search history

### 2.2 Saved Queries / Favorites
- Save queries with name and description
- Organize in folders
- Quick access from sidebar or command palette
- Share/export queries

### 2.3 Query Autocomplete
- Table/container names
- Field names from schema inference
- CosmosSQL keywords and functions
- Snippets (SELECT template, WHERE clauses)

### 2.4 Query Execution Plan
- Visual representation of query plan
- Index usage indicators
- Optimization suggestions

---

## Priority 3: Keyboard & Navigation

### 3.1 Keyboard Shortcuts
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

### 3.2 Command Palette
- Fuzzy search for all actions
- Recent containers
- Recent queries
- Settings access

### 3.3 Table Navigation
- Arrow keys to move between cells
- Enter to edit, Escape to cancel
- Tab to move to next cell

---

## Priority 4: Document Operations

### 4.1 Bulk Operations
- Multi-select rows (Shift+click, Cmd+click)
- Bulk delete with confirmation
- Bulk update (set field value for selected)
- Bulk export selected

### 4.2 Document Comparison
- Diff view between original and modified
- Side-by-side JSON comparison
- Highlight added/removed/changed fields

### 4.3 Clipboard Operations
- Copy cell value
- Copy row as JSON
- Copy selected rows as JSON array
- Paste JSON to create document

---

## Priority 5: Connection Enhancements

### 5.1 Connection Organization
- Connection groups/folders
- Color coding for connections
- Tags/labels

### 5.2 Authentication Methods
- Connection string import/parse
- Azure AD / Entra ID authentication
- Read-only mode toggle

---

## Priority 6: Performance & Monitoring

### 6.1 RU Tracking
- RU usage per query
- RU history chart
- Estimated RU before execution

### 6.2 Container Stats
- Document count
- Storage size
- Partition key distribution

---

## Priority 7: Import/Export Enhancements

### 7.1 Additional Formats
- Excel (.xlsx) export
- SQL INSERT statements export

### 7.2 Import Options
- Upsert mode (update if exists)
- Field mapping UI
- Preview before import

### 7.3 Schema Operations
- Generate TypeScript interfaces
- JSON Schema generation

---

## Priority 8: Advanced Features

### 8.1 Stored Procedures & Triggers
- View/list stored procedures
- Execute with parameters
- View triggers and UDFs

### 8.2 Change Feed Viewer
- Real-time change feed display
- Filter by operation type

### 8.3 Index Management
- View indexing policy
- Edit indexing policy

---

## Verification Checklist
For each feature:
1. Works with keyboard navigation
2. Handles loading/error states
3. Persists preferences where applicable
4. Performs well with 1000+ rows
