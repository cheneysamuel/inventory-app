/**
 * Hierarchy CRUD Operations
 * Client, Market, SLOC, and Area inline editing and management
 * Extracted from views.js
 */

(function() {
    "use strict";

    // ========================================
    // HIERARCHY CRUD
    // ========================================

async function saveClientInlineEdit(row, clientId, editCells, originalHTML) {
    try {
        const updatedClient = {
            name: editCells[0].value.trim(),
            address: editCells[1].value.trim() || null,
            updated_at: getLocalTimestamp()
        };
        
        if (!updatedClient.name) {
            Components.showToast('Name is required', 'error');
            editCells[0].focus();
            return;
        }
        
        const result = await DB.update('clients', clientId, updatedClient);
        
        if (!result.isOk) {
            Components.showToast('Error updating client', 'error');
            return;
        }
        
        await refreshCachedTable('clients');
        
        Components.showToast('Client updated successfully', 'success');
        
        const addBtn = byId('add-client-btn');
        if (addBtn) addBtn.disabled = false;
        
        Views.render('manage-areas');
        
    } catch (error) {
        console.error('Error updating client:', error);
        Components.showToast('Error updating client', 'error');
    }
}

async function deleteClientRecord(client) {
    if (client.useCount > 0) {
        Components.showToast(
            `Cannot delete client "${client.name}" - it has ${client.useCount} market(s) associated with it.`,
            'error'
        );
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete client "${client.name}"?`);
    if (!confirmed) return;
    
    try {
        const result = await DB.delete('clients', client.id);
        
        if (!result.isOk) {
            Components.showToast('Error deleting client', 'error');
            return;
        }
        
        await refreshCachedTable('clients');
        
        Components.showToast('Client deleted successfully', 'success');
        
        Views.render('manage-areas');
        
    } catch (error) {
        console.error('Error deleting client:', error);
        Components.showToast('Error deleting client', 'error');
    }
}

// ============ MARKETS CRUD FUNCTIONS ============

function showAddMarketRow() {
    const state = Store.getState();
    const table = byId('markets-table');
    if (!table) return Components.showToast('Table not found', 'error');
    if (document.querySelector('.market-add-row')) return Components.showToast('Already adding a new market', 'warning');
    
    const tbody = table.querySelector('tbody');
    const clients = state.clients || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', placeholder: 'Market name', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Client --']),
            ...clients.map(c => createElement('option', { value: c.id }, [c.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-']),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-'])
    ];
    
    const addRow = createElement('tr', { className: 'market-row hierarchy-row market-add-row editing' }, editCells.map(cell => createElement('td', {}, [cell])));
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => { addRow.remove(); actionRow.remove(); byId('add-market-btn').disabled = false; }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveNewMarket(editCells, addRow, actionRow) }, ['Create Market'])
        ])
    ]);
    
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    byId('add-market-btn').disabled = true;
    editCells[0].focus();
}

async function saveNewMarket(editCells, addRow, actionRow) {
    try {
        const newMarket = {
            name: editCells[0].value.trim(),
            client_id: parseInt(editCells[1].value) || null,
            created_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp()
        };
        
        if (!newMarket.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!newMarket.client_id) return Components.showToast('Client is required', 'error'), editCells[1].focus();
        
        const result = await DB.insert('markets', newMarket);
        if (!result.isOk) return Components.showToast('Error creating market', 'error');
        
        await refreshCachedTable('markets');
        
        // Refresh hierarchy dropdowns
        if (typeof refreshHierarchyDropdowns === 'function') {
            await refreshHierarchyDropdowns();
        }
        
        Components.showToast('Market created successfully', 'success');
        addRow.remove();
        actionRow.remove();
        Store.setState({ hierarchyTableSelection: 'markets' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error creating market:', error);
        Components.showToast('Error creating market', 'error');
    }
}

function enableMarketInlineEdit(row, market, state) {
    if (row.classList.contains('editing')) return;
    row.classList.add('editing');
    const originalHTML = row.innerHTML;
    const cells = row.querySelectorAll('td');
    const clients = state.clients || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', value: market.name || '', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Client --']),
            ...clients.map(c => createElement('option', { value: c.id, selected: c.id === market.client_id }, [c.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [String(market.useCount)]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [new Date(market.created_at).toLocaleDateString()])
    ];
    
    cells.forEach((cell, index) => { cell.innerHTML = ''; cell.appendChild(editCells[index]); });
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => {
                row.classList.remove('editing', 'selected');
                row.innerHTML = originalHTML;
                actionRow.remove();
                row.onclick = function() { handleHierarchyRowSelection(this, 'market'); };
                ['edit-market-btn', 'delete-market-btn'].forEach(id => byId(id).disabled = true);
                byId('add-market-btn').disabled = false;
            }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveMarketInlineEdit(row, market.id, editCells) }, ['Save Changes'])
        ])
    ]);
    
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    row.onclick = null;
    ['edit-market-btn', 'delete-market-btn', 'add-market-btn'].forEach(id => byId(id).disabled = true);
}

async function saveMarketInlineEdit(row, marketId, editCells) {
    try {
        const updated = { name: editCells[0].value.trim(), client_id: parseInt(editCells[1].value) || null, updated_at: getLocalTimestamp() };
        if (!updated.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!updated.client_id) return Components.showToast('Client is required', 'error'), editCells[1].focus();
        
        const result = await DB.update('markets', marketId, updated);
        if (!result.isOk) return Components.showToast('Error updating market', 'error');
        
        await refreshCachedTable('markets');
        Components.showToast('Market updated successfully', 'success');
        byId('add-market-btn').disabled = false;
        Store.setState({ hierarchyTableSelection: 'markets' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error updating market:', error);
        Components.showToast('Error updating market', 'error');
    }
}

async function deleteMarketRecord(market) {
    // Check for SLOC associations
    if (market.useCount > 0) {
        return Components.showToast(
            `Cannot delete market "${market.name}" - it has ${market.useCount} SLOC(s).`,
            'error'
        );
    }
    
    // Check for crew associations
    const crewsResult = await Queries.getCrewsByMarket(market.id);
    if (crewsResult.isOk && crewsResult.value.length > 0) {
        const crewNames = crewsResult.value.map(c => c.name).join(', ');
        return Components.showToast(
            `Cannot delete market "${market.name}" - it has ${crewsResult.value.length} crew(s): ${crewNames}`,
            'error'
        );
    }
    
    if (!confirm(`Delete market "${market.name}"?`)) return;
    
    try {
        const result = await DB.delete('markets', market.id);
        if (!result.isOk) return Components.showToast('Error deleting market', 'error');
        
        await refreshCachedTable('markets');
        Components.showToast('Market deleted successfully', 'success');
        Store.setState({ hierarchyTableSelection: 'markets' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error deleting market:', error);
        Components.showToast('Error deleting market', 'error');
    }
}

// ============ SLOCS CRUD FUNCTIONS ============

function showAddSlocRow() {
    const state = Store.getState();
    const table = byId('slocs-table');
    if (!table) return Components.showToast('Table not found', 'error');
    if (document.querySelector('.sloc-add-row')) return Components.showToast('Already adding a new SLOC', 'warning');
    
    const tbody = table.querySelector('tbody');
    const markets = state.markets || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', placeholder: 'SLOC name', style: { width: '100%' }}),
        createElement('input', { type: 'text', className: 'inline-edit-input', placeholder: 'Address (optional)', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Market --']),
            ...markets.map(m => createElement('option', { value: m.id }, [m.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-']),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-'])
    ];
    
    const addRow = createElement('tr', { className: 'sloc-row hierarchy-row sloc-add-row editing' }, editCells.map(cell => createElement('td', {}, [cell])));
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '5', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => { addRow.remove(); actionRow.remove(); byId('add-sloc-btn').disabled = false; }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveNewSloc(editCells, addRow, actionRow) }, ['Create SLOC'])
        ])
    ]);
    
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    byId('add-sloc-btn').disabled = true;
    editCells[0].focus();
}

async function saveNewSloc(editCells, addRow, actionRow) {
    try {
        const newSloc = {
            name: editCells[0].value.trim(),
            address: editCells[1].value.trim() || null,
            market_id: parseInt(editCells[2].value) || null,
            created_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp()
        };
        
        if (!newSloc.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!newSloc.market_id) return Components.showToast('Market is required', 'error'), editCells[2].focus();
        
        const result = await DB.insert('slocs', newSloc);
        if (!result.isOk) return Components.showToast('Error creating SLOC', 'error');
        
        // Refresh cached slocs in store FIRST
        await refreshCachedTable('slocs');
        
        // THEN refresh hierarchy dropdowns with updated state
        if (typeof refreshHierarchyDropdowns === 'function') {
            await refreshHierarchyDropdowns();
        }
        
        Components.showToast('SLOC created successfully', 'success');
        addRow.remove();
        actionRow.remove();
        byId('add-sloc-btn').disabled = false;
        Store.setState({ hierarchyTableSelection: 'slocs' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error creating SLOC:', error);
        Components.showToast('Error creating SLOC', 'error');
    }
}

function enableSlocInlineEdit(row, sloc, state) {
    if (row.classList.contains('editing')) return;
    row.classList.add('editing');
    const originalHTML = row.innerHTML;
    const cells = row.querySelectorAll('td');
    const markets = state.markets || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', value: sloc.name || '', style: { width: '100%' }}),
        createElement('input', { type: 'text', className: 'inline-edit-input', value: sloc.address || '', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Market --']),
            ...markets.map(m => createElement('option', { value: m.id, selected: m.id === sloc.market_id }, [m.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [String(sloc.useCount)]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [new Date(sloc.created_at).toLocaleDateString()])
    ];
    
    cells.forEach((cell, index) => { cell.innerHTML = ''; cell.appendChild(editCells[index]); });
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '5', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => {
                row.classList.remove('editing', 'selected');
                row.innerHTML = originalHTML;
                actionRow.remove();
                row.onclick = function() { handleHierarchyRowSelection(this, 'sloc'); };
                ['edit-sloc-btn', 'delete-sloc-btn'].forEach(id => byId(id).disabled = true);
                byId('add-sloc-btn').disabled = false;
            }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveSlocInlineEdit(row, sloc.id, editCells) }, ['Save Changes'])
        ])
    ]);
    
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    row.onclick = null;
    ['edit-sloc-btn', 'delete-sloc-btn', 'add-sloc-btn'].forEach(id => byId(id).disabled = true);
}

async function saveSlocInlineEdit(row, slocId, editCells) {
    try {
        const updated = { name: editCells[0].value.trim(), address: editCells[1].value.trim() || null, market_id: parseInt(editCells[2].value) || null, updated_at: getLocalTimestamp() };
        if (!updated.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!updated.market_id) return Components.showToast('Market is required', 'error'), editCells[2].focus();
        
        const result = await DB.update('slocs', slocId, updated);
        if (!result.isOk) return Components.showToast('Error updating SLOC', 'error');
        
        await refreshCachedTable('slocs');
        Components.showToast('SLOC updated successfully', 'success');
        byId('add-sloc-btn').disabled = false;
        Store.setState({ hierarchyTableSelection: 'slocs' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error updating SLOC:', error);
        Components.showToast('Error updating SLOC', 'error');
    }
}

async function deleteSlocRecord(sloc) {
    if (sloc.useCount > 0) return Components.showToast(`Cannot delete SLOC "${sloc.name}" - it has ${sloc.useCount} area(s).`, 'error');
    if (!confirm(`Delete SLOC "${sloc.name}"?`)) return;
    
    try {
        const result = await DB.delete('slocs', sloc.id);
        if (!result.isOk) return Components.showToast('Error deleting SLOC', 'error');
        
        await refreshCachedTable('slocs');
        Components.showToast('SLOC deleted successfully', 'success');
        Store.setState({ hierarchyTableSelection: 'slocs' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error deleting SLOC:', error);
        Components.showToast('Error deleting SLOC', 'error');
    }
}

// ============ AREAS CRUD FUNCTIONS ============

function showAddAreaRow() {
    const state = Store.getState();
    const table = byId('areas-table');
    if (!table) return Components.showToast('Table not found', 'error');
    if (document.querySelector('.area-add-row')) return Components.showToast('Already adding a new area', 'warning');
    
    const tbody = table.querySelector('tbody');
    const slocs = state.slocs || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', placeholder: 'Area name', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select SLOC --']),
            ...slocs.map(s => createElement('option', { value: s.id }, [s.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-']),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-'])
    ];
    
    const addRow = createElement('tr', { className: 'area-row hierarchy-row area-add-row editing' }, editCells.map(cell => createElement('td', {}, [cell])));
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => { addRow.remove(); actionRow.remove(); byId('add-area-btn').disabled = false; }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveNewArea(editCells, addRow, actionRow) }, ['Create Area'])
        ])
    ]);
    
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    byId('add-area-btn').disabled = true;
    editCells[0].focus();
}

async function saveNewArea(editCells, addRow, actionRow) {
    try {
        const newArea = {
            name: editCells[0].value.trim(),
            sloc_id: parseInt(editCells[1].value) || null,
            created_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp()
        };
        
        if (!newArea.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!newArea.sloc_id) return Components.showToast('SLOC is required', 'error'), editCells[1].focus();
        
        const result = await DB.insert('areas', newArea);
        if (!result.isOk) return Components.showToast('Error creating area', 'error');
        
        await refreshCachedTable('areas');
        
        // Refresh hierarchy dropdowns (areas don't appear in nav but good to be consistent)
        if (typeof refreshHierarchyDropdowns === 'function') {
            await refreshHierarchyDropdowns();
        }
        
        Components.showToast('Area created successfully', 'success');
        addRow.remove();
        actionRow.remove();
        Store.setState({ hierarchyTableSelection: 'areas' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error creating area:', error);
        Components.showToast('Error creating area', 'error');
    }
}

function enableAreaInlineEdit(row, area, state) {
    if (row.classList.contains('editing')) return;
    row.classList.add('editing');
    const originalHTML = row.innerHTML;
    const cells = row.querySelectorAll('td');
    const slocs = state.slocs || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', value: area.name || '', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select SLOC --']),
            ...slocs.map(s => createElement('option', { value: s.id, selected: s.id === area.sloc_id }, [s.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [String(area.useCount)]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [new Date(area.created_at).toLocaleDateString()])
    ];
    
    cells.forEach((cell, index) => { cell.innerHTML = ''; cell.appendChild(editCells[index]); });
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => {
                row.classList.remove('editing', 'selected');
                row.innerHTML = originalHTML;
                actionRow.remove();
                row.onclick = function() { handleHierarchyRowSelection(this, 'area'); };
                ['edit-area-btn', 'delete-area-btn'].forEach(id => byId(id).disabled = true);
                byId('add-area-btn').disabled = false;
            }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveAreaInlineEdit(row, area.id, editCells) }, ['Save Changes'])
        ])
    ]);
    
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    row.onclick = null;
    ['edit-area-btn', 'delete-area-btn', 'add-area-btn'].forEach(id => byId(id).disabled = true);
}

async function saveAreaInlineEdit(row, areaId, editCells) {
    try {
        const updated = { name: editCells[0].value.trim(), sloc_id: parseInt(editCells[1].value) || null, updated_at: getLocalTimestamp() };
        if (!updated.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!updated.sloc_id) return Components.showToast('SLOC is required', 'error'), editCells[1].focus();
        
        const result = await DB.update('areas', areaId, updated);
        if (!result.isOk) return Components.showToast('Error updating area', 'error');
        
        await refreshCachedTable('areas');
        Components.showToast('Area updated successfully', 'success');
        byId('add-area-btn').disabled = false;
        Store.setState({ hierarchyTableSelection: 'areas' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error updating area:', error);
        Components.showToast('Error updating area', 'error');
    }
}

async function deleteAreaRecord(area) {
    if (area.useCount > 0) return Components.showToast(`Cannot delete area "${area.name}" - it is in use.`, 'error');
    if (!confirm(`Delete area "${area.name}"?`)) return;
    
    try {
        const result = await DB.delete('areas', area.id);
        if (!result.isOk) return Components.showToast('Error deleting area', 'error');
        
        await refreshCachedTable('areas');
        Components.showToast('Area deleted successfully', 'success');
        Store.setState({ hierarchyTableSelection: 'areas' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error deleting area:', error);
        Components.showToast('Error deleting area', 'error');
    }
}

    // ========================================
    // GLOBAL EXPOSURE
    // ========================================

    // Client operations
    window.saveClientInlineEdit = saveClientInlineEdit;
    window.deleteClientRecord = deleteClientRecord;

    // Market operations
    window.showAddMarketRow = showAddMarketRow;
    window.saveNewMarket = saveNewMarket;
    window.enableMarketInlineEdit = enableMarketInlineEdit;
    window.deleteMarketRecord = deleteMarketRecord;

    // SLOC operations
    window.showAddSlocRow = showAddSlocRow;
    window.saveNewSloc = saveNewSloc;
    window.enableSlocInlineEdit = enableSlocInlineEdit;

    // Area operations
    window.saveAreaInlineEdit = saveAreaInlineEdit;
    window.deleteAreaRecord = deleteAreaRecord;
    window.showAddAreaRow = showAddAreaRow;
    window.saveNewArea = saveNewArea;
    window.enableAreaInlineEdit = enableAreaInlineEdit;

})();
