/**
 * DOM Manipulation Utilities
 * Pure functional approach to DOM operations
 */

// ===== Element Creation =====
const createElement = (tag, attrs = {}, children = []) => {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const eventName = key.substring(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Append children
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof HTMLElement) {
            element.appendChild(child);
        }
    });
    
    return element;
};

// ===== Element Selectors =====
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const byId = id => document.getElementById(id);
const byClass = className => Array.from(document.getElementsByClassName(className));
const byTag = tagName => Array.from(document.getElementsByTagName(tagName));

// ===== Element Manipulation =====
const setText = curry((text, element) => {
    element.textContent = text;
    return element;
});

const setHTML = curry((html, element) => {
    element.innerHTML = html;
    return element;
});

const addClass = curry((className, element) => {
    element.classList.add(className);
    return element;
});

const removeClass = curry((className, element) => {
    element.classList.remove(className);
    return element;
});

const toggleClass = curry((className, element) => {
    element.classList.toggle(className);
    return element;
});

const hasClass = curry((className, element) => 
    element.classList.contains(className)
);

const setAttribute = curry((attr, value, element) => {
    element.setAttribute(attr, value);
    return element;
});

const getAttribute = curry((attr, element) => 
    element.getAttribute(attr)
);

const removeAttribute = curry((attr, element) => {
    element.removeAttribute(attr);
    return element;
});

const setStyle = curry((styles, element) => {
    Object.assign(element.style, styles);
    return element;
});

const setData = curry((key, value, element) => {
    element.dataset[key] = value;
    return element;
});

const getData = curry((key, element) => 
    element.dataset[key]
);

// ===== Element State =====
const show = element => setStyle({ display: 'block' }, element);
const hide = element => setStyle({ display: 'none' }, element);
const toggle = element => {
    const isHidden = element.style.display === 'none';
    return isHidden ? show(element) : hide(element);
};

const enable = element => {
    element.disabled = false;
    return element;
};

const disable = element => {
    element.disabled = true;
    return element;
};

const getValue = element => element.value;
const setValue = curry((value, element) => {
    element.value = value;
    return element;
});

const getChecked = element => element.checked;
const setChecked = curry((checked, element) => {
    element.checked = checked;
    return element;
});

// ===== DOM Tree Operations =====
const append = curry((child, parent) => {
    parent.appendChild(child);
    return parent;
});

const prepend = curry((child, parent) => {
    parent.insertBefore(child, parent.firstChild);
    return parent;
});

const remove = element => {
    element.remove();
    return element;
};

const empty = element => {
    element.innerHTML = '';
    return element;
};

const replaceElement = curry((newElement, oldElement) => {
    oldElement.replaceWith(newElement);
    return newElement;
});

// ===== Event Handling =====
const on = curry((eventName, handler, element) => {
    element.addEventListener(eventName, handler);
    return element;
});

const off = curry((eventName, handler, element) => {
    element.removeEventListener(eventName, handler);
    return element;
});

const once = curry((eventName, handler, element) => {
    element.addEventListener(eventName, handler, { once: true });
    return element;
});

const delegate = curry((selector, eventName, handler, parent) => {
    parent.addEventListener(eventName, e => {
        const target = e.target.closest(selector);
        if (target) {
            handler.call(target, e);
        }
    });
    return parent;
});

// ===== Form Utilities =====
const getFormData = form => {
    const formData = new FormData(form);
    return Object.fromEntries(formData.entries());
};

const setFormData = curry((data, form) => {
    Object.entries(data).forEach(([name, value]) => {
        const field = form.elements[name];
        if (field) {
            if (field.type === 'checkbox') {
                field.checked = value;
            } else if (field.type === 'radio') {
                const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
                if (radio) radio.checked = true;
            } else {
                field.value = value;
            }
        }
    });
    return form;
});

const resetForm = form => {
    form.reset();
    return form;
};

const validateForm = form => {
    return form.checkValidity();
};

// ===== Table Utilities =====
const createTableRow = (data, headers) => {
    const tr = createElement('tr');
    headers.forEach(header => {
        const td = createElement('td', {}, [String(data[header] ?? '')]);
        tr.appendChild(td);
    });
    return tr;
};

