# ev3rshade.com

vanilla js terminal website — blue and white pixel aesthetic with plants

## file structure

```
ev3rshade.com/
├── index.html                  # single-page app, all overlays live here
│
├── css/
│   └── style.css               # all styles (terminal, vim overlay, GUI window, mobile)
│
├── js/
│   ├── vfs.js                  # virtual filesystem (FS map, resolvePath, fetchFile)
│   ├── execute.js              # command implementations (ls, cd, cat, grep, wc, find,
│   │                           # plant, clear, theme, help, gui-please, ca)
│   ├── terminal.js             # input loop, tab-complete, history, prompt, DOMContentLoaded init
│   ├── vim.js                  # read-only vim viewer overlay (:q to quit, hjkl/gg/G//)
│   └── gui.js                  # floating GUI window (drag, resize, markdown pages)
│
├── fonts/
│   ├── DotGothic16/            # pixel font (fallback)
│   └── Fira_Code/              # monospace font (primary)
│
├── vfs/                        # content served as the virtual filesystem
│   ├── README.md               # home page (shown on load and on `cd ~`)
│   ├── termrc                  # startup config (PROMPT, THEME), exposed as /.termrc
│   ├── manifest.json           # generated — structural tree of vfs/, fetched at runtime
│   ├── about-me/README.md
│   ├── projects/README.md
│   └── blog/
│       ├── README.md
│       ├── blog.json           # generated — { posts: [...], journal: [...] }, each entry
│       │                       # { slug, title, date, description }
│       ├── posts/*.md          # named essays
│       └── journal/*.md        # dated thought dumps
│
├── sync-filesystem.js          # node script — regenerates vfs/manifest.json + vfs/blog/blog.json
├── wrangler.jsonc              # Cloudflare Workers / Pages config
└── README.md
```

## how the terminal works

The site is a fake shell running entirely in the browser. There is no server-side execution.

### virtual filesystem

[js/vfs.js](js/vfs.js) defines `FS`, a plain JS object that maps absolute paths to nodes:

```js
{ type: 'dir',  children: ['README.md', 'about-me', ...] }
{ type: 'file', src: 'vfs/about-me/README.md' }   // real fetch path
```

`FS` starts empty and is built up at runtime (see `initFS()` below) rather than hand-listed in `vfs.js` — new files under `vfs/` show up automatically after a `sync-filesystem.js` run, with no code changes.

`resolvePath(p)` resolves `.` / `..` / relative paths against `cwd`.  
`fetchFile(src)` fetches the file over HTTP. `vfs/termrc` is also checked in `localStorage` first (allows per-user overrides).

### startup sequence

1. `DOMContentLoaded` fires in [js/terminal.js](js/terminal.js)
2. `initFS()` fetches `vfs/manifest.json` (the auto-discovered directory tree) into `FS`, then fetches `blog.json` and populates `/blog/posts` and `/blog/journal` — these two stay separate from the manifest since they carry title/date/description metadata the GUI blog list needs
3. `parseTermrc()` fetches `vfs/termrc`, applies `PROMPT` and `THEME`
4. `vfs/README.md` is fetched and printed as the welcome screen

### commands

| command | description |
|---|---|
| `ls [path]` | list directory contents |
| `cd <dir>` | change directory; auto-prints `README.md` if present |
| `cat <file>` | print file contents |
| `grep <pattern> <file>` | case-insensitive line search |
| `wc <file>` | line / word / char count |
| `find [path] [-name <pat>] [-type f\|d]` | walk the virtual fs |
| `vim <file>` | read-only viewer (`:q` quit, `hjkl` move, `gg`/`G` top/bottom, `/` search) |
| `plant` | grow an animated ASCII plant garden |
| `clear` | clear output + stop plant animations |
| `theme [light\|dark]` | toggle or set color theme |
| `gui-please` | open the floating GUI window |
| `help` | print command list |

**Tab completion** works for both command names and file/directory paths.  
**History** is navigable with ↑ / ↓.

### GUI window

`gui-please` opens a draggable, resizable floating window ([js/gui.js](js/gui.js)) that renders the same `vfs/` markdown content visually. On mobile it opens full-screen.

### theming

Colors are CSS custom properties (`--bg`, `--fg`, `--dim`, etc.) defined in [css/style.css](css/style.css) and toggled via `body.dark`. The default theme is read from `vfs/termrc` (`export THEME="dark"`). The user's preference is persisted in `localStorage`.

### adding content

Run `node sync-filesystem.js` after adding/removing/renaming any file under `vfs/` — it regenerates `vfs/manifest.json` (and `vfs/blog/blog.json`) from what's actually on disk. Both are committed, since the static site fetches them over HTTP at runtime rather than reading the filesystem live.

**Blog posts / journal entries:**

1. Write a markdown file in `vfs/blog/posts/` (named essays) or `vfs/blog/journal/` (dated thought dumps)
2. Run `node sync-filesystem.js` — new files are added to the matching `blog.json` section with a default `title`/`date`/`description` (edit those in by hand afterward); files removed from disk are dropped from `blog.json` automatically
3. The entry will appear in `ls /blog/posts` or `ls /blog/journal`, `cat`, vim, and the GUI blog list

**Everything else** (`about-me/`, `projects/`, new top-level pages): just add/edit the file under `vfs/` and run `node sync-filesystem.js` — no `vfs.js` edits needed.


## Sections that Have been Vibe Coded
1. Vim - I did not code any of the vim implementation

2. Parts of README - the file structure and the command table.

3. The plant script -- every website iteration I try to get Claude to make generated plants. I think it's an interesting exercise and find it a little silly.

4. termrc functionality

5. CSS styling. However, I designed the color palette and ascii art and picked the fonts.
