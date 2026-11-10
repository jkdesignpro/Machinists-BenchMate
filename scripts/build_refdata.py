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


# ---------------------------------------------------------------- other threads, tapers
def frac_in(s):
    """'1 1/8' -> 1.125; '3/8' -> 0.375; '2' -> 2."""
    return float(sum(Fraction(p) for p in s.split()))


def build_series(sec, fields, order=frac_in):
    """sec: {publisher: {size: {field: printed}}} -> [{size, field: consensus...}] in size order."""
    sizes = set()
    for rows in sec.values(): sizes.update(rows)
    out = []
    for s in sorted(sizes, key=order):
        row = {'size': s}
        for f in fields:
            printed = {pub: rows[s][f] for pub, rows in sec.items() if s in rows and rows[s].get(f) not in (None, '')}
            if printed: row[f] = consensus(printed) if all(is_num(v) for v in printed.values()) else text_consensus(printed)
        out.append(row)
    return out


def is_num(v):
    try: float(v); return True
    except ValueError: return False


def text_consensus(printed):
    """Non-numeric values (thread designations): equal when the same text, ignoring case and spaces."""
    groups = {}
    for pub, v in printed.items():
        groups.setdefault(str(v).replace(' ', '').lower(), {'value': str(v), 'publishers': [], 'printed': []})
        g = groups[str(v).replace(' ', '').lower()]; g['publishers'].append(pub); g['printed'].append(str(v))
    gs = sorted(groups.values(), key=lambda g: -len(g['publishers']))
    strong = [g for g in gs if len(g['publishers']) >= 2]
    status = ('confirmed' if len(gs[0]['publishers']) >= 2 else 'review') if len(gs) == 1 else 'confirmed_with_outlier' if len(strong) == 1 else 'differs'
    return {'value': gs[0]['value'], 'status': status, 'groups': gs}


def build_other_threads():
    ev = json.loads((EV / 'threads-other-evidence.json').read_text())
    out = {'sources': sources_of(ev)}
    out['bsp'] = build_series(ev['bsp'], ['tpi', 'major_mm'])
    g = {pub: {s: {'gauge_mm': v} for s, v in rows.items()} for pub, rows in ev['iso7_gauge_mm'].items()}
    gauge = {r['size']: r['gauge_mm'] for r in build_series(g, ['gauge_mm'])}
    for r in out['bsp']:
        if r['size'] in gauge: r['gauge_mm'] = gauge[r['size']]
    out['npt'] = build_series(ev['npt'], ['tpi', 'od', 'l1', 'e1', 'l2'])
    out['bsw'] = build_series(ev['bsw'], ['tpi'])  # dimensions: BS 84 formula; printed values are checked in core tests
    out['bsf'] = build_series(ev['bsf'], ['tpi'])
    if ev.get('ba'):
        out['ba'] = build_series(ev['ba'], ['tpi'], order=lambda s: int(s))
    return out


def build_tapers():
    p = EV / 'tapers-evidence.json'
    if not p.exists(): return None
    ev = json.loads(p.read_text())
    out = {'sources': sources_of(ev), 'families': {}}
    for fam, sec in ev['families'].items():
        if fam.startswith('_'): continue
        fields = sorted({f for rows in sec.values() for r in rows.values() for f in r})
        ordr = ev.get('order', {}).get(fam, [])
        out['families'][fam] = build_series(sec, fields, order=lambda s, o=ordr: (o.index(s) if s in o else len(o), s))
    out['notes'] = ev.get('notes', {})
    return out


# ---------------------------------------------------------------- round 3: codes, groups, tables
def is_rng(v):
    """'0.05-0.152' or '12.5' (all parts numeric)."""
    return all(is_num(x) for x in str(v).split('-')) if str(v) else False


def agree_rng(a, b):
    pa, pb = str(a).split('-'), str(b).split('-')
    return len(pa) == len(pb) and all(agree(x, y) for x, y in zip(pa, pb))


def any_consensus(printed):
    """Numbers and ranges (a-b) are equal at the coarser printed precision; text by id."""
    if not all(is_rng(v) for v in printed.values()): return text_consensus(printed)
    groups = []
    for pub, v in printed.items():
        for g in groups:
            if agree_rng(g['printed'][0], v): g['publishers'].append(pub); g['printed'].append(str(v)); break
        else: groups.append({'value': str(v), 'publishers': [pub], 'printed': [str(v)]})
    for g in groups:
        # show the plainest printing: inch prints converted to mm carry extra decimals
        g['value'] = sorted(g['printed'], key=lambda x: (sum(decimals(y) for y in x.split('-')), -g['printed'].count(x)))[0]
    groups.sort(key=lambda g: -len(g['publishers']))
    strong = [g for g in groups if len(g['publishers']) >= 2]
    status = ('confirmed' if len(groups[0]['publishers']) >= 2 else 'review') if len(groups) == 1 else 'confirmed_with_outlier' if len(strong) == 1 else 'differs'
    return {'value': groups[0]['value'], 'status': status, 'groups': groups}


def build_codes(sec):
    """sec: {publisher: {code: printed}} -> {code: consensus}."""
    codes = []
    for rows in sec.values():
        for c in rows:
            if c not in codes: codes.append(c)
    return {c: any_consensus({pub: rows[c] for pub, rows in sec.items() if c in rows}) for c in codes}


def load_ev(name):
    p = EV / name
    return json.loads(p.read_text()) if p.exists() else None


