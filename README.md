# Inventory Management System v7.1

A **standalone, serverless** inventory management system built with functional programming principles using vanilla JavaScript, Supabase PostgreSQL, and modern web technologies.

## 🎯 Overview

This system manages both **serialized** and **bulk** inventory items, tracks transactions, handles material receiving, issuing, and provides comprehensive reporting capabilities—powered by Supabase cloud PostgreSQL database with async/await architecture.

## ✨ Features

### Core Functionality
- **Dual Inventory Types**: Manage both serialized (individual tracking) and bulk (quantity-based) items
- **Client/Market/SLOC Hierarchy**: Multi-level organizational structure
- **Crew Management**: Assign and track inventory by work crews
- **Location Tracking**: Monitor material across storage, field, and installation locations
- **Status Workflows**: Track item status through receive, issue, install, return cycles
- **Transaction Logging**: Complete audit trail of all inventory movements
- **Area Management**: Organize inventory by physical areas and locations

### Technical Features
- **Supabase Backend**: Cloud PostgreSQL database with auto-generated REST API
- **Async/Await Architecture**: Modern asynchronous patterns throughout
- **Functional Programming**: Pure functions, immutability, function composition
- **Modular Architecture**: Clean separation of concerns with async query builders
- **Import/Export**: Excel and JSON import/export capabilities
- **Real-time Ready**: Supabase provides real-time subscriptions (not yet implemented)

## 🚀 Quick Start

### Prerequisites
- Modern web browser with ES6+ support
- Supabase account (free tier: https://supabase.com)
- Local web server for development (optional)

### Setup Steps

1. **Set up Supabase**
   - See detailed instructions in **`SUPABASE_SETUP.md`**
   - Create project, run schema, configure RLS

2. **Configure credentials**
   - Edit `js/config/supabase.config.js`
   - Add your Supabase URL and anon key

3. **Launch application**
   ```bash
   # Option 1: Direct open (limited)
   open index.html
   
   # Option 2: Local server (recommended)
   python -m http.server 8000
   # Open http://localhost:8000
   ```

4. **Verify**
   - Check console for "✅ Application initialized successfully!"
   - Test creating clients, markets, inventory items

## 🏗️ Architecture

### Functional Programming Principles

The system is built using **functional programming** paradigms:

```javascript
// Pure functions
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;

// Function composition
const addThenMultiply = pipe(
    add(5),
    multiply(2)
);

// Immutability
const updateInventory = (inventory, id, updates) => 
    inventory.map(item => 
        item.id === id ? { ...item, ...updates } : item
    );
```

### Project Structure

```
INVENTORY_V7_1/
├── index.html              # Main HTML entry point
├── styles.css              # Global styles
├── ext_lib/                # External libraries
│   ├── jquery-3.6.0.min.js
│   ├── select2.min.js
│   ├── sql-wasm.js
│   ├── xlsx.full.min.js
│   └── ...
├── js/
│   ├── utils/
│   │   ├── functional.js   # Functional programming utilities
│   │   └── dom.js          # DOM manipulation utilities
│   ├── db/
│   │   ├── database.js     # SQLite database wrapper
│   │   └── queries.js      # Query builders and operations
│   ├── state/
│   │   └── store.js        # State management with pub/sub
│   ├── ui/
│   │   ├── components.js   # Reusable UI components
│   │   ├── modals.js       # Modal dialogs
│   │   └── views.js        # Page views
│   ├── services/
│   │   ├── transactions.js # Transaction logging
│   │   ├── validation.js   # Input validation
│   │   └── import-export.js # Data import/export
│   └── app.js              # Application initialization
```

## 📊 Database Schema

### Core Tables

**Inventory Hierarchy:**
- `clients` → `markets` → `slocs` → `areas`
- `crews` (assigned to markets)

**Item Management:**
- `inventory_types` (Serialized/Bulk)
- `item_types` (configurable item definitions)
- `inventory` (actual inventory items)
- `categories` (item categorization)

**Locations & Status:**
- `location_types` (Storage/Field/Install/etc.)
- `locations` (specific locations)
- `statuses` (Received/Available/Issued/Installed/etc.)

**Transactions:**
- `transactions` (complete audit trail)
- `inv_action_types` (action definitions)
- `qty_allocations` (quantity allocations to areas)

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, Safari)
- No server installation required
- No build process needed

### Installation

1. **Clone or download** the project files to a local directory
2. **Open `index.html`** in your web browser
3. **The system will automatically:**
   - Initialize the SQLite database
   - Load the schema
   - Populate with test data
   - Display the dashboard

### First Run

On first load, the system:
1. Creates in-memory SQLite database
2. Initializes tables with schema
3. Loads test data (1 client, 1 market, 1 SLOC, 3 crews, sample items)
4. Saves to browser localStorage
5. Renders the dashboard view

### Subsequent Runs

On reload:
1. Loads saved database from localStorage
2. Restores application state
3. Continues where you left off

## 💻 Usage Guide

### Navigation

Use the sidebar to navigate between views:

- **📊 Dashboard**: Overview and statistics
- **📥 Receive Serialized**: Add serialized items with unique SNs
- **📦 Receive Bulk**: Add bulk items by quantity
- **📤 Issue Material**: Issue items to crews
- **📋 View Inventory**: Browse all inventory
- **📜 Transactions**: View transaction history
- **🔧 Item Types**: Configure item types
- **👥 Crews**: Manage work crews
- **📍 Areas**: Manage areas
- **🏢 Locations**: Manage locations

