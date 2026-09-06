if (window.marked) marked.setOptions({ breaks: true });

async function guiGo(section, slug = null) {
    const page = document.getElementById('gui-page');
    if (!page) return;
    if (section === 'blog' && !slug) {
        const blog = await (await fetch('vfs/blog/blog.json')).json();
        const list = (name, posts) => `<h2>${name}</h2>` + posts
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(p => `<a class="gui-post" href="#" onclick="guiGo('blog','${name}/${p.slug}');return false">
                <b>${p.title}</b><span>${p.date}</span><small>${p.description}</small></a>`).join('');
        page.innerHTML = list('posts', blog.posts) + list('journal', blog.journal);
    } else if (section === 'blog' && slug) {
        const text = await fetchFile(`vfs/blog/${slug}.md`);
        page.innerHTML = `<button class="gui-back" onclick="guiGo('blog')">← back</button>`
            + (window.marked ? marked.parse(text || '') : `<pre>${text}</pre>`);
    } else {
        const srcMap = { home: 'vfs/README.md', 'about-me': 'vfs/about-me/README.md', projects: 'vfs/projects/README.md' };
        const text = await fetchFile(srcMap[section] || 'vfs/README.md');
        page.innerHTML = window.marked ? marked.parse(text || '') : `<pre>${text}</pre>`;
    }
}

// Maps the terminal's current directory to the matching GUI section.
function guiGoFromCwd() {
    if (cwd.startsWith('/about-me')) guiGo('about-me');
    else if (cwd.startsWith('/projects')) guiGo('projects');
    else if (cwd.startsWith('/blog')) guiGo('blog');
    else guiGo('home');
}

// ── GUI window drag ───────────────────────────────────────────────────────────

let drag = { on: false, x: 0, y: 0 };

document.getElementById('gui-titlebar').addEventListener('mousedown', e => {
    drag.on = true;
    drag.x = e.clientX - guiWindow.offsetLeft;
    drag.y = e.clientY - guiWindow.offsetTop;
    e.preventDefault();
});
let resize = { on: false, startX: 0, startY: 0, startW: 0, startH: 0 };

document.getElementById('gui-resize').addEventListener('mousedown', e => {
    resize.on = true;
    resize.startX = e.clientX;
    resize.startY = e.clientY;
    resize.startW = guiWindow.offsetWidth;
    resize.startH = guiWindow.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('mousemove', e => {
    if (drag.on) {
        guiWindow.style.left = (e.clientX - drag.x) + 'px';
        guiWindow.style.top  = (e.clientY - drag.y) + 'px';
    }
    if (resize.on) {
        guiWindow.style.width  = Math.max(280, resize.startW + e.clientX - resize.startX) + 'px';
        guiWindow.style.height = Math.max(200, resize.startH + e.clientY - resize.startY) + 'px';
    }
});
document.addEventListener('mouseup', () => { drag.on = false; resize.on = false; });
document.getElementById('gui-close').addEventListener('click', () => {
    guiWindow.classList.add('hidden');
});