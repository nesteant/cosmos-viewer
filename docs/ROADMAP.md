# Cosmos DB Viewer - Future Improvements Roadmap

## Overview
MVP is complete. This document outlines future enhancements organized by priority and category.

---

## Priority 1: High Impact / Quick Wins

### 1.1 Data Type Formatters
Intelligent display formatting based on detected data types:
- **GUID** - Formatted with highlighting, copy button
- **DateTime/Timestamp** - Human-readable format with timezone, relative time ("2 hours ago")
- **Numbers** - Thousands separator, decimal precision
- **Booleans** - Checkbox or colored badge (green/red)
- **URLs** - Clickable links
- **Nested Objects** - Expandable preview `{3 fields...}`
- **Arrays** - Preview with count `[5 items]`, expandable

### 1.2 Resizable Layout Panels
- Draggable splitters between:
  - Sidebar (database tree) and main area
  - Query editor and results table
- Persist layout preferences
- Collapse/expand panels with buttons

### 1.3 Column Management
- **Resize columns** by dragging header borders
- **Reorder columns** via drag-and-drop
- **Hide/show columns** with column picker dropdown
- **Pin columns** left (freeze while scrolling)
- Persist column preferences per container

### 1.4 Table Sorting & Filtering
- Click column header to sort (asc/desc/none)
- Quick filter input per column
- Global search across all visible data

---

## Priority 2: Query Experience

### 2.1 Query Tabs
- Multiple query tabs per container
- Tab naming and reordering
- Close/close all functionality

### 2.2 Query History
- Auto-save executed queries
- Timestamp and execution stats (RU, time, rows)
- Re-run from history
- Search history

### 2.3 Saved Queries / Favorites
- Save queries with name and description
- Organize in folders
- Quick access from sidebar or command palette
- Share/export queries

### 2.4 Query Autocomplete
- Table/container names
- Field names from schema inference
- CosmosSQL keywords and functions
- Snippets (SELECT template, WHERE clauses)

### 2.5 Query Execution Plan
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
| Discard changes | Cmd+Z (in context) |
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
- Home/End for row start/end
- Cmd+Home/End for table start/end

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

### 4.3 Document Templates
- Create document from template
- Save document as template
- Template variables

### 4.4 Clipboard Operations
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
- Search connections

### 5.2 Authentication Methods
- Connection string import/parse
- Azure AD / Entra ID authentication
- Managed Identity support
- Read-only mode toggle

### 5.3 Connection Health
- Connection status indicator
- Auto-reconnect on failure
- Ping/test on demand

---

## Priority 6: Performance & Monitoring

### 6.1 RU Tracking
- RU usage per query
- RU history chart
- RU budget alerts
- Estimated RU before execution

### 6.2 Query Performance
- Execution time tracking
- Slow query highlighting
- Performance comparison between queries

### 6.3 Container Stats
- Document count
- Storage size
- Partition key distribution
- Index metrics

---

## Priority 7: Import/Export Enhancements

### 7.1 Additional Formats
- Excel (.xlsx) export
- SQL INSERT statements export
- Markdown table export
- XML export

### 7.2 Import Options
- Upsert mode (update if exists)
- Field mapping UI
- Preview before import
- Validation with error report

### 7.3 Schema Operations
- Export container schema
- Generate TypeScript interfaces
- JSON Schema generation

---

## Priority 8: UI/UX Polish

### 8.1 Theming
- Light/Dark mode toggle
- Custom accent colors
- High contrast mode

### 8.2 Accessibility
- Screen reader support
- Keyboard-only navigation
- Focus indicators

### 8.3 Settings Panel
- Font size adjustment
- Date format preferences
- Number format (locale)
- Default query page size
- Auto-save interval

### 8.4 Status Bar
- Connection status
- Current database/container
- Row count
- Last query RU/time

---

## Priority 9: Advanced Features

### 9.1 Stored Procedures & Triggers
- View/list stored procedures
- Execute with parameters
- Edit and save
- View triggers and UDFs

### 9.2 Change Feed Viewer
- Real-time change feed display
- Filter by operation type
- Pause/resume

### 9.3 Cross-Partition Queries
- Enable cross-partition toggle
- Partition key selector
- Fan-out warning

### 9.4 Index Management
- View indexing policy
- Edit indexing policy
- Index recommendations

---

## Implementation Notes

### Tech Considerations
- Use `angular-split` for resizable panels
- Use `ag-grid` or virtual scrolling for large datasets
- IndexedDB for local query history storage
- Web Workers for large JSON parsing

### Files to Modify
- `src/app/features/explorer/components/results-table/` - Column features, sorting
- `src/app/features/explorer/components/query-editor/` - Tabs, history
- `src/app/core/utils/` - Formatters, type detection
- `src/styles.scss` - Theming variables
- `electron/services/` - New Cosmos operations

---

## Verification Checklist
For each feature:
1. Works with keyboard navigation
2. Handles loading/error states
3. Persists preferences where applicable
4. Performs well with 1000+ rows
5. Accessible (ARIA labels, focus management)