### Context Selection

Always select your context first:
1. **Client**: Top-level organization
2. **Market**: Sub-organization
3. **SLOC**: Storage location

These selections filter all subsequent operations.

### Receiving Material

**Serialized Items:**
1. Navigate to "Receive Serialized"
2. Select item type
3. Enter manufacturer serial numbers (one per line, or batch count)
4. System auto-generates Tilson SNs
5. Click "Receive Items"

**Bulk Items:**
1. Navigate to "Receive Bulk"
2. Select item type
3. Enter quantity
4. Add optional notes
5. Click "Receive Items"

### Transaction Logging

Every action automatically logs a transaction including:
- Before/after state
- User information
- Timestamp
- Session ID
- Affected quantities
- Location changes
- Status changes

## 🛠️ Development

### Functional Utilities

The `functional.js` module provides:

```javascript
// Composition
compose, pipe, curry, partial

// Array operations
map, filter, reduce, find, sortBy, groupBy

// Object operations
prop, assoc, merge, pick, omit, evolve

// Logic
and, or, ifElse, when, unless, cond

// Type checking
isNull, isArray, isString, isNumber

// Async
asyncPipe, asyncMap, tryCatch

// Monads
Maybe, Result
```

### State Management

Centralized state with pub/sub pattern:

```javascript
// Get state
const state = Store.getState();

// Update state
Store.actions.setView('dashboard');
Store.actions.setInventory(items);

// Subscribe to changes
Store.subscribe((state, changes) => {
    console.log('State changed:', changes);
});

// Computed state
const filtered = Store.computed.getFilteredInventory({ status: 2 });
```

### Database Operations

```javascript
// Query
const result = Database.query('SELECT * FROM inventory WHERE id = ?', [1]);

// Execute
const result = Database.execute('UPDATE inventory SET quantity = ? WHERE id = ?', [10, 1]);

// Transaction
const result = Database.transaction([
    { sql: 'INSERT INTO ...', params: [...] },
    { sql: 'UPDATE ...', params: [...] }
]);
```

### UI Components

Reusable component library:

```javascript
// Toast notification
Components.showToast('Success!', 'success');

// Data table
Components.dataTable({
    columns: [...],
    data: [...],
    actions: [...]
});

// Modal
Modals.alert('Message', 'Title');
Modals.confirm('Are you sure?', 'Confirm', onConfirm);

// Form modal
Modals.form({
    title: 'Add Item',
    fields: [...],
    onSubmit: (data) => { ... }
});
```

## 📦 Data Import/Export

### Export Formats

- **Excel**: Inventory, transactions, and item types
- **JSON**: Complete database export
- **Database File**: Binary SQLite backup

### Import Formats

- **Excel**: Bulk import from templates
- **JSON**: Database restore
- **Database File**: Direct database restore

### Export Functions

```javascript
// Export inventory to Excel
ImportExportService.exportInventoryToExcel();

// Export database to JSON
ImportExportService.exportDatabaseToJSON();

// Backup database
ImportExportService.backupDatabase();

// Download template
ImportExportService.exportTemplate('inventory');
```

## 🔒 Data Persistence

### localStorage

- Database saved as base64-encoded binary
- Application state saved as JSON
- Auto-save every 5 minutes
- Manual save on context changes

### Export/Backup

- Export database before major changes
- Regular backups recommended
- Import/restore available from backup files

## 🧪 Testing

The system includes test data:

- **1 Client**: "Test Client"
- **1 Market**: "Test Market"
- **1 SLOC**: "Test SLOC"
- **3 Crews**: Test Crew, Crew 2, Crew 424
- **2 Areas**: Test area 1, Test area 2
- **5 Item Types**: Mix of serialized and bulk
- **Sample Statuses**: Received, Available, Issued, Installed, etc.

## 🔧 Configuration

Configuration stored in `config` table:

```javascript
// Get config
const value = Queries.getConfig('schema_version');

// Set config
Queries.setConfig('last_tilson_sn', '0005');
```

### Available Config Keys

- `schema_version`: Database schema version
- `last_tilson_sn`: Last generated Tilson serial number
- `currentTilsonSN`: Current serial counter
- `receiptNumber`: Receipt numbering counter
- `inventory_sort`: Inventory sort preferences
- `areaColors`: Color coding for areas

## 🤝 Contributing

This is a standalone project. To extend:

1. Add new views in `js/ui/views.js`
2. Create new components in `js/ui/components.js`
3. Add queries in `js/db/queries.js`
4. Extend functional utilities in `js/utils/functional.js`
5. Follow functional programming principles

## 📝 License

Internal use only.

## 🆘 Support

For issues or questions:
1. Check browser console for errors
2. Verify all external libraries loaded
3. Clear localStorage and reload for fresh start
4. Export database before troubleshooting

## 🔄 Version History

### v7.1 (Current)
- Rebuilt from ground up with functional programming
- Serverless architecture with SQL.js
- Modern UI with component-based design
- Enhanced transaction logging
- Import/export capabilities
- Auto-save functionality

---

**Built with** ❤️ **using functional programming principles**
