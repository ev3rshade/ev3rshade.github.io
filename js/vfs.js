// virtual filesystem representing the website
// populated at runtime from vfs/manifest.json + vfs/blog/posts.json — see initFS() in terminal.js
const FS = {};

function resolvePath(p) {
    if (!p || p === '~') return '/';
    const base = p.startsWith('/') ? '' : cwd;
    const segs = (base + '/' + p).split('/').filter(Boolean);
    const out  = [];
    for (const s of segs) {
        if (s === '..') out.pop();
        else if (s !== '.') out.push(s);
    }
    return '/' + out.join('/');
}

function node(path) { return FS[path] || null; }

// Files that can be edited + saved from vim; edits persist in localStorage
// since this is a static site with no backend to write to.
const EDITABLE_FILES = ['/.termrc'];

function overrideKey(src) { return `override:${src}`; }

async function fetchFile(src) {
    let override = localStorage.getItem(overrideKey(src));
    if (override === null && src === 'vfs/termrc') {
        // migrate from the old termrc-only override key
        override = localStorage.getItem('termrc');
        if (override !== null) {
            localStorage.setItem(overrideKey(src), override);
            localStorage.removeItem('termrc');
        }
    }
    if (override !== null) return override;
    try {
        const r = await fetch(src);
        return r.ok ? await r.text() : null;
    } catch { return null; }
}