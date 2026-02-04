# Cosmos DB Viewer - Future Improvements Roadmap

## Overview
The application supports multiple database providers (Cosmos SQL, MongoDB) with comprehensive query editing, results table, and document management features. This document outlines remaining enhancements.

---

## Completed Features

### Core Functionality
- **Multi-Provider Support** - Abstracted provider interface supporting Cosmos SQL and MongoDB
- **Data Type Formatters** - GUID, DateTime/Timestamp, Numbers, Booleans, URLs, Objects, Arrays, null/empty indicators
- **Resizable Layout Panels** - Draggable splitters (sidebar, query editor, results)
- **Column Resizing** - Drag header borders with visible handles
- **Query Tabs** - Multiple tabs per container with close functionality
- **Import/Export** - JSON and CSV formats with selection export
- **Inline Editing** - Cell editing with type selection (string, number, boolean, null, delete)
- **Monaco Editor** - For queries and complex fields (objects, arrays, long text)
- **JetBrains Mono Font** - Local font (no CDN dependency)

### Query Editor
- **Query Autocomplete** - Field names from schema inference (nested paths), keywords, functions
- **SQL Formatter** - Format query with comment preservation
- **Query Analyzer** - Query explanation, optimization hints, index metrics with Ctrl+Shift+A
- **Query Persistence** - Queries saved per tab across refreshes/restarts
- **MongoDB Aggregation Pipeline** - Visual pipeline builder with stage-by-stage execution

### Results Table
- **Table Navigation** - Arrow keys to move between cells, Enter to edit, Escape to cancel
- **Type-to-Edit** - Start typing on selected cell to begin editing
- **Right-click Context Menu** - Row actions (Save, Discard, View JSON, Duplicate, Delete)
- **Row Numbering** - Sticky row numbers column
- **Column Highlighting** - Key (id), partition key, and system columns visually distinguished
- **Column Management** - Reorder via drag-drop, hide/show with picker, pin columns left, container presets
- **Table Sorting** - Click column header to sort (asc/desc/none cycle)
- **Table Filtering** - Global search + per-column filter inputs with highlighting
- **Area Selection** - Excel-like multi-cell selection with mouse drag, Shift+click, Shift+arrows
- **Clipboard Operations** - Copy (Cmd+C) and paste (Cmd+V) with TSV format support
- **Row Selection** - Click row number to select, drag to multi-select rows
- **Export Selection** - Export selected rows as JSON or CSV

### Connection Management
- **Connection Cards** - Visual connection management with provider badges
- **Drag-and-Drop Ordering** - Reorder connections by dragging
- **Duplicate Connection** - Clone existing connections
- **Test Connection** - Verify connection before saving

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

### 2.1 Additional Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| New document | Cmd+N |
| Save all | Cmd+Shift+S |
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
- Bulk delete with confirmation
- Bulk update (set field value for selected)

### 3.2 Document Comparison
- Diff view between original and modified
- Side-by-side JSON comparison
- Highlight added/removed/changed fields

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

## Priority 7: Advanced Query Development

### 7.1 Query Templates & Snippets
- Built-in snippet library (common patterns)
- Custom snippet creation with placeholders
- Snippet categories: aggregation, joins, filtering, pagination
- Auto-suggest snippets based on context

### 7.2 Visual Query Builder (Cosmos SQL)
- Drag-drop field selection
- Filter condition builder (AND/OR groups)
- ORDER BY, TOP, OFFSET LIMIT helpers
- Generate SQL from visual selections
- Switch between visual and SQL modes

### 7.3 Parameterized Queries
- Define query parameters with types
- Parameter value editor panel
- Save parameter sets for reuse
- Execute same query with different params

### 7.4 Query Execution Insights
- Execution plan visualization (tree view)
- Index hit/miss indicators per clause
- Cross-partition query warnings
- Partition key filter detection
- RU breakdown by operation type

### 7.5 Multi-Query Execution
- Execute multiple statements sequentially
- Transaction-like batching (where supported)
- Results tabs per statement
- Aggregate RU tracking across statements

---

## Priority 8: Data Analysis & Profiling

### 8.1 Data Profiling
- Column statistics (min, max, avg, count, distinct)
- Null/empty value percentage per field
- Data type distribution per column
- Value frequency analysis (top N values)
- Automatic anomaly detection (outliers)

### 8.2 Schema Analysis
- Infer complete schema from sample documents
- Field presence percentage (sparse fields)
- Nested object depth analysis
- Schema evolution tracking (field changes over time)
- Schema comparison between containers

### 8.3 Aggregation Helpers
- Pre-built aggregation templates (GROUP BY patterns)
- Running totals, moving averages
- Date/time bucketing (hourly, daily, monthly)
- Percentile calculations
- Pivot table generation

### 8.4 Data Visualization
- Quick charts from query results (bar, line, pie)
- Time-series visualization for temporal data
- Partition distribution heatmap
- Export charts as images

### 8.5 Cross-Container Analysis
- Query across multiple containers
- Join results from different containers (client-side)
- Compare document counts/schemas
- Data lineage visualization

---

## Priority 9: Production Operations

### 9.1 Partition Key Analysis
- Partition key value distribution
- Hot partition detection (skewed data)
- Partition size estimation
- Recommended partition key suggestions
- Cross-partition query cost analysis

### 9.2 Throughput Management
- View current RU/s settings
- Autoscale vs manual throughput info
- RU consumption trends over time
- Throttling event indicators
- Cost estimation calculator

### 9.3 Stored Procedures & Server-Side
- View/edit stored procedures with syntax highlighting
- Execute stored procedures with parameters
- View triggers (pre/post) and UDFs
- Debug output capture
- Performance profiling for sprocs

### 9.4 Change Feed Operations
- Real-time change feed viewer
- Filter by operation type (create, update, delete)
- Change feed position tracking
- Export changes to file
- Replay changes to another container

### 9.5 Index Management
- View indexing policy (visual tree)
- Edit indexing policy with validation
- Index utilization statistics
- Composite index recommendations
- Spatial/vector index configuration

### 9.6 Backup & Migration
- Export container to JSON/JSONL files
- Import with conflict resolution options
- Point-in-time restore helpers
- Cross-region copy utilities
- Data anonymization during export

---

## Priority 10: Developer Productivity

### 10.1 Code Generation
- Generate SDK code (C#, TypeScript, Python, Java)
- REST API curl/fetch snippets
- ARM/Bicep template generation
- Connection string builders

### 10.2 Mock Data Generation
- Generate sample documents from schema
- Faker-like data for testing
- Bulk insert generated data
- Customizable generation rules

### 10.3 Query Comparison
- Compare two query results side-by-side
- Before/after change analysis
- Performance comparison (RU, time)
- Diff highlighting for result sets

### 10.4 Documentation Helpers
- Generate markdown docs from schema
- API documentation templates
- Query library documentation export
- Container metadata export

### 10.5 Testing & Validation
- Query assertion checks (expected row count, values)
- Data validation rules per container
- Regression testing for queries
- Performance baseline tracking

---

## Priority 11: Collaboration & Sharing

### 11.1 Query Sharing
- Export query with context (container, params)
- Import shared query files
- Team query library (local file-based)
- Query versioning

### 11.2 Session Export
- Export full session (queries, results, notes)
- Reproducible analysis reports
- Share troubleshooting sessions

---

## Verification Checklist
For each feature:
1. Works with keyboard navigation
2. Handles loading/error states
3. Persists preferences where applicable
4. Performs well with 1000+ rows