const createTable = (data, headers) => {
    const table = createElement('table', { className: 'table' });
    
    // Create header
    const thead = createElement('thead');
    const headerRow = createElement('tr');
    headers.forEach(header => {
        const th = createElement('th', {}, [header]);
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = createElement('tbody');
    data.forEach(row => {
        tbody.appendChild(createTableRow(row, headers));
    });
    table.appendChild(tbody);
    
    return table;
};

// ===== Animation Utilities =====
const fadeIn = (element, duration = 300) => {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    let start = null;
    const animate = timestamp => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        element.style.opacity = Math.min(progress / duration, 1);
        
        if (progress < duration) {
            requestAnimationFrame(animate);
        }
    };
    
    requestAnimationFrame(animate);
    return element;
};

const fadeOut = (element, duration = 300) => {
    element.style.opacity = '1';
    
    let start = null;
    const animate = timestamp => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        element.style.opacity = 1 - Math.min(progress / duration, 1);
        
        if (progress < duration) {
            requestAnimationFrame(animate);
        } else {
            element.style.display = 'none';
        }
    };
    
    requestAnimationFrame(animate);
    return element;
};

// ===== Utility Functions =====
const focus = element => {
    element.focus();
    return element;
};

const blur = element => {
    element.blur();
    return element;
};

const scrollIntoView = (options = {}) => element => {
    element.scrollIntoView(options);
    return element;
};

const getPosition = element => {
    const rect = element.getBoundingClientRect();
    return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
    };
};

const isVisible = element => {
    return element.offsetWidth > 0 && element.offsetHeight > 0;
};

// ===== Component Builders =====
const button = (text, attrs = {}) => 
    createElement('button', { ...attrs, type: attrs.type || 'button' }, [text]);

const input = (type, attrs = {}) => 
    createElement('input', { ...attrs, type });

const select = (options, attrs = {}) => {
    const selectEl = createElement('select', attrs);
    options.forEach(({ value, text, selected }) => {
        const option = createElement('option', { value }, [text]);
        if (selected) option.selected = true;
        selectEl.appendChild(option);
    });
    return selectEl;
};

const label = (text, forId, attrs = {}) => 
    createElement('label', { ...attrs, for: forId }, [text]);

const div = (attrs = {}, children = []) => 
    createElement('div', attrs, children);

const span = (text, attrs = {}) => 
    createElement('span', attrs, [text]);

const p = (text, attrs = {}) => 
    createElement('p', attrs, [text]);

const h1 = (text, attrs = {}) => 
    createElement('h1', attrs, [text]);

const h2 = (text, attrs = {}) => 
    createElement('h2', attrs, [text]);

const h3 = (text, attrs = {}) => 
    createElement('h3', attrs, [text]);

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    // Node.js export
    module.exports = {
        createElement, $, $$, byId, byClass, byTag,
        setText, setHTML, addClass, removeClass, toggleClass, hasClass,
        setAttribute, getAttribute, removeAttribute,
        setStyle, setData, getData,
        show, hide, toggle, enable, disable,
        getValue, setValue, getChecked, setChecked,
        append, prepend, remove, empty, replaceElement,
        on, off, once, delegate,
        getFormData, setFormData, resetForm, validateForm,
        createTableRow, createTable,
        fadeIn, fadeOut,
        focus, blur, scrollIntoView, getPosition, isVisible,
        button, input, select, label, div, span, p, h1, h2, h3
    };
} else if (typeof window !== 'undefined') {
    // Browser global export
    window.DOM = {
        createElement, $, $$, byId, byClass, byTag,
        setText, setHTML, addClass, removeClass, toggleClass, hasClass,
        setAttribute, getAttribute, removeAttribute,
        setStyle, setData, getData,
        show, hide, toggle, enable, disable,
        getValue, setValue, getChecked, setChecked,
        append, prepend, remove, empty, replaceElement,
        on, off, once, delegate,
        getFormData, setFormData, resetForm, validateForm,
        createTableRow, createTable,
        fadeIn, fadeOut,
        focus, blur, scrollIntoView, getPosition, isVisible,
        button, input, select, label, div, span, p, h1, h2, h3
    };
    
    // Also make commonly used functions globally available for convenience
    window.$ = $;
    window.$$ = $$;
    window.byId = byId;
    window.byClass = byClass;
    window.byTag = byTag;
    window.on = on;
    window.off = off;
    window.createElement = createElement;
}
