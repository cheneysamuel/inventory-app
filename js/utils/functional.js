/**
 * Core Functional Programming Utilities
 * Pure functions for composition, data transformation, and functional patterns
 */

// ===== Function Composition =====
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);

// ===== Curry & Partial Application =====
const curry = (fn) => {
    const arity = fn.length;
    return function curried(...args) {
        if (args.length >= arity) {
            return fn.apply(this, args);
        }
        return function(...moreArgs) {
            return curried.apply(this, args.concat(moreArgs));
        };
    };
};

const partial = (fn, ...args) => (...moreArgs) => fn(...args, ...moreArgs);

// ===== Array Operations =====
const map = curry((fn, arr) => arr.map(fn));
const filter = curry((pred, arr) => arr.filter(pred));
const reduce = curry((fn, init, arr) => arr.reduce(fn, init));
const find = curry((pred, arr) => arr.find(pred));
const findIndex = curry((pred, arr) => arr.findIndex(pred));
const some = curry((pred, arr) => arr.some(pred));
const every = curry((pred, arr) => arr.every(pred));
const head = arr => arr[0];
const tail = arr => arr.slice(1);
const last = arr => arr[arr.length - 1];
const take = curry((n, arr) => arr.slice(0, n));
const drop = curry((n, arr) => arr.slice(n));
const flatten = arr => arr.flat(Infinity);
const unique = arr => [...new Set(arr)];
const sortBy = curry((fn, arr) => [...arr].sort((a, b) => {
    const aVal = fn(a);
    const bVal = fn(b);
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
}));
const groupBy = curry((fn, arr) => 
    arr.reduce((acc, item) => {
        const key = fn(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {})
);

// ===== Object Operations =====
const prop = curry((key, obj) => obj?.[key]);
const props = curry((keys, obj) => keys.map(k => obj?.[k]));
const assoc = curry((key, value, obj) => ({ ...obj, [key]: value }));
const dissoc = curry((key, obj) => {
    const { [key]: _, ...rest } = obj;
    return rest;
});
const evolve = curry((transformations, obj) => 
    Object.keys(transformations).reduce(
        (acc, key) => assoc(key, transformations[key](obj[key]), acc),
        obj
    )
);
const merge = curry((obj1, obj2) => ({ ...obj1, ...obj2 }));
const pick = curry((keys, obj) => 
    keys.reduce((acc, key) => 
        obj.hasOwnProperty(key) ? assoc(key, obj[key], acc) : acc, 
        {}
    )
);
const omit = curry((keys, obj) => 
    Object.keys(obj).reduce((acc, key) => 
        keys.includes(key) ? acc : assoc(key, obj[key], acc),
        {}
    )
);

// ===== Logic & Predicates =====
const not = fn => (...args) => !fn(...args);
const and = (...fns) => (...args) => fns.every(fn => fn(...args));
const or = (...fns) => (...args) => fns.some(fn => fn(...args));
const ifElse = curry((pred, onTrue, onFalse, value) => 
    pred(value) ? onTrue(value) : onFalse(value)
);
const when = curry((pred, fn, value) => pred(value) ? fn(value) : value);
const unless = curry((pred, fn, value) => pred(value) ? value : fn(value));
const cond = (...pairs) => value => {
    for (const [pred, transform] of pairs) {
        if (pred(value)) return transform(value);
    }
    return value;
};

// ===== Comparison =====
const equals = curry((a, b) => a === b);
const gt = curry((a, b) => b > a);
const gte = curry((a, b) => b >= a);
const lt = curry((a, b) => b < a);
const lte = curry((a, b) => b <= a);
const between = curry((min, max, value) => value >= min && value <= max);

// ===== Type Checking =====
const isNull = x => x === null;
const isUndefined = x => x === undefined;
const isNil = x => x == null;
const isArray = Array.isArray;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isString = x => typeof x === 'string';
const isNumber = x => typeof x === 'number' && !isNaN(x);
const isFunction = x => typeof x === 'function';
const isEmpty = x => {
    if (isNil(x)) return true;
    if (isArray(x) || isString(x)) return x.length === 0;
    if (isObject(x)) return Object.keys(x).length === 0;
    return false;
};

// ===== String Operations =====
const trim = s => s.trim();
const toLowerCase = s => s.toLowerCase();
const toUpperCase = s => s.toUpperCase();
const split = curry((delimiter, str) => str.split(delimiter));
const join = curry((delimiter, arr) => arr.join(delimiter));
const replace = curry((pattern, replacement, str) => str.replace(pattern, replacement));
const test = curry((regex, str) => regex.test(str));

// ===== Math Operations =====
const add = curry((a, b) => a + b);
const subtract = curry((a, b) => a - b);
const multiply = curry((a, b) => a * b);
const divide = curry((a, b) => a / b);
const sum = arr => arr.reduce((a, b) => a + b, 0);
const product = arr => arr.reduce((a, b) => a * b, 1);
const min = arr => Math.min(...arr);
const max = arr => Math.max(...arr);
const clamp = curry((lower, upper, value) => Math.min(upper, Math.max(lower, value)));

// ===== Async Utilities =====
const asyncPipe = (...fns) => x => fns.reduce(async (acc, fn) => fn(await acc), x);
const asyncMap = curry(async (fn, arr) => Promise.all(arr.map(fn)));
const tryCatch = curry((fn, errorHandler, ...args) => {
    try {
        const result = fn(...args);
        return result instanceof Promise 
            ? result.catch(errorHandler)
            : result;
    } catch (error) {
        return errorHandler(error);
    }
});

// ===== Memoization =====
const memoize = (fn) => {
    const cache = new Map();
    return (...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) return cache.get(key);
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
};

// ===== Delay & Debounce =====
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const debounce = (fn, wait) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), wait);
    };
};
const throttle = (fn, wait) => {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= wait) {
            lastCall = now;
            fn(...args);
        }
    };
};

