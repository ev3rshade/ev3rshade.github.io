// vim — read-only viewer, with basic editing for allowlisted files

const vim = { active: false, lines: [], top: 0, mode: 'normal', cmd: '', msg: '', file: '', src: '', editable: false, dirty: false, cursor: { line: 0, col: 0 }, pendingG: false };

async function openVimCmd([path] = []) {
    if (!path) return print('usage: vim <file>', 'err');
    const p = resolvePath(path);
    const n = node(p);
    if (!n || n.type === 'dir') return print(`vim: ${path}: No such file or directory`, 'err');
    const content = await fetchFile(n.src);
    if (content === null) return print(`vim: ${path}: Error reading file`, 'err');
    openVim(p, n.src, content);
}

function openVim(path, src, content) {
    Object.assign(vim, {
        active: true, lines: content.split('\n'), top: 0, mode: 'normal', cmd: '', msg: '',
        file: path, src, editable: EDITABLE_FILES.includes(path), dirty: false,
        cursor: { line: 0, col: 0 }, pendingG: false,
    });
    vimOverlay.classList.remove('hidden');
    inputLine.classList.add('hidden');
    renderVim();
}

function closeVim() {
    vim.active = false;
    vimOverlay.classList.add('hidden');
    inputLine.classList.remove('hidden');
    cmdInput.focus();
}

function vimScrollToCursor() {
    const visible = Math.max(Math.floor((vimContent.clientHeight || window.innerHeight - 60) / 20), 1);
    if (vim.cursor.line < vim.top) vim.top = vim.cursor.line;
    if (vim.cursor.line >= vim.top + visible) vim.top = vim.cursor.line - visible + 1;
}

function renderVim() {
    const visible = Math.max(Math.floor((vimContent.clientHeight || window.innerHeight - 60) / 20), 1);
    let html = '';
    for (let i = 0; i < visible; i++) {
        const li = vim.top + i;
        if (li < vim.lines.length) {
            const text = vim.lines[li] ?? '';
            const body = li === vim.cursor.line
                ? esc(text.slice(0, vim.cursor.col)) + `<span class="vim-cursor">${esc(text[vim.cursor.col] ?? ' ')}</span>` + esc(text.slice(vim.cursor.col + 1))
                : esc(text);
            html += `<div class="vim-line"><span class="vim-lnum">${li + 1}</span><span>${body}</span></div>`;
        } else {
            html += `<div class="vim-line"><span class="vim-lnum vim-tilde">~</span></div>`;
        }
    }
    vimContent.innerHTML = html;
    const flag = vim.editable ? (vim.dirty ? ' [+]' : '') : ' [readonly]';
    vimStatus.innerHTML = `<span>"${esc(vim.file)}"${flag}</span>`;
    vimCmdline.textContent = vim.mode === 'command' ? ':' + vim.cmd : vim.msg;
}

function vimMessage(msg) {
    vim.msg = msg;
    renderVim();
}

// Persists the buffer to the file's override key. Returns true on success.
function vimWrite() {
    if (!vim.editable) { vimMessage(`E45: 'readonly' option is set (add ! to override)`); return false; }
    const text = vim.lines.join('\n');
    localStorage.setItem(overrideKey(vim.src), text);
    vim.dirty = false;
    vimMessage(`"${vim.file}" written`);
    if (vim.src === 'vfs/termrc') applyTermrcContent(text);
    return true;
}

function vimRunCommand(raw) {
    const cmd = raw.trim();
    if (cmd === 'w' || cmd === 'write')       vimWrite();
    else if (cmd === 'wq' || cmd === 'x')     { if (vimWrite()) closeVim(); }
    else if (cmd === 'q!' || cmd === 'quit!') closeVim();
    else if (cmd === 'q' || cmd === 'quit') {
        if (vim.dirty) vimMessage('E37: No write since last change (add ! to override)');
        else closeVim();
    } else if (cmd !== '') {
        vimMessage(`E492: Not an editor command: ${cmd}`);
    } else {
        renderVim();
    }
}

