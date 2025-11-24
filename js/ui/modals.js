/**
 * Modals - Modal dialog system
 */

const Modals = (() => {
    let currentModal = null;
    let closeTimeouts = []; // Track all pending close timeouts
    
    // Create modal structure
    const create = ({ title, content, actions = [], size = 'medium', closeOnOverlay = true, actionModal = false }) => {
        const overlay = div({ className: 'modal-overlay' });
        
        const modal = div({ 
            className: 'modal',
            style: {
                maxWidth: size === 'small' ? '400px' : size === 'large' ? '1200px' : '600px'
            }
        });
        
        // Header
        const header = div({ className: 'modal-header' }, [
            h2(title, { className: 'modal-title' }),
            button('×', {
                className: 'modal-close',
                onclick: () => close()
            })
        ]);
        
        // Body - Check if this is an action modal with special layout
        let body;
        if (actionModal && actions.length > 0) {
            // Action modal: Two-column layout with content on left (80%) and buttons on right (20%)
            const contentSection = div({ 
                style: { flex: '0 0 80%', padding: '5px', overflowY: 'auto' } 
            }, Array.isArray(content) ? content : [content]);
            
            const buttonSection = div({ 
                style: { flex: '0 0 20%', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '5px' } 
            }, actions.map(action => 
                button(action.label, {
                    className: `btn btn-${action.type || 'secondary'}`,
                    style: { width: '100%', fontSize: '16px', padding: '12px' },
                    onclick: action.handler
                })
            ));
            
            body = div({ 
                className: 'modal-body',
                style: { display: 'flex', gap: '1rem', minHeight: '400px' }
            }, [contentSection, buttonSection]);
        } else {
            // Standard modal: Normal layout
            body = div({ className: 'modal-body' }, 
                Array.isArray(content) ? content : [content]
            );
        }
        
        // Footer (only for non-action modals)
        let footer = null;
        if (!actionModal && actions.length > 0) {
            const actionButtons = actions.map(action => 
                button(action.label, {
                    className: `btn btn-${action.type || 'secondary'}`,
                    onclick: action.handler
                })
            );
            footer = div({ className: 'modal-footer' }, actionButtons);
        }
        
        modal.appendChild(header);
        modal.appendChild(body);
        if (footer) modal.appendChild(footer);
        
        overlay.appendChild(modal);
        
        // Close on overlay click
        if (closeOnOverlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close();
                }
            });
        }
        
        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        return overlay;
    };
    
    // Show modal
    const show = (modalElement) => {
        const container = byId('modal-container');
        if (!container) {
            console.error('Modal container not found');
            return;
        }
        
        // Cancel all pending close timeouts to prevent them from closing the new modal
        closeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        closeTimeouts = [];
        
        // Close existing modal immediately without animation
        if (currentModal) {
            if (currentModal.parentNode) {
                currentModal.parentNode.removeChild(currentModal);
            }
        }
        
        container.appendChild(modalElement);
        currentModal = modalElement;
        
        // Focus first input if exists
        const firstInput = modalElement.querySelector('input, select, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    };
    
    // Close current modal
    const close = () => {
        const modalToClose = currentModal;
        if (modalToClose) {
            fadeOut(modalToClose, 200);
            const timeoutId = setTimeout(() => {
                if (modalToClose && modalToClose.parentNode) {
                    modalToClose.parentNode.removeChild(modalToClose);
                }
                if (currentModal === modalToClose) {
                    currentModal = null;
                }
                // Remove this timeout from tracking
                closeTimeouts = closeTimeouts.filter(id => id !== timeoutId);
            }, 200);
            closeTimeouts.push(timeoutId);
        }
    };
    
    // Form modal
    const form = ({ title, fields, onSubmit, submitLabel = 'Submit' }) => {
        const formEl = createElement('form', { id: 'modalForm' });
        
        fields.forEach(field => {
            const fieldEl = Components.formField(field);
            formEl.appendChild(fieldEl);
        });
        
        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = getFormData(formEl);
            onSubmit(formData);
        });
        
        return create({
            title,
            content: formEl,
            actions: [
                {
                    label: 'Cancel',
                    type: 'secondary',
                    handler: close
                },
                {
                    label: submitLabel,
                    type: 'primary',
                    handler: () => {
                        formEl.dispatchEvent(new Event('submit'));
                    }
                }
            ]
        });
    };
    
    // Alert modal
    const alert = (message, title = 'Alert', type = 'info') => {
        const iconMap = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        const content = div({ className: 'text-center' }, [
            div({ style: { fontSize: '3rem', marginBottom: '1rem' } }, [iconMap[type]]),
            p(message, { style: { fontSize: '1.1rem' } })
        ]);
        
        const modal = create({
            title,
            content,
            actions: [
                {
                    label: 'OK',
                    type: 'primary',
                    handler: close
                }
            ],
            size: 'small'
        });
        
        show(modal);
    };
    
    // Confirm modal
    const confirm = (message, title = 'Confirm', onConfirm, onCancel = null) => {
        const content = div({ className: 'text-center' }, [
            p(message, { style: { fontSize: '1.1rem', marginBottom: '1.5rem' } })
        ]);
        
        const modal = create({
            title,
            content,
            actions: [
                {
                    label: 'Cancel',
                    type: 'secondary',
                    handler: () => {
                        close();
                        if (onCancel) onCancel();
                    }
                },
                {
                    label: 'Confirm',
                    type: 'primary',
                    handler: () => {
                        close();
                        onConfirm();
                    }
                }
            ],
            size: 'small',
            closeOnOverlay: false
        });
        
        show(modal);
    };
    
    // Loading modal
    const loading = (message = 'Loading...') => {
        const content = div({ className: 'text-center' }, [
            Components.spinner(),
            p(message, { style: { marginTop: '1rem' } })
        ]);
        
        const modal = create({
            title: '',
            content,
            actions: [],
            size: 'small',
            closeOnOverlay: false
        });
        
        show(modal);
        return close; // Return close function for caller to use
    };
    
    // Custom modal with flexible options
    const custom = ({ title, content, showCancel = true, cancelText = 'Cancel', showConfirm = true, confirmText = 'OK', onConfirm = null, size = 'medium' }) => {
        const actions = [];
        
        if (showCancel) {
            actions.push({
                label: cancelText,
                type: 'secondary',
                handler: close
            });
        }
        
        if (showConfirm) {
            actions.push({
                label: confirmText,
                type: 'primary',
                handler: () => {
                    close();
                    if (onConfirm) onConfirm();
                }
            });
        }
        
        const modal = create({
            title,
            content,
            actions,
            size
        });
        
        show(modal);
    };
    
    return {
        create,
        show,
        close,
        form,
        alert,
        confirm,
        loading,
        custom
    };
})();
