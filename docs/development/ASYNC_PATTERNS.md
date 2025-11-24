# Async Patterns Quick Reference

This guide provides quick examples of async/await patterns used throughout the Inventory Management System.

## Table of Contents
1. [Basic Query Patterns](#basic-query-patterns)
2. [Error Handling with Result Monad](#error-handling-with-result-monad)
3. [Parallel Queries](#parallel-queries)
4. [Sequential Queries](#sequential-queries)
5. [Event Handlers](#event-handlers)
6. [View Rendering](#view-rendering)
7. [Form Submission](#form-submission)
8. [Modal Operations](#modal-operations)
9. [Common Mistakes](#common-mistakes)

---

## Basic Query Patterns

### Simple Select
```javascript
// Get all records
const result = await Queries.getAllClients();

if (result.isOk) {
    console.log('Clients:', result.value);
} else {
    console.error('Error:', result.error);
}
```

### Select with Filter
```javascript
// Get records matching criteria
const markets = await Queries.getMarketsByClient(clientId);
const inventory = await Queries.getInventoryBySloc(slocId);
```

### Insert Data
```javascript
const newClient = {
    name: 'Acme Corp',
    address: '123 Main St'
};

const result = await Queries.insert('clients', newClient);

if (result.isOk) {
    console.log('Created client:', result.value);
}
```

### Update Data
```javascript
const updates = { status_id: 2 };
const result = await Queries.update('inventory', updates, { id: 123 });
```

### Delete Data
```javascript
const result = await Queries.deleteById('crews', 5);
```

---

## Error Handling with Result Monad

### Basic Check
```javascript
const result = await Queries.getAllClients();

if (result.isOk) {
    // Success path
    processClients(result.value);
} else {
    // Error path
    showError(result.error);
}
```

### With Default Value
```javascript
const clients = await Queries.getAllClients();
const clientList = clients.isOk ? clients.value : [];
```

### Chaining Operations
```javascript
const result = await Queries.getAllClients()
    .then(clients => clients.map(transformClient))
    .then(transformedClients => filterClients(transformedClients));
```

### Try-Catch for Async Errors
```javascript
try {
    const clients = await Queries.getAllClients();
    
    if (!clients.isOk) {
        throw clients.error;
    }
    
    // Process clients.value
} catch (error) {
    console.error('Failed to load clients:', error);
    Components.showToast('Error loading clients', 'error');
}
```

---

## Parallel Queries

### Load Multiple Resources at Once
```javascript
// Execute all queries simultaneously
const [clients, markets, slocs, inventory] = await Promise.all([
    Queries.getAllClients(),
    Queries.getAllMarkets(),
    Queries.getAllSlocs(),
    Queries.getAllInventory()
]);

// Check each result
if (clients.isOk && markets.isOk && slocs.isOk) {
    // All succeeded
    renderData({
        clients: clients.value,
        markets: markets.value,
        slocs: slocs.value
    });
}
```

### Parallel with Error Handling
```javascript
try {
    const results = await Promise.all([
        Queries.getAllClients(),
        Queries.getAllMarkets(),
        Queries.getAllSlocs()
    ]);
    
    // Extract successful results
    const [clients, markets, slocs] = results.map(r => 
        r.isOk ? r.value : []
    );
    
    renderData({ clients, markets, slocs });
} catch (error) {
    console.error('Failed to load data:', error);
}
```

### Promise.allSettled (Handle Partial Failures)
```javascript
const results = await Promise.allSettled([
    Queries.getAllClients(),
    Queries.getAllMarkets(),
    Queries.getAllSlocs()
]);

results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
        console.log(`Query ${index} succeeded:`, result.value);
    } else {
        console.error(`Query ${index} failed:`, result.reason);
    }
});
```

---

## Sequential Queries

### Dependent Queries
```javascript
// Step 1: Get client
const clientResult = await Queries.getAllClients();

if (clientResult.isOk && clientResult.value.length > 0) {
    const firstClient = clientResult.value[0];
    
    // Step 2: Get markets for that client
    const marketsResult = await Queries.getMarketsByClient(firstClient.id);
    
    if (marketsResult.isOk && marketsResult.value.length > 0) {
        const firstMarket = marketsResult.value[0];
        
        // Step 3: Get SLOCs for that market
        const slocsResult = await Queries.getSlocsByMarket(firstMarket.id);
        
        // Use the data
        renderHierarchy(firstClient, firstMarket, slocsResult.value);
    }
}
```

### Chain of Operations
```javascript
async function createFullInventoryItem() {
    // 1. Create item type
    const itemType = await Queries.insert('item_types', {
        name: 'New Item',
        market_id: 1,
        // ...
    });
    
    if (!itemType.isOk) return itemType; // Early return on error
    
    // 2. Create inventory record
    const inventory = await Queries.insert('inventory', {
        item_type_id: itemType.value.id,
        quantity: 100,
        // ...
    });
    
    if (!inventory.isOk) return inventory;
    
    // 3. Log transaction
    const transaction = await Queries.insert('transactions', {
        inventory_id: inventory.value.id,
        action: 'created',
        // ...
    });
    
    return transaction;
}
```

---

## Event Handlers

### Button Click
```javascript
const saveButton = byId('saveButton');

on('click', async () => {
    try {
        // Show loading state
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        
        // Perform async operation
        const result = await Queries.insert('clients', {
            name: byId('clientName').value
        });
        
        if (result.isOk) {
            Components.showToast('Saved successfully!', 'success');
            closeModal();
        } else {
            Components.showToast('Save failed', 'error');
        }
    } catch (error) {
        console.error('Save error:', error);
        Components.showToast('An error occurred', 'error');
    } finally {
        // Restore button state
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
    }
}, saveButton);
```

### Form Submit
```javascript
const form = byId('clientForm');

on('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission
    
    const formData = {
        name: byId('clientName').value,
        address: byId('clientAddress').value
    };
    
    const result = await Queries.insert('clients', formData);
    
    if (result.isOk) {
        form.reset();
        Components.showToast('Client created', 'success');
    }
}, form);
```

### Select Change
```javascript
const marketSelect = byId('marketSelect');

on('change', async (e) => {
    const marketId = parseInt(e.target.value);
    
    // Load dependent data
    const slocs = await Queries.getSlocsByMarket(marketId);
    
    if (slocs.isOk) {
        // Update UI with new data
        populateSlocSelect(slocs.value);
    }
}, marketSelect);
```

---

## View Rendering

### Simple View
```javascript
const Views = {
    renderClients: async () => {
        const container = byId('mainContent');
        
        // Show loading
        container.innerHTML = '<div class="loading">Loading...</div>';
        
        // Fetch data
        const clients = await Queries.getAllClients();
        
        if (!clients.isOk) {
            container.innerHTML = '<div class="error">Failed to load clients</div>';
            return;
        }
        
        // Render data
        const clientList = clients.value.map(client => 
            `<div class="client-card">
                <h3>${client.name}</h3>
                <p>${client.address || 'No address'}</p>
            </div>`
        ).join('');
        
        container.innerHTML = clientList;
    }
};
```

### Complex View with Multiple Queries
```javascript
Views.renderDashboard = async () => {
    const container = byId('mainContent');
    container.innerHTML = '<div class="loading">Loading dashboard...</div>';
    
    try {
        // Load all data in parallel
        const [clients, markets, inventory, transactions] = await Promise.all([
            Queries.getAllClients(),
            Queries.getAllMarkets(),
            Queries.getAllInventory(),
            Queries.getAllTransactions(50)
        ]);
        
        // Check for errors
        if (!clients.isOk || !markets.isOk || !inventory.isOk) {
            throw new Error('Failed to load dashboard data');
        }
        
        // Build dashboard HTML
        const html = `
            <div class="dashboard">
                <div class="stats">
                    <div class="stat-card">
                        <h3>Clients</h3>
                        <p class="stat-number">${clients.value.length}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Markets</h3>
                        <p class="stat-number">${markets.value.length}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Inventory Items</h3>
                        <p class="stat-number">${inventory.value.length}</p>
                    </div>
                </div>
                <div class="recent-transactions">
                    <h3>Recent Transactions</h3>
                    ${renderTransactionList(transactions.value || [])}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Dashboard error:', error);
        container.innerHTML = '<div class="error">Failed to load dashboard</div>';
    }
};
```

---

## Form Submission

### Create New Record
```javascript
async function submitNewClient(formData) {
    // Validate
    if (!formData.name) {
        Components.showToast('Name is required', 'error');
        return;
    }
    
    // Insert
    const result = await Queries.insert('clients', formData);
    
    if (result.isOk) {
        // Update UI
        Components.showToast('Client created successfully', 'success');
        
        // Reload client list
        await Views.renderClients();
        
        // Close modal if open
        Modals.close();
    } else {
        Components.showToast('Failed to create client', 'error');
        console.error(result.error);
    }
}
```

### Update Existing Record
```javascript
async function updateClient(clientId, updates) {
    const result = await Queries.update('clients', updates, { id: clientId });
    
    if (result.isOk) {
        Components.showToast('Client updated', 'success');
        
        // Refresh the current view
        await Views.renderClients();
    } else {
        Components.showToast('Update failed', 'error');
    }
}
```

### Delete Record with Confirmation
```javascript
async function deleteClient(clientId) {
    if (!confirm('Are you sure you want to delete this client?')) {
        return;
    }
    
    const result = await Queries.deleteById('clients', clientId);
    
    if (result.isOk) {
        Components.showToast('Client deleted', 'success');
        await Views.renderClients();
    } else {
        Components.showToast('Delete failed', 'error');
    }
}
```

---

## Modal Operations

### Open Modal with Async Data
```javascript
Modals.openClientEdit = async (clientId) => {
    // Show modal skeleton
    Modals.open('editClientModal');
    
    // Show loading in modal
    byId('modalContent').innerHTML = '<div class="loading">Loading...</div>';
    
    // Fetch client data
    const result = await Queries.findById('clients', clientId);
    
    if (result.isOk) {
        // Populate form with data
        byId('clientName').value = result.value.name || '';
        byId('clientAddress').value = result.value.address || '';
        byId('clientId').value = result.value.id;
    } else {
        Components.showToast('Failed to load client', 'error');
        Modals.close();
    }
};
```

### Save Modal Data
```javascript
Modals.saveClient = async () => {
    const clientId = byId('clientId').value;
    const formData = {
        name: byId('clientName').value,
        address: byId('clientAddress').value
    };
    
    let result;
    if (clientId) {
        // Update existing
        result = await Queries.update('clients', formData, { id: clientId });
    } else {
        // Create new
        result = await Queries.insert('clients', formData);
    }
    
    if (result.isOk) {
        Components.showToast('Saved successfully', 'success');
        Modals.close();
        await Views.renderClients(); // Refresh view
    } else {
        Components.showToast('Save failed', 'error');
    }
};
```

---

## Common Mistakes

### ❌ Mistake 1: Forgetting await
```javascript
// ❌ WRONG - Returns a Promise, not data
const clients = Queries.getAllClients();
console.log(clients); // Promise { <pending> }

// ✅ CORRECT
const clients = await Queries.getAllClients();
console.log(clients); // Result { isOk: true, value: [...] }
```

### ❌ Mistake 2: Not handling errors
```javascript
// ❌ WRONG - Assumes success
const clients = await Queries.getAllClients();
clients.value.forEach(c => console.log(c)); // Crashes if error

// ✅ CORRECT
const clients = await Queries.getAllClients();
if (clients.isOk) {
    clients.value.forEach(c => console.log(c));
} else {
    console.error('Error:', clients.error);
}
```

### ❌ Mistake 3: Not making function async
```javascript
// ❌ WRONG - Can't use await in non-async function
function loadData() {
    const clients = await Queries.getAllClients(); // Error!
}

// ✅ CORRECT
async function loadData() {
    const clients = await Queries.getAllClients();
}
```

### ❌ Mistake 4: Sequential when parallel would work
```javascript
// ❌ SLOW - Runs sequentially (3 seconds total if each takes 1 second)
const clients = await Queries.getAllClients();
const markets = await Queries.getAllMarkets();
const slocs = await Queries.getAllSlocs();

// ✅ FAST - Runs in parallel (1 second total)
const [clients, markets, slocs] = await Promise.all([
    Queries.getAllClients(),
    Queries.getAllMarkets(),
    Queries.getAllSlocs()
]);
```

### ❌ Mistake 5: Not using try-catch
```javascript
// ❌ RISKY - Unhandled promise rejection
async function loadData() {
    const result = await Queries.getAllClients();
    // If this throws, app crashes
}

// ✅ SAFE - Errors are caught
async function loadData() {
    try {
        const result = await Queries.getAllClients();
    } catch (error) {
        console.error('Load failed:', error);
        showErrorMessage();
    }
}
```

### ❌ Mistake 6: Forgetting to return in event handlers
```javascript
// ❌ WRONG - Event handler not marked async
on('click', () => {
    const result = await Queries.getAllClients(); // Error!
}, button);

// ✅ CORRECT
on('click', async () => {
    const result = await Queries.getAllClients();
}, button);
```

---

## Performance Tips

### 1. Use Parallel Queries
```javascript
// Load related data together
const [client, markets] = await Promise.all([
    Queries.findById('clients', clientId),
    Queries.getMarketsByClient(clientId)
]);
```

### 2. Cache Frequently Used Data
```javascript
// Store in app state to avoid repeated queries
if (!Store.get('allStatuses')) {
    const statuses = await Queries.getAllStatuses();
    Store.setState({ allStatuses: statuses.value });
}
```

### 3. Use Filters to Reduce Data Transfer
```javascript
// Only get what you need
const activeInventory = await Database.select('inventory', {
    filter: { status_id: 'eq.2' },
    select: 'id,item_type_id,quantity' // Only needed columns
});
```

### 4. Implement Pagination
```javascript
async function loadInventoryPage(page = 0, pageSize = 50) {
    const result = await Database.select('inventory', {
        range: { from: page * pageSize, to: (page + 1) * pageSize - 1 }
    });
    return result;
}
```

---

## Debugging Tips

### 1. Log Query Results
```javascript
const result = await Queries.getAllClients();
console.log('Query result:', result);
console.log('Is OK?', result.isOk);
console.log('Data:', result.value);
console.log('Error:', result.error);
```

### 2. Check Network Tab
- Open Browser DevTools → Network
- Look for requests to `supabase.co`
- Check response status and data

### 3. Use Supabase Dashboard
- Go to Supabase → Logs → API
- See all queries being executed
- Check for errors or slow queries

### 4. Add Timing
```javascript
console.time('loadClients');
const clients = await Queries.getAllClients();
console.timeEnd('loadClients'); // Shows: loadClients: 234ms
```

---

## Summary

**Key Principles:**
1. Always use `await` with async functions
2. Always check `result.isOk` before using `result.value`
3. Use `async` keyword on functions that call `await`
4. Use `Promise.all()` for parallel operations
5. Wrap in try-catch for robust error handling
6. Make event handlers async when they call async functions

**Common Pattern:**
```javascript
async function standardAsyncPattern() {
    try {
        const result = await Queries.getSomeData();
        
        if (result.isOk) {
            // Success path
            processData(result.value);
        } else {
            // Error path
            handleError(result.error);
        }
    } catch (error) {
        // Unexpected error
        console.error('Unexpected error:', error);
    }
}
```