function vimHandleKey(e) {
    const { key } = e;
    const { cursor, lines } = vim;

    if (vim.mode === 'command') {
        if      (key === 'Escape')    { vim.mode = 'normal'; vim.cmd = ''; renderVim(); }
        else if (key === 'Backspace') { vim.cmd = vim.cmd.slice(0, -1); renderVim(); }
        else if (key === 'Enter')     { const c = vim.cmd; vim.mode = 'normal'; vim.cmd = ''; vimRunCommand(c); }
        else if (key.length === 1)    { vim.cmd += key; renderVim(); }
        e.stopPropagation(); e.preventDefault(); return;
    }

    if (vim.mode === 'insert') {
        if (key === 'Escape') {
            vim.mode = 'normal';
            cursor.col = Math.max(0, cursor.col - 1);
            renderVim();
        } else if (key === 'ArrowLeft') {
            if (cursor.col > 0) { cursor.col--; renderVim(); }
        } else if (key === 'ArrowRight') {
            if (cursor.col < lines[cursor.line].length) { cursor.col++; renderVim(); }
        } else if (key === 'ArrowUp') {
            if (cursor.line > 0) { cursor.line--; cursor.col = Math.min(cursor.col, lines[cursor.line].length); vimScrollToCursor(); renderVim(); }
        } else if (key === 'ArrowDown') {
            if (cursor.line < lines.length - 1) { cursor.line++; cursor.col = Math.min(cursor.col, lines[cursor.line].length); vimScrollToCursor(); renderVim(); }
        } else if (key === 'Backspace') {
            if (cursor.col > 0) {
                lines[cursor.line] = lines[cursor.line].slice(0, cursor.col - 1) + lines[cursor.line].slice(cursor.col);
                cursor.col--;
            } else if (cursor.line > 0) {
                const prevLen = lines[cursor.line - 1].length;
                lines[cursor.line - 1] += lines[cursor.line];
                lines.splice(cursor.line, 1);
                cursor.line--;
                cursor.col = prevLen;
            } else {
                e.stopPropagation(); e.preventDefault(); return;
            }
            vim.dirty = true;
            vimScrollToCursor();
            renderVim();
        } else if (key === 'Enter') {
            const rest = lines[cursor.line].slice(cursor.col);
            lines[cursor.line] = lines[cursor.line].slice(0, cursor.col);
            lines.splice(cursor.line + 1, 0, rest);
            cursor.line++;
            cursor.col = 0;
            vim.dirty = true;
            vimScrollToCursor();
            renderVim();
        } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            lines[cursor.line] = lines[cursor.line].slice(0, cursor.col) + key + lines[cursor.line].slice(cursor.col);
            cursor.col++;
            vim.dirty = true;
            renderVim();
        }
        e.stopPropagation(); e.preventDefault(); return;
    }

    // normal mode
    const clampCol = () => { cursor.col = Math.min(cursor.col, Math.max(0, lines[cursor.line].length - 1)); };
    if      (key === 'ArrowDown' || key === 'j') { if (cursor.line < lines.length - 1) { cursor.line++; clampCol(); vimScrollToCursor(); renderVim(); } }
    else if (key === 'ArrowUp'   || key === 'k') { if (cursor.line > 0) { cursor.line--; clampCol(); vimScrollToCursor(); renderVim(); } }
    else if (key === 'ArrowLeft' || key === 'h') { if (cursor.col > 0) { cursor.col--; renderVim(); } }
    else if (key === 'ArrowRight'|| key === 'l') { if (cursor.col < Math.max(0, lines[cursor.line].length - 1)) { cursor.col++; renderVim(); } }
    else if (key === '0') { cursor.col = 0; renderVim(); }
    else if (key === '$') { cursor.col = Math.max(0, lines[cursor.line].length - 1); renderVim(); }
    else if (key === 'G') { cursor.line = lines.length - 1; cursor.col = 0; vimScrollToCursor(); renderVim(); }
    else if (key === 'g' && vim.pendingG) { cursor.line = 0; cursor.col = 0; vim.top = 0; renderVim(); }
    else if (key === 'g') { vim.pendingG = true; e.stopPropagation(); return; }
    else if (key === ':') { vim.mode = 'command'; vim.cmd = ''; renderVim(); e.preventDefault(); }
    else if (key === 'i' || key === 'a') {
        if (!vim.editable) { vimMessage(`E21: Cannot make changes, 'modifiable' is off`); }
        else {
            if (key === 'a') cursor.col = Math.min(cursor.col + 1, lines[cursor.line].length);
            vim.mode = 'insert';
            renderVim();
        }
    }

    vim.pendingG = false;
    e.stopPropagation();
}