def build_inserts():
    ev = load_ev('inserts-evidence.json')
    if not ev: return None
    return {'sources': sources_of(ev), 'insert': {k: build_codes(v) for k, v in ev['insert'].items()},
            'holder': {k: build_codes(v) for k, v in ev['holder'].items()}}


def build_iso513():
    ev = load_ev('iso513-evidence.json')
    return ev and {'sources': sources_of(ev), 'colour': build_codes(ev['colour'])}


def build_surface():
    ev = load_ev('surface-evidence.json')
    if not ev: return None
    return {'sources': sources_of(ev), 'n_ra': build_codes(ev['n_ra']), 'n_beside': ev['n_beside'], 'process_ra': build_codes(ev['process_ra'])}


def build_hardness():
    ev = load_ev('hardness-evidence.json')
    if not ev: return None
    hvs = sorted({float(h) for t in ev['tables'].values() for h in t})
    rows = []
    for hv in hvs:
        key = f"{hv:g}"
        hvc = any_consensus({pub: key for pub, t in ev['tables'].items() if key in t})
        row = {'hv': dict(hvc, value=hv, approx=False)}
        for f in ('uts', 'hb', 'hrb', 'hrc', 'hra'):
            printed = {pub: t[key][f] for pub, t in ev['tables'].items() if key in t and f in t[key]}
            if not printed: continue
            c = any_consensus({p: v.rstrip('*') for p, v in printed.items()})
            c['approx'] = any(v.endswith('*') for v in printed.values())
            c['value'] = float(c['value'])
            row[f] = c
        rows.append(row)
    return {'sources': sources_of(ev), 'rows': rows}


def build_knurl():
    ev = load_ev('knurl-evidence.json')
    if not ev: return None
    pubs = collections.defaultdict(list)
    for pub, lst in ev['pitches_mm'].items():
        for v in lst: pubs[float(v)].append(pub)
    return {'sources': sources_of(ev), 'pitches_mm': [{'p': p, 'publishers': pubs[p], 'status': 'confirmed' if len(pubs[p]) >= 2 else 'review'} for p in sorted(pubs)],
            'pitches_dp': [float(x) for x in ev['pitches_dp']['DORIAN']], 'din403_mm': [float(x) for x in ev['din403_mm']]}


def build_grinding():
    """Grit sizes (um) per system and wheel marking letters, each with publisher consensus."""
    ev = load_ev('grinding-evidence.json')
    if not ev: return None
    return {'sources': sources_of(ev), 'note': ev.get('_note', ''),
            'grit_um': {sysname: build_codes(sec) for sysname, sec in ev['grit_um'].items()},
            'abrasive': build_codes(ev['abrasive']), 'bond': build_codes(ev['bond']),
            'grit_group': build_codes(ev['grit_group']), 'grade_scale': any_consensus(ev['grade_scale']),
            'grade_group': ev['grade_group'],
            'structure_low': any_consensus({k: v['low'] for k, v in ev['structure'].items()}),
            'structure': ev['structure'], 'order': ev['order']}


def main():
    out = {'schema': 1, 'drills': build_drills(), 'threads': build_threads(), 'iso286': build_iso286(),
           'other_threads': build_other_threads(), 'tapers': build_tapers(), 'inserts': build_inserts(), 'iso513': build_iso513(),
           'surface': build_surface(), 'hardness': build_hardness(), 'knurl': build_knurl(),
           'grinding': build_grinding()}
    for sec in ('other_threads', 'tapers'):
        if not out[sec]: continue
        for k, rows in out[sec].items():
            if k in ('sources', 'notes'): continue
            for r in (rows.values() if isinstance(rows, dict) else [rows]):
                for row in (r if isinstance(r, list) else []):
                    for f, c in row.items():
                        if isinstance(c, dict) and c['status'] not in ('confirmed', 'review'):
                            print(' ', sec, k, row['size'], f, c['status'], c['groups'])
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
    for sec, parts in (('inserts', ('insert', 'holder')), ('iso513', ('colour',)), ('surface', ('n_ra', 'process_ra'))):
        for part in parts:
            sub = out[sec][part]
            for k, codes in (sub.items() if part in ('insert', 'holder') else [(part, sub)]):
                st = collections.Counter(c['status'] for c in codes.values())
                print(' ', sec, k, dict(st), [(code, [(g['value'], g['publishers']) for g in c['groups']]) for code, c in codes.items() if c['status'] in ('differs', 'confirmed_with_outlier')])
    hs = collections.Counter(c['status'] for r in out['hardness']['rows'] for f, c in r.items() if f != 'hv')
    print('  hardness cells', dict(hs), [(r['hv']['value'], f, [(g['value'], g['publishers']) for g in c['groups']]) for r in out['hardness']['rows'] for f, c in r.items() if f != 'hv' and c['status'] not in ('confirmed', 'review')])
    g = out['grinding']
    for k in ('abrasive', 'bond', 'grit_group'):
        print('  grinding', k, dict(collections.Counter(c['status'] for c in g[k].values())), [(code, [(x['value'], x['publishers']) for x in c['groups']]) for code, c in g[k].items() if c['status'] in ('differs', 'confirmed_with_outlier')])
    for k, codes in g['grit_um'].items():
        print('  grit', k, dict(collections.Counter(c['status'] for c in codes.values())))
    print('  knurl pitches', [(x['p'], x['status']) for x in out['knurl']['pitches_mm']])


if __name__ == '__main__':
    main()
