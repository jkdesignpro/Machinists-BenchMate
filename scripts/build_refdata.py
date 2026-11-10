#!/usr/bin/env python3
"""Build app reference data (data/refdata.json) from the evidence files in data/refdata/.

Evidence = what each free publisher prints, transcribed with URL and access date.
Nothing is typed in from memory. For every value this script works out which
values the publishers print and how many independent publishers print each:
  confirmed - the top value is printed by 2+ independent publishers and no
              other value has 2+ publishers
  differs   - publishers print different values (all shown; the value with
              most publishers first)
  review    - only one publisher so far
Computed quantities (thread dimensions, tolerances, fits) are not stored here:
the app computes them with the Rust core.
Run: python3 scripts/build_refdata.py
"""
import json, pathlib, collections
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parent.parent
EV = ROOT / "data" / "refdata"


def decimals(s):
    s = str(s)
    return len(s.split('.')[1]) if '.' in s else 0


def agree(a, b):
    """Printed decimals agree when equal to the precision of the coarser printing."""
    dp = min(decimals(a), decimals(b))
    return abs(float(a) - float(b)) <= 0.5 * 10 ** -dp + 1e-12


def consensus(printed):
    """printed: {publisher: value-as-printed}. Returns dict with value, status, groups."""
    groups = []  # [{value, publishers, printed}]
    for pub, v in printed.items():
        for g in groups:
            if agree(g['value'], v):
                g['publishers'].append(pub); g['printed'].append(str(v)); break
        else:
            groups.append({'value': str(v), 'publishers': [pub], 'printed': [str(v)]})
    for g in groups:  # show the most common printing, then the most precise
        c = collections.Counter(g['printed'])
        g['value'] = sorted(c, key=lambda x: (-c[x], -decimals(x)))[0]
    groups.sort(key=lambda g: -len(g['publishers']))
    strong = [g for g in groups if len(g['publishers']) >= 2]
    if len(groups) == 1:
        status = 'confirmed' if len(groups[0]['publishers']) >= 2 else 'review'
    elif len(strong) == 1:
        status = 'confirmed_with_outlier'
    else:
        status = 'differs'
    return {'value': float(groups[0]['value']), 'status': status,
            'groups': [{'value': float(g['value']), 'publishers': g['publishers'], 'printed': g['printed']} for g in groups]}


def sources_of(ev):
    return {k: dict(v) for k, v in ev['sources'].items()}


# ---------------------------------------------------------------- drills
def build_drills():
    ev = json.loads((EV / 'drills-evidence.json').read_text())
    out = []
    for kind in ('number', 'letter'):
        names = set()
        for pub in ev[kind].values(): names.update(pub)
        for n in names:
            printed = {pub: vals[n] for pub, vals in ev[kind].items() if n in vals}
            c = consensus(printed)
            out.append(dict(kind=kind, name=('#' + n) if kind == 'number' else n, inch=c['value'], status=c['status'], groups=c['groups']))
    for i in range(1, 129):  # fractional: n/64 in up to 2 in, exact by definition
        f = Fraction(i, 64)
        whole, rem = divmod(f.numerator, f.denominator)
        name = (f"{whole} " if whole else "") + (f"{rem}/{f.denominator}" if rem else "")
        out.append(dict(kind='fraction', name=name.strip() + '"', inch=float(f), status='exact', groups=[]))
    mm_pubs = collections.defaultdict(list)
    for pub, sizes in ev['metric_mm'].items():
        for s in sizes: mm_pubs[float(s)].append(pub)
    for mm, pubs in sorted(mm_pubs.items()):
        out.append(dict(kind='metric', name=f"{mm:g} mm", mm=mm, inch=mm / 25.4, status='confirmed' if len(pubs) >= 2 else 'listed',
                        groups=[{'value': mm, 'publishers': pubs, 'printed': []}]))
    out.sort(key=lambda d: d['inch'])
    return {'sources': sources_of(ev), 'drills': out}


# ---------------------------------------------------------------- threads
def size_in(s):
    if s.startswith('#'): return 0.060 + 0.013 * int(s[1:])
    if '-' in s: w, fr = s.split('-'); return int(w) + float(Fraction(fr))
    return float(Fraction(s))


