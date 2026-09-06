// ev3rshade terminal

function applyTheme(isDark) {
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function applyTermrcContent(content) {
    for (const [, key, val] of content.matchAll(/^export\s+(\w+)="([^"]*)"/gm)) {
        if (key === 'PROMPT') termPrompt = val;
        if (key === 'THEME' && !localStorage.getItem('theme')) {
            const dark = val === 'dark' || (val === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.body.classList.toggle('dark', dark);
        }
    }
    updatePrompt();
}

async function parseTermrc() {
    const content = await fetchFile('vfs/termrc');
    if (content) applyTermrcContent(content);
}

async function initFS() {
    try {
        const manifest = await (await fetch('vfs/manifest.json')).json();
        Object.assign(FS, manifest);
    } catch {}
    try {
        const blog = await (await fetch('vfs/blog/blog.json')).json();
        for (const section of ['posts', 'journal']) {
            FS[`/blog/${section}`].children = blog[section].map(p => p.slug + '.md');
            for (const p of blog[section])
                FS[`/blog/${section}/${p.slug}.md`] = { type: 'file', src: `vfs/blog/${section}/${p.slug}.md` };
        }
    } catch {}
}

let cwd        = '/';
let history    = [];
let histIdx    = -1;
let termPrompt = 'user@ev3rshade';


// ── DOM refs ──────────────────────────────────────────────────────────────────

const terminal   = document.getElementById('terminal');
const output     = document.getElementById('output');
const inputLine  = document.getElementById('input-line');
const cmdInput   = document.getElementById('cmd-input');
const promptEl   = document.getElementById('prompt');
const vimOverlay = document.getElementById('vim-overlay');
const vimContent = document.getElementById('vim-content');
const vimStatus  = document.getElementById('vim-statusbar');
const vimCmdline = document.getElementById('vim-cmdline');
const guiWindow  = document.getElementById('gui-window');

// ── Helpers ───────────────────────────────────────────────────────────────────

function promptStr() {
    const loc = cwd === '/' ? '~' : '~' + cwd;
    return `${termPrompt}:${loc}$ `;
}

function updatePrompt() { promptEl.textContent = promptStr(); }

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function print(text, cls) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    output.appendChild(d);
    terminal.scrollTop = terminal.scrollHeight;
}

// ── Command dispatch ──────────────────────────────────────────────────────────

const COMMANDS = { ls, cd, cat, grep, wc, find, vim: openVimCmd, reset: resetFile, plant, clear, theme, help, 'gui-please': guiPlease };


// ── Keyboard handlers ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([initFS(), parseTermrc()]);
    updatePrompt();
    // Print home README on load
    fetchFile('vfs/README.md').then(content => {
        if (content) print(content, 'file-content');
        print('');
    });

    cmdInput.addEventListener('keydown', async e => {
        if (vim.active) return;
        if (e.key === 'Tab') {
            e.preventDefault();
            const input = cmdInput.value;
            const parts = input.split(/\s+/);

            if (parts.length === 1) {
                // complete command name
                const partial = parts[0];
                const matches = Object.keys(COMMANDS).filter(c => c.startsWith(partial));
                if (matches.length === 1) {
                    cmdInput.value = matches[0] + ' ';
                } else if (matches.length > 1) {
                    print(matches.join('  '), 'dim');
                }
            } else {
                // complete file/dir path
                const partial = parts[parts.length - 1];
                const lastSlash = partial.lastIndexOf('/');
                const dirPart  = lastSlash >= 0 ? partial.slice(0, lastSlash + 1) : '';
                const namePart = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial;
                const searchDir = dirPart ? resolvePath(dirPart) : cwd;
                const dirNode = node(searchDir);
                if (!dirNode || dirNode.type !== 'dir') return;

                const matches = dirNode.children.filter(c => c.startsWith(namePart));
                if (matches.length === 1) {
                    const childPath = searchDir === '/' ? `/${matches[0]}` : `${searchDir}/${matches[0]}`;
                    const isDir = node(childPath)?.type === 'dir';
                    parts[parts.length - 1] = dirPart + matches[0] + (isDir ? '/' : '');
                    cmdInput.value = parts.join(' ');
                } else if (matches.length > 1) {
                    print(matches.join('  '), 'dim');
                }
            }
            return;
        }
        if (e.key === 'Enter') {
            const val = cmdInput.value;
            if (val.trim()) { history.unshift(val); histIdx = -1; }
            cmdInput.value = '';
            await run(val);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (histIdx < history.length - 1) cmdInput.value = history[++histIdx];
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx > 0)   cmdInput.value = history[--histIdx];
            else { histIdx = -1; cmdInput.value = ''; }
        }
    });

    document.addEventListener('keydown', e => {
        if (!vim.active) return;
        vimHandleKey(e);
    });

    // Clicking anywhere refocuses the input, but not if the click was
    // finishing a text selection (otherwise refocusing yanks the view
    // back to the input and breaks highlighting).
    document.addEventListener('click', () => {
        if (vim.active) return;
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        cmdInput.focus();
    });
});