#!/usr/bin/env python3
"""Build app/data/searchindex.json: the headed sections inside each tool page, for the top-bar search.

The search looks at tool titles first; this index adds what is inside a page (the guides' section and
sub-section headings), so a search for "V-blocks" or "tool signature" finds the guide and jumps to the
section. Only headings with an id are indexed (they are the places a link can jump to), never body text,
so a common word such as "speed" does not return hundreds of hits.

How a heading is tied to its tool: each heading belongs to the nearest top-level `function name(` above it
in its file, and app/tools.js says which tool renders with that function (`render: el => name(el)`).
Helpers that a render function calls (for example a guide split into parts) are followed one level.
"""
import io, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
APP = os.path.join(ROOT, 'app')

def rd(p):
    return io.open(p, encoding='utf-8').read()

def strip_tags(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'").replace("\\'", "'")
    return re.sub(r'\s+', ' ', s).strip()

tools = rd(os.path.join(APP, 'tools.js'))
render_of = {}
for m in re.finditer(r"id: '([a-z0-9_-]+)'[^\n]*\n(?:(?!\n\{\n)[\s\S])*?render: (?:el|\(el[^)]*\)) => (\w+)\(", tools):
    render_of.setdefault(m.group(2), m.group(1))

func_re = re.compile(r'^(?:async )?function (\w+)\s*\(', re.M)
head_re = re.compile(r"<h([23])(?: class=\\?\"[^\"]*\\?\")? id=\\?\"([\w-]+)\\?\"(?: class=\\?\"[^\"]*\\?\")?>(.*?)</h\1>")
calls = {}      # function -> functions it calls (same app)
heads = {}      # function -> [(level, id, text)]
for fn in sorted(os.listdir(APP)):
    if not fn.endswith('.js'):
        continue
    src = rd(os.path.join(APP, fn))
    starts = [(m.start(), m.group(1)) for m in func_re.finditer(src)]
    for i, (pos, name) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(src)
        body = src[pos:end]
        calls[name] = set(re.findall(r'\b(\w+)\(', body))
        hs = [(int(m.group(1)), m.group(2), strip_tags(m.group(3))) for m in head_re.finditer(body)]
        if hs:
            heads.setdefault(name, []).extend(hs)

index = {}
for func, tool in render_of.items():
    seen, out = set(), []
    for f in [func] + sorted(calls.get(func, ())):
        for lv, hid, txt in heads.get(f, []):
            if hid in seen or not txt or txt.lower() == 'sources':
                continue
            seen.add(hid)
            out.append([hid, txt, lv])
    if out:
        index[tool] = out

dst = os.path.join(APP, 'data', 'searchindex.json')
os.makedirs(os.path.dirname(dst), exist_ok=True)
with io.open(dst, 'w', encoding='utf-8') as fh:
    json.dump(index, fh, ensure_ascii=False, separators=(',', ':'))
n = sum(len(v) for v in index.values())
print('search index: %d headings in %d tools' % (n, len(index)))