def build_threads():
    ev = json.loads((EV / 'threads-evidence.json').read_text())
    metric = collections.OrderedDict()
    for pub, rows in ev['metric'].items():
        for d, r in rows.items():
            if r.get('coarse'): metric.setdefault((float(d), float(r['coarse']), 'coarse'), []).append(pub)
            for p in r.get('fine', []): metric.setdefault((float(d), float(p), 'fine'), []).append(pub)
    m = [dict(d=d, p=p, series=s, publishers=pubs, status='confirmed' if len(pubs) >= 2 else 'review')
         for (d, p, s), pubs in sorted(metric.items())]
    uni = collections.OrderedDict()
    for pub, rows in ev['unified'].items():
        for size, r in rows.items():
            dmaj = size_in(size)
            if abs(float(r['major']) - dmaj) > 6e-5:
                raise SystemExit(f"{pub} prints major {r['major']} for {size}, formula {dmaj}")
            for ser in ('UNC', 'UNF', 'UNEF'):
                if r.get(ser): uni.setdefault((dmaj, size, ser, float(r[ser])), []).append(pub)
    u = [dict(d=d, size=size, series=ser, tpi=tpi, publishers=pubs, status='confirmed' if len(pubs) >= 2 else 'review')
         for (d, size, ser, tpi), pubs in sorted(uni.items())]
    # a size/series with two different TPI values printed would be a disagreement
    seen = collections.defaultdict(set)
    for x in u: seen[(x['size'], x['series'])].add(x['tpi'])
    for x in u: x['differs'] = len(seen[(x['size'], x['series'])]) > 1
    limits = {}
    for cls, pubs in ev['limits'].items():
        if cls.startswith('_'): continue
        sizes = set()
        for rows in pubs.values(): sizes.update(rows)
        limits[cls] = {}
        for s in sorted(sizes):
            fields = []
            for i in range(4):
                printed = {pub: f"{rows[s][i]:.3f}" for pub, rows in pubs.items() if s in rows}
                fields.append(consensus(printed))
            limits[cls][s] = fields
    return {'sources': sources_of(ev), 'metric': m, 'unified': u, 'limits': limits, 'limit_fields': ev['limits']['_fields']}


# ---------------------------------------------------------------- ISO 286
MAIN = ['0-3', '3-6', '6-10', '10-18', '18-30', '30-50', '50-80', '80-120', '120-180', '180-250', '250-315', '315-400', '400-500']
SUB = ['0-3', '3-6', '6-10', '10-14', '14-18', '18-24', '24-30', '30-40', '40-50', '50-65', '65-80', '80-100', '100-120',
       '120-140', '140-160', '160-180', '180-200', '200-225', '225-250', '250-280', '280-315', '315-355', '355-400', '400-450', '450-500']
SUB_LETTERS = set('a b c r s t u v x y z za zb zc'.split())


def build_iso286():
    ev = json.loads((EV / 'iso286-evidence.json').read_text())
    it = {}
    grades = sorted({g for pub in ev['it'].values() for g in pub}, key=lambda g: (-1 if g == 'IT01' else 0 if g == 'IT0' else int(g[2:])))
    for g in grades:
        it[g] = {}
        for r in MAIN:
            printed = {pub: repr(vals[g][r]) for pub, vals in ev['it'].items() if r in vals.get(g, {})}
            if printed: it[g][r] = consensus(printed)
    roy_letters = set(ev['checks']['ROYMECH']['letters'].split())
    shaft = {}
    letters = sorted({l for pub in ev['shaft'].values() for l in pub})
    for l in letters:
        shaft[l] = {}
        keys = SUB if l in SUB_LETTERS else MAIN
        for r in keys:
            printed = {}
            for pub, vals in ev['shaft'].items():
                v = vals.get(l, {}).get(r)
                if v is None and l not in SUB_LETTERS: continue
                if v is None and l in SUB_LETTERS: continue
                printed[pub] = repr(v)
            if 'GOST_25346' in printed and l in roy_letters and 'ROYMECH' not in printed:
                printed['ROYMECH'] = printed['GOST_25346']  # compared equal, not republished (see source note)
            if printed: shaft[l][r] = consensus(printed)
    return {'sources': sources_of(ev), 'main_steps': MAIN, 'sub_steps': SUB, 'sub_letters': sorted(SUB_LETTERS), 'it': it, 'shaft': shaft}


def main():
    out = {'schema': 1, 'drills': build_drills(), 'threads': build_threads(), 'iso286': build_iso286()}
    (ROOT / 'data' / 'refdata.json').write_text(json.dumps(out, separators=(',', ':')))
    d = out['drills']['drills']
    st = collections.Counter(x['status'] for x in d)
    print('drills', len(d), dict(st))
    for x in d:
        if x['status'] in ('differs', 'confirmed_with_outlier'): print('  drill', x['name'], x['groups'])
    t = out['threads']
    print('metric threads', len(t['metric']), 'unified', len(t['unified']))
    for cls, rows in t['limits'].items():
        for s, fs in rows.items():
            for i, f in enumerate(fs):
                if f['status'] not in ('confirmed', 'review'): print('  limit', cls, s, t['limit_fields'][cls][i], f['groups'])
    iso = out['iso286']
    for g, rows in iso['it'].items():
        for r, c in rows.items():
            if c['status'] != 'confirmed': print('  IT', g, r, c['status'], c['groups'])
    n = collections.Counter(c['status'] for l in iso['shaft'].values() for c in l.values())
    print('shaft deviations', dict(n))


if __name__ == '__main__':
    main()
