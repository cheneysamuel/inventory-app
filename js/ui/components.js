/**
 * UI Components - Reusable UI building blocks
 */

const Components = (() => {
    
    // Toast notification
    const showToast = (message, type = 'info', duration = 3000) => {
        const container = byId('toast-container');
        if (!container) return;
        
        const toast = div({ className: `toast toast-${type}` }, [
            span(message)
        ]);
        
        container.appendChild(toast);
        
        setTimeout(() => {
            fadeOut(toast, 200);
            setTimeout(() => remove(toast), 200);
        }, duration);
    };
    
    // Loading spinner
    const spinner = () => div({ className: 'spinner' });
    
    // Badge component
    const badge = (text, type = 'secondary') => 
        span(text, { className: `badge badge-${type}` });
    
    // Card component
    const card = (title, content, actions = []) => {
        const cardEl = div({ className: 'card' }, [
            title ? div({ className: 'card-header' }, [title]) : null,
            div({ className: 'card-body' }, Array.isArray(content) ? content : [content])
        ].filter(Boolean));
        
        if (actions.length > 0) {
            const footer = div({ className: 'card-footer d-flex justify-between' }, actions);
            cardEl.appendChild(footer);
        }
        
        return cardEl;
    };
    
    // Form field generator
    const formField = ({ 
        type = 'text', 
        name, 
        label: labelText, 
        value = '', 
        required = false, 
        options = [], 
        placeholder = '',
        id = null,
        min = null,
        max = null,
        onchange = null,
        onblur = null,
        oninput = null,
        onkeypress = null,
        onkeyup = null
    }) => {
        const fieldId = id || `field_${name}`;
        const fieldLabel = label(labelText, fieldId);
        
        let fieldInput;
        
        const commonAttrs = {
            id: fieldId,
            name,
            className: 'form-control',
            required
        };
        
        // Add event handlers if provided
        if (onchange) commonAttrs.onchange = onchange;
        if (onblur) commonAttrs.onblur = onblur;
        if (oninput) commonAttrs.oninput = oninput;
        if (onkeypress) commonAttrs.onkeypress = onkeypress;
        if (onkeyup) commonAttrs.onkeyup = onkeyup;
        
        if (type === 'select') {
            fieldInput = select(
                options.map(opt => ({
                    value: opt.value,
                    text: opt.text || opt.label,
                    selected: opt.value === value
                })),
                commonAttrs
            );
        } else if (type === 'textarea') {
            fieldInput = createElement('textarea', {
                ...commonAttrs,
                placeholder
            });
            fieldInput.value = value;
        } else {
            const inputAttrs = {
                ...commonAttrs,
                value,
                placeholder
            };
            
            // Add min/max for number inputs
            if (type === 'number') {
                if (min !== null) inputAttrs.min = min;
                if (max !== null) inputAttrs.max = max;
            }
            
            fieldInput = input(type, inputAttrs);
        }
        
        return div({ className: 'form-group' }, [fieldLabel, fieldInput]);
    };
    
    // Data table with sorting
    const dataTable = ({ columns, data, actions = [], onRowClick = null }) => {
        const tableEl = createElement('table', { className: 'table' });
        
        // Header
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        
        columns.forEach(col => {
            const th = createElement('th', {}, [col.label || col.field]);
            if (col.sortable) {
                addClass('sortable-header', th);
                th.addEventListener('click', () => {
                    // Sorting logic would go here
                });
            }
            headerRow.appendChild(th);
        });
        
        if (actions.length > 0) {
            headerRow.appendChild(createElement('th', {}, ['Actions']));
        }
        
        thead.appendChild(headerRow);
        tableEl.appendChild(thead);
        
        // Body
        const tbody = createElement('tbody');
        
        data.forEach(row => {
            const tr = createElement('tr');
            
            if (onRowClick) {
                addClass('clickable-row', tr);
                tr.addEventListener('click', () => onRowClick(row));
            }
            
            columns.forEach(col => {
                const value = col.render 
                    ? col.render(row[col.field], row)
                    : row[col.field] ?? '';
                
                // Convert value to string if it's a number
                const displayValue = (value == null || value === '') ? '' : String(value);
                
                const td = createElement('td', {}, [displayValue]);
                tr.appendChild(td);
            });
            
            if (actions.length > 0) {
                const actionsTd = createElement('td', { className: 'd-flex gap-1' });
                actions.forEach(action => {
                    const btn = button(action.label, {
                        className: `btn btn-sm btn-${action.type || 'secondary'}`,
                        onclick: (e) => {
                            e.stopPropagation();
                            action.handler(row);
                        }
                    });
                    actionsTd.appendChild(btn);
                });
                tr.appendChild(actionsTd);
            }
            
            tbody.appendChild(tr);
        });
        
        tableEl.appendChild(tbody);
        
        return div({ className: 'table-container' }, [tableEl]);
    };
    
    // Dropdown/Select with search (using Select2)
    const searchableSelect = (elementId, options = {}) => {
        const $el = $(`#${elementId}`);
        if (!$el) return;
        
        $($el).select2({
            placeholder: options.placeholder || 'Select an option',
            allowClear: options.allowClear !== false,
            width: options.width || '100%',
            ...options
        });
        
        return $el;
    };
    
    // Confirmation dialog
    const confirm = (message, onConfirm, onCancel = null) => {
        const modal = Modals.create({
            title: 'Confirm Action',
            content: p(message),
            actions: [
                {
                    label: 'Cancel',
                    type: 'secondary',
                    handler: () => {
                        Modals.close();
                        if (onCancel) onCancel();
                    }
                },
                {
                    label: 'Confirm',
                    type: 'primary',
                    handler: () => {
                        Modals.close();
                        onConfirm();
                    }
                }
            ]
        });
        
        Modals.show(modal);
    };
    
    // Page header
    const pageHeader = (title, subtitle = '', actions = []) => {
        const header = div({ className: 'page-header mb-3' }, [
            div({ className: 'd-flex justify-between align-center' }, [
                div({}, [
                    h2(title),
                    subtitle ? p(subtitle, { className: 'text-muted' }) : null
                ].filter(Boolean)),
                actions.length > 0 ? div({ className: 'd-flex gap-2' }, actions) : null
            ].filter(Boolean))
        ]);
        
        return header;
    };
    
    // Empty state
    const emptyState = (message, iconText = '📭') => {
        return div({ 
            className: 'empty-state text-center',
            style: { padding: '3rem' }
        }, [
            div({ style: { fontSize: '4rem', marginBottom: '1rem' } }, [iconText]),
            p(message, { style: { fontSize: '1.25rem', color: '#6c757d' } })
        ]);
    };
    
    // Stats card
    const statsCard = (label, value, icon = '', color = 'primary') => {
        return div({
            className: 'stats-card',
            style: {
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                borderLeft: `4px solid var(--${color}-color)`
            }
        }, [
            div({ className: 'd-flex justify-between align-center' }, [
                div({}, [
                    p(label, { style: { margin: 0, color: '#6c757d', fontSize: '0.875rem' } }),
                    h2(String(value), { style: { margin: '0.5rem 0 0 0' } })
                ]),
                icon ? span(icon, { style: { fontSize: '2rem' } }) : null
            ].filter(Boolean))
        ]);
    };
    
    // Progress bar
    const progressBar = (percentage, label = '') => {
        return div({ className: 'progress-container', style: { marginBottom: '1rem' } }, [
            label ? p(label, { style: { marginBottom: '0.5rem' } }) : null,
            div({ 
                className: 'progress-bar',
                style: {
                    height: '20px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px',
                    overflow: 'hidden'
                }
            }, [
                div({
                    style: {
                        width: `${Math.min(100, Math.max(0, percentage))}%`,
                        height: '100%',
                        backgroundColor: 'var(--success-color)',
                        transition: 'width 0.3s ease'
                    }
                })
            ])
        ].filter(Boolean));
    };
    
    // Tabs component
    const tabs = (tabsData, activeTab = 0) => {
        const tabsContainer = div({ className: 'tabs-container' });
        
        const tabHeaders = div({ className: 'tab-headers d-flex', style: { borderBottom: '2px solid #dee2e6', marginBottom: '1rem' } });
        const tabContent = div({ className: 'tab-content' });
        
        tabsData.forEach((tab, index) => {
            const isActive = index === activeTab;
            
            const tabHeader = button(tab.label, {
                className: `tab-header ${isActive ? 'active' : ''}`,
                onclick: () => {
                    // Remove active from all
                    $$('.tab-header').forEach(h => removeClass('active', h));
                    $$('.tab-pane').forEach(p => hide(p));
                    
                    // Add active to clicked
                    addClass('active', tabHeader);
                    show(tabPanes[index]);
                }
            });
            
            tabHeaders.appendChild(tabHeader);
        });
        
        const tabPanes = tabsData.map((tab, index) => {
            const pane = div({ 
                className: 'tab-pane',
                style: { display: index === activeTab ? 'block' : 'none' }
            }, Array.isArray(tab.content) ? tab.content : [tab.content]);
            tabContent.appendChild(pane);
            return pane;
        });
        
        tabsContainer.appendChild(tabHeaders);
        tabsContainer.appendChild(tabContent);
        
        return tabsContainer;
    };
    
    return {
        showToast,
        spinner,
        badge,
        card,
        formField,
        dataTable,
        searchableSelect,
        confirm,
        pageHeader,
        emptyState,
        statsCard,
        progressBar,
        tabs
    };
})();
