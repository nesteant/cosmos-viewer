# Cosmos DB Viewer

A desktop application for browsing and managing Azure Cosmos DB NoSQL databases, similar to DataGrip or DBeaver but designed specifically for Cosmos DB.

## Features

- **Connection Management** - Save multiple Cosmos DB connections with secure credential storage
- **Database Explorer** - Browse databases and containers in a tree view
- **Query Editor** - Write and execute CosmosSQL queries with Monaco Editor
- **Results Table** - View query results in a spreadsheet-like grid
- **Inline Editing** - Edit cell values directly in the table (Excel-like)
- **Change Tracking** - Modified cells highlighted, batch save/discard
- **CRUD Operations** - Create, update, delete documents
- **Import/Export** - JSON and CSV format support

## Screenshots

*Coming soon*

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
# Build for macOS
npm run package:mac

# Build for Windows
npm run package:win

# Build for Linux
npm run package:linux
```

## Usage

### 1. Add a Connection

1. Launch the app - you'll see the Connections page
2. Click **"New Connection"**
3. Enter your connection details:
   - **Name** - A friendly name for this connection
   - **Endpoint** - Your Cosmos DB endpoint URL (e.g., `https://your-account.documents.azure.com:443/`)
   - **Key** - Your primary or secondary key
   - **Default Database** (optional) - Pre-select a database
4. Click **"Test Connection"** to verify
5. Click **"Save"** to store the connection

### 2. Browse Databases

1. Click **"Connect"** on a connection card
2. The Explorer view opens with your databases in the left sidebar
3. Click a database to expand and see its containers
4. Click a container to select it

### 3. Query Data

1. Select a container from the tree
2. A default query `SELECT * FROM c` is executed automatically
3. Modify the query in the editor and click **"Execute"** (or press `Cmd+Enter`)
4. Results appear in the table below
5. Click **"Load More"** for paginated results

### 4. Edit Documents

1. **Double-click** any cell to edit its value
2. Modified cells are highlighted in orange
3. Use the row menu (⋮) for more options:
   - Save Changes
   - Discard Changes
   - View/Edit JSON
   - Duplicate
   - Delete
4. Click **"Save All"** to commit all changes at once

### 5. Create Documents

1. Click **"New"** in the toolbar
2. Edit the JSON template (includes partition key field)
3. Click **"Create"**

### 6. Import/Export

**Export:**
1. Click the download icon in the toolbar
2. Choose **"Export as JSON"** or **"Export as CSV"**
3. File downloads to your default location

**Import:**
1. Click the upload icon in the toolbar
2. Choose **"Import JSON"** or **"Import CSV"**
3. Select your file
4. Confirm the import

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Execute Query | `Cmd+Enter` |
| Cancel Edit | `Escape` |
| Confirm Edit | `Enter` |

## Tech Stack

- **Frontend**: Angular 19, Angular Material
- **State Management**: NgRx SignalStore
- **Desktop**: Electron
- **Query Editor**: Monaco Editor
- **Database**: Azure Cosmos DB SDK (@azure/cosmos)
- **Storage**: electron-store (encrypted)

## Project Structure

```
cosmos-viewer/
├── electron/                 # Electron main process
│   ├── main.ts              # App entry point
│   ├── preload.ts           # Context bridge API
│   └── services/            # Cosmos & storage services
├── src/
│   ├── app/
│   │   ├── core/            # Models, services, utilities
│   │   ├── shared/          # Shared components
│   │   └── features/
│   │       ├── connections/ # Connection management
│   │       └── explorer/    # Database explorer & query
│   └── styles.scss          # Global styles
├── docs/
│   └── ROADMAP.md           # Future improvements
└── package.json
```

## Development

```bash
# Run Angular only (browser)
npm run start

# Run with Electron
npm run electron:start

# Build Angular
npm run build

# Build Electron
npm run electron:build
```

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for planned features including:
- Data type formatters (dates, GUIDs, etc.)
- Resizable panels
- Query tabs and history
- Keyboard navigation
- And more...

## License

MIT
