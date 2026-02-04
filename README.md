# Cosmos DB Viewer

A powerful desktop application for browsing and managing Azure Cosmos DB and MongoDB databases. Built with Electron and Angular, it provides a modern, feature-rich interface similar to DataGrip or DBeaver but designed specifically for document databases.

## Features

### Multi-Provider Support
- **Azure Cosmos DB (SQL API)** - Full support for CosmosSQL queries
- **MongoDB** - Native MongoDB support with aggregation pipeline builder
- Extensible provider architecture for future database support

### Connection Management
- Save and manage multiple database connections with secure credential storage
- Visual connection cards with provider badges
- Drag-and-drop connection reordering
- Duplicate existing connections
- Test connection before saving

### Database Explorer
- Tree view navigation for databases and containers/collections
- Quick container selection
- Collapsible sidebar with resizable panels

### Query Editor
- **Monaco Editor** - VS Code's powerful editor with syntax highlighting
- **Query Autocomplete** - Field names from schema inference, keywords, and functions
- **Multiple Query Tabs** - Work on multiple queries per container simultaneously
- **Query Persistence** - Queries saved per tab across sessions
- **SQL Formatter** - Format queries with comment preservation (Cosmos SQL)
- **Query Analyzer** - Execution plan, optimization hints, index metrics (Ctrl+Shift+A)

### MongoDB Aggregation Pipeline
- **Visual Pipeline Builder** - Build aggregation pipelines visually
- **Stage-by-Stage Execution** - Run pipeline incrementally to debug
- **Stage Management** - Add, remove, reorder, and edit stages visually
- **Real-time Sync** - Visual changes sync back to text editor

### Results Table
- **Excel-like Interface** - Spreadsheet-style grid for viewing query results
- **Inline Editing** - Double-click to edit cell values with type selection
- **Change Tracking** - Modified cells highlighted, batch save/discard
- **Data Type Formatters** - GUID, DateTime, Numbers, Booleans, URLs, Objects, Arrays displayed intelligently
- **Column Management**:
  - Drag-and-drop column reordering
  - Hide/show columns with column picker
  - Pin columns to the left
  - Resize columns by dragging borders
  - Save column presets per container
- **Sorting & Filtering**:
  - Click column headers to sort (ascending/descending/none)
  - Global search across all columns
  - Per-column filter inputs with match highlighting
- **Selection & Clipboard**:
  - Arrow key navigation between cells
  - Excel-like area selection (mouse drag, Shift+click, Shift+arrows)
  - Copy selection to clipboard (Cmd+C) in TSV format
  - Paste values (Cmd+V) to selected cells
  - Click row number to select entire row
  - Drag on row numbers to multi-select rows
  - Type-to-edit on selected cell
- **Context Menu** - Right-click for row actions (Save, Discard, View JSON, Duplicate, Delete)
- **Row Numbering** - Sticky row numbers column for easy reference

### Document Operations
- **CRUD Operations** - Create, read, update, delete documents
- **JSON Editor** - Full Monaco editor for complex document editing
- **Batch Operations** - Save or discard all changes at once
- **Export Selection** - Export selected rows as JSON or CSV

### Import/Export
- **JSON Format** - Import/export documents as JSON
- **CSV Format** - Import/export as CSV for spreadsheet compatibility
- **Export All** - Export entire result set
- **Export Selection** - Export only selected rows

### User Experience
- **Resizable Panels** - Draggable splitters between sidebar, query editor, and results
- **JetBrains Mono Font** - Developer-friendly monospace font (bundled, no CDN)
- **Dark Theme** - Easy on the eyes for extended use
- **Keyboard Shortcuts** - Efficient navigation and actions

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Execute Query | `Cmd+Enter` / `Ctrl+Enter` |
| Query Analyzer | `Ctrl+Shift+A` |
| Cancel Edit | `Escape` |
| Confirm Edit | `Enter` |
| Navigate Cells | Arrow keys |
| Extend Selection | `Shift+Arrow` |
| Copy Selection | `Cmd+C` / `Ctrl+C` |
| Paste | `Cmd+V` / `Ctrl+V` |

