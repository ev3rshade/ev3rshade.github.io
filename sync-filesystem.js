import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname     = dirname(fileURLToPath(import.meta.url));
const vfsDir         = resolve(__dirname, 'vfs');
const manifestPath   = resolve(vfsDir, 'manifest.json');
const blogDir        = resolve(vfsDir, 'blog');
const blogJsonPath   = resolve(blogDir, 'blog.json');

// ── manifest.json: structural tree of vfs/, auto-discovered from disk ─────────
//
// vfs/blog/posts/ and vfs/blog/journal/ are left opaque (their file listings
// are populated at runtime from blog.json, which also carries title/date/
// description metadata for each section).
// vfs/termrc is exposed as the dotfile /.termrc (unix startup-config convention).

const ROOT_ALIASES = { termrc: '.termrc' };
const OPAQUE_DIRS  = new Set(['blog/posts', 'blog/journal']);

async function walk(relDir, manifest) {
    const absDir  = relDir ? `${vfsDir}/${relDir}` : vfsDir;
    const entries = (await readdir(absDir, { withFileTypes: true }))
        .filter(e => !(relDir === '' && e.name === 'manifest.json'))
        .filter(e => !(relDir === 'blog' && e.name === 'blog.json'))
        .sort((a, b) => a.name.localeCompare(b.name));

    const children = [];
    for (const entry of entries) {
        const realRel = relDir ? `${relDir}/${entry.name}` : entry.name;
        const exposed = relDir === '' ? (ROOT_ALIASES[entry.name] || entry.name) : entry.name;
        const fsPath  = relDir ? `/${relDir}/${exposed}` : `/${exposed}`;
        children.push(exposed);

        if (entry.isDirectory()) {
            if (OPAQUE_DIRS.has(realRel)) manifest[fsPath] = { type: 'dir', children: [] };
            else await walk(realRel, manifest);
        } else {
            manifest[fsPath] = { type: 'file', src: `vfs/${realRel}` };
        }
    }

    manifest[relDir ? `/${relDir}` : '/'] = { type: 'dir', children };
}

const manifest = {};
await walk('', manifest);
await writeFile(manifestPath, JSON.stringify(manifest, null, 4) + '\n');

// ── blog.json: metadata index for vfs/blog/{posts,journal}/, kept in sync with disk ─

const datePattern = /^\d{4}-\d{2}-\d{2}/;

async function syncSection(name, existing) {
    const files     = await readdir(resolve(blogDir, name));
    const diskSlugs = files.filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
    const jsonSlugs = new Set(existing.map(p => p.slug));

    const kept = existing.filter(p => diskSlugs.includes(p.slug));
    const removed = existing.length - kept.length;

    const added = [];
    for (const slug of diskSlugs) {
        if (!jsonSlugs.has(slug)) {
            const dateMatch = slug.match(datePattern);
            kept.push({ slug, title: slug, date: dateMatch ? dateMatch[0] : '', description: '' });
            added.push(slug);
        }
    }

    kept.sort((a, b) => b.date.localeCompare(a.date));
    return { entries: kept, removed, added };
}

let blog = { posts: [], journal: [] };
try { blog = JSON.parse(await readFile(blogJsonPath, 'utf-8')); } catch {}

const sections = {};
for (const name of ['posts', 'journal']) sections[name] = await syncSection(name, blog[name] || []);

await writeFile(blogJsonPath, JSON.stringify({
    posts:   sections.posts.entries,
    journal: sections.journal.entries,
}, null, 4) + '\n');

console.log('vfs/manifest.json regenerated.');
for (const name of ['posts', 'journal']) {
    const { removed, added } = sections[name];
    if (removed > 0) console.log(`[${name}] removed ${removed} entr${removed === 1 ? 'y' : 'ies'} with no matching .md file.`);
    if (added.length > 0) console.log(`[${name}] added ${added.length} new entr${added.length === 1 ? 'y' : 'ies'}: ${added.join(', ')}`);
    if (removed === 0 && added.length === 0) console.log(`[${name}] already in sync.`);
}