// ===== Identity & Constant =====
const identity = x => x;
const constant = x => () => x;
const always = constant;

// ===== Tap & Log =====
const tap = curry((fn, x) => {
    fn(x);
    return x;
});
const log = label => tap(x => console.log(label, x));
const trace = label => tap(x => console.trace(label, x));

// ===== Data Validation =====
const isValidEmail = test(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
const isValidPhone = test(/^\+?[\d\s\-\(\)]+$/);
const isPositive = gt(0);
const isNegative = lt(0);

/**
 * Get date string for filenames (YYYY-MM-DD format in local timezone)
 */
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get local timestamp in ISO format (for database records)
 */
const getLocalTimestamp = () => {
    return new Date().toISOString();
};

/**
 * Get UTC timestamp in ISO format
 */
const getUTCTimestamp = () => {
    return new Date().toISOString();
};

/**
 * Get user's timezone identifier
 * Returns IANA timezone string (e.g., "America/New_York", "America/Los_Angeles")
 */
const getUserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Format timestamp with timezone information
 * Shows date/time with timezone and optionally user's local time if different
 * @param {string} timestamp - ISO timestamp string
 * @param {string} originalTimezone - IANA timezone where timestamp was created
 * @returns {string} Formatted timestamp string with timezone info
 */
const formatTimestampWithTimezone = (timestamp, originalTimezone) => {
    if (!timestamp) return '-';
    
    const date = new Date(timestamp);
    const userTimezone = getUserTimezone();
    
    // Format with original timezone
    const originalFormatted = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: originalTimezone || userTimezone,
        timeZoneName: 'short'
    });
    
    // If original timezone is different from user's current timezone, show both
    if (originalTimezone && originalTimezone !== userTimezone) {
        const userFormatted = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: userTimezone,
            timeZoneName: 'short'
        });
        return `${originalFormatted} (your time: ${userFormatted})`;
    }
    
    return originalFormatted;
};

/**
 * Format date only with timezone
 * @param {string} timestamp - ISO timestamp string
 * @param {string} originalTimezone - IANA timezone where timestamp was created
 * @returns {string} Formatted date string
 */
const formatDateWithTimezone = (timestamp, originalTimezone) => {
    if (!timestamp) return '-';
    
    const date = new Date(timestamp);
    const userTimezone = getUserTimezone();
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: originalTimezone || userTimezone
    });
};

// ===== Maybe Monad (for null safety) =====
const Maybe = {
    of: value => ({ 
        value, 
        isNothing: isNil(value),
        map: fn => isNil(value) ? Maybe.of(null) : Maybe.of(fn(value)),
        chain: fn => isNil(value) ? Maybe.of(null) : fn(value),
        getOrElse: defaultValue => isNil(value) ? defaultValue : value
    })
};

// ===== Result/Either (for error handling) =====
const Result = {
    ok: value => ({ 
        isOk: true, 
        value,
        map: fn => Result.ok(fn(value)),
        chain: fn => fn(value),
        mapError: () => Result.ok(value),
        fold: (onError, onSuccess) => onSuccess(value)
    }),
    error: error => ({ 
        isOk: false, 
        error,
        map: () => Result.error(error),
        chain: () => Result.error(error),
        mapError: fn => Result.error(fn(error)),
        fold: (onError, onSuccess) => onError(error)
    })
};

// Export all utilities
if (typeof module !== 'undefined' && module.exports) {
    // Node.js export
    module.exports = {
        compose, pipe, curry, partial,
        map, filter, reduce, find, findIndex, some, every,
        head, tail, last, take, drop, flatten, unique, sortBy, groupBy,
        prop, props, assoc, dissoc, evolve, merge, pick, omit,
        not, and, or, ifElse, when, unless, cond,
        equals, gt, gte, lt, lte, between,
        isNull, isUndefined, isNil, isArray, isObject, isString, isNumber, isFunction, isEmpty,
        trim, toLowerCase, toUpperCase, split, join, replace, test,
        add, subtract, multiply, divide, sum, product, min, max, clamp,
        asyncPipe, asyncMap, tryCatch,
        memoize, delay, debounce, throttle,
        identity, constant, always,
        tap, log, trace,
        isValidEmail, isValidPhone, isPositive, isNegative,
        getLocalTimestamp, getUTCTimestamp, getLocalDateString,
        getUserTimezone, formatTimestampWithTimezone, formatDateWithTimezone,
        Maybe, Result
    };
} else if (typeof window !== 'undefined') {
    // Browser global export
    Object.assign(window, {
        compose, pipe, curry, partial,
        map, filter, reduce, find, findIndex, some, every,
        head, tail, last, take, drop, flatten, unique, sortBy, groupBy,
        prop, props, assoc, dissoc, evolve, merge, pick, omit,
        not, and, or, ifElse, when, unless, cond,
        equals, gt, gte, lt, lte, between,
        isNull, isUndefined, isNil, isArray, isObject, isString, isNumber, isFunction, isEmpty,
        trim, toLowerCase, toUpperCase, split, join, replace, test,
        add, subtract, multiply, divide, sum, product, min, max, clamp,
        asyncPipe, asyncMap, tryCatch,
        memoize, delay, debounce, throttle,
        identity, constant, always,
        tap, log, trace,
        isValidEmail, isValidPhone, isPositive, isNegative,
        getLocalTimestamp, getUTCTimestamp, getLocalDateString,
        getUserTimezone, formatTimestampWithTimezone, formatDateWithTimezone,
        Maybe, Result
    });
}