## Installation

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd cosmos-viewer

# Install dependencies
npm install

# Run in development mode
npm run electron:start
```

### Build for Production

```bash
# Build for all platforms
npm run package:all

# Build for specific platform
npm run package:mac    # macOS (ARM64 + x64)
npm run package:win    # Windows (ARM64 + x64)
npm run package:linux  # Linux (ARM64 + x64)
```

## Usage

### 1. Add a Connection

1. Launch the app - you'll see the Connections page
2. Click **"New Connection"**
3. Select provider type (Cosmos DB SQL or MongoDB)
4. Enter your connection details:
   - **Name** - A friendly name for this connection
   - **Endpoint** - Your database endpoint URL
   - **Key** - Your primary or secondary key
   - **Default Database** (optional) - Pre-select a database
5. Click **"Test Connection"** to verify
6. Click **"Save"** to store the connection

### 2. Browse Databases

1. Click **"Connect"** on a connection card
2. The Explorer view opens with your databases in the left sidebar
3. Click a database to expand and see its containers/collections
4. Click a container to select it

### 3. Query Data

1. Select a container from the tree
2. A default query is executed automatically
3. Modify the query in the editor
4. Click **"Execute"** or press `Cmd+Enter`
5. Results appear in the table below
6. Click **"Load More"** for paginated results

### 4. Edit Documents

1. **Double-click** any cell to edit its value
2. Or **select a cell** and start typing
3. Modified cells are highlighted in orange
4. Use the row menu (right-click) for more options
5. Click **"Save All"** to commit all changes

### 5. Work with MongoDB Pipelines

1. Connect to a MongoDB database
2. Select a collection
3. Toggle to **"Visual"** mode in the query editor
4. Add stages using the **"+ Add Stage"** button
5. Run individual stages or the entire pipeline
6. Visual edits automatically sync to the text editor

### 6. Import/Export

**Export:**
1. Click the download icon in the toolbar
2. Choose **"Export as JSON"** or **"Export as CSV"**
3. For selected rows only, right-click and use **"Export Selection"**

**Import:**
1. Click the upload icon in the toolbar
2. Choose **"Import JSON"** or **"Import CSV"**
3. Select your file and confirm

## Tech Stack

- **Frontend**: Angular 19, Angular Material, NgRx SignalStore
- **Desktop**: Electron
- **Query Editor**: Monaco Editor (ngx-monaco-editor-v2)
- **Layout**: angular-split for resizable panels
- **Database SDKs**: @azure/cosmos, mongodb
- **Storage**: electron-store (encrypted)

## Project Structure

```
cosmos-viewer/
├── electron/                    # Electron main process
│   ├── main.ts                 # App entry point
│   ├── preload.ts              # Context bridge API
│   ├── providers/              # Database provider implementations
│   │   ├── base/              # Provider interfaces and types
│   │   ├── cosmos-sql/        # Cosmos DB SQL provider
│   │   └── mongodb/           # MongoDB provider
│   └── services/              # Storage and IPC services
├── src/
│   ├── app/
│   │   ├── core/              # Models, services, utilities
│   │   ├── shared/            # Shared components
│   │   └── features/
│   │       ├── connections/   # Connection management
│   │       └── explorer/      # Database explorer & query
│   └── styles.scss            # Global styles
├── docs/
│   └── ROADMAP.md             # Future improvements
└── package.json
```

## Development

```bash
# Run Angular only (browser - limited functionality)
npm run start

# Run with Electron (full functionality)
npm run electron:start

# Build Angular
npm run build

# Build Electron
npm run electron:build
```

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for planned features including:
- Query history and saved queries
- Command palette
- Bulk operations
- Data visualization
- And more...

## License

MIT
