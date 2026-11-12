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
import json, pathlib, collections, re
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
# Over 500 to 3150 mm (ISO 286-1:2010 Tables 1 to 3; added in inspection round 2).
MAIN_LARGE = ['500-630', '630-800', '800-1000', '1000-1250', '1250-1600', '1600-2000', '2000-2500', '2500-3150']
SUB_LARGE = ['500-560', '560-630', '630-710', '710-800', '800-900', '900-1000', '1000-1120', '1120-1250', '1250-1400',
             '1400-1600', '1600-1800', '1800-2000', '2000-2240', '2240-2500', '2500-2800', '2800-3150']
MAIN = MAIN + MAIN_LARGE
SUB = SUB + SUB_LARGE
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
            if 'GOST_25346' in printed and l in roy_letters and 'ROYMECH' not in printed and r not in MAIN_LARGE + SUB_LARGE:
                printed['ROYMECH'] = printed['GOST_25346']  # compared equal, not republished (see source note)
            if printed: shaft[l][r] = consensus(printed)
    # Over 500 mm only one table each was read (Wikipedia for IT, GOST 25346 for the shafts). The ISO 286-1
    # formulas for that range (core/src/inspect.rs, tests iso286_large_*) reproduce every one of these values
    # within the standard's rounding, so a single-table value there is marked 'table_formula', not 'confirmed'.
    for sec in (it, shaft):
        for rows in sec.values():
            for r, c in rows.items():
                if r in MAIN_LARGE + SUB_LARGE and c['status'] == 'review': c['status'] = 'table_formula'
    # j and J: tabulated per tolerance class (no formula). Shafts: ei (es = ei + IT); holes: ES (EI = ES - IT).
    j_shaft, j_hole = {}, {}
    for key, out, dev in (('j_shaft', j_shaft, 'ei'), ('j_hole', j_hole, 'ES')):
        for pub, classes in ev.get(key, {}).items():
            for cls, rows in classes.items():
                for r, v in rows.items():
                    out.setdefault(cls, {}).setdefault(r, {})[pub] = repr(v[dev])
        for cls, rows in out.items():
            for r in list(rows): rows[r] = consensus(rows[r])
    return {'sources': sources_of(ev), 'main_steps': MAIN, 'sub_steps': SUB, 'sub_letters': sorted(SUB_LETTERS), 'it': it, 'shaft': shaft,
            'large_main_steps': MAIN_LARGE, 'j_shaft': j_shaft, 'j_hole': j_hole}


# ---------------------------------------------------------------- other threads, tapers
def frac_in(s):
    """'1 1/8' -> 1.125; '3/8' -> 0.375; '2' -> 2."""
    return float(sum(Fraction(p) for p in s.split()))


def build_series(sec, fields, order=frac_in, exact=False):
    """sec: {publisher: {size: {field: printed}}} -> [{size, field: consensus...}] in size order.
    exact=True: numbers agree only when equal (for dimensions where '14' means 14.0, not 13.5 to 14.5)."""
    sizes = set()
    for rows in sec.values(): sizes.update(rows)
    out = []
    for s in sorted(sizes, key=order):
        row = {'size': s}
        for f in fields:
            printed = {pub: rows[s][f] for pub, rows in sec.items() if s in rows and rows[s].get(f) not in (None, '')}
            if printed: row[f] = (exact_consensus if exact else consensus)(printed) if all(is_num(v) for v in printed.values()) else text_consensus(printed)
        out.append(row)
    return out


def exact_consensus(printed):
    """Like consensus(), but values agree only when numerically equal (14 and 14.0 agree, 14 and 13.5 do not)."""
    c = consensus({pub: f"{float(v):.6f}" for pub, v in printed.items()})
    for g in c['groups']:
        g['printed'] = [str(printed[p]) for p in g['publishers']]
    return c


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


def build_power_threads():
    """Threads round 3: ACME / Stub ACME series, trapezoidal rows, STI tapped holes, UN constant-pitch lists."""
    ev = load_ev('threads-power-evidence.json')
    if not ev: return None
    out = {'sources': sources_of(ev)}
    out['acme'] = build_series(ev['acme'], ['tpi'])
    out['stub_acme'] = build_series(ev['stub_acme'], ['tpi'])
    out['trap'] = build_series(ev['trap'], ['p', 'd2', 'd3', 'D1', 'D4'], order=lambda s: tuple(float(x) for x in s.split('x')))
    def unc_key(s):
        d = s.split('-')[0]
        return (0.060 + 0.013 * int(d)) if '/' not in d and '.' not in d and float(d) < 13 else frac_in(d)
    out['sti_unc'] = build_series(ev['sti_unc'], ['major_min', 'pd_min', 'pd_max_3b', 'pd_max_2b', 'minor_min', 'minor_max'], order=unc_key)
    out['sti_metric'] = build_series(ev['sti_metric'], ['pd_min', 'minor_min', 'minor_max'], order=lambda s: tuple(float(x) for x in s[1:].split('x')))
    if ev.get('unm'):
        out['unm'] = build_series(ev['unm'], ['p', 'd2', 'ext_major_min', 'ext_pd_min', 'ext_minor', 'ext_minor_min', 'int_minor', 'int_minor_max', 'int_pd_min', 'int_pd_max', 'int_major', 'int_major_max'], order=float)
    for k in ('un_const', 'uns'):
        if ev.get(k): out[k] = build_codes(ev[k])
    out['notes'] = ev.get('notes', {})
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


def build_centredrills():
    """Centre drills: inch plain and bell type (decimal inch, agree at the coarser printing) and
    metric types A, B, R (agree only when equal: '1.3' and '1.6' are different lengths)."""
    ev = load_ev('centredrills-evidence.json')
    if not ev: return None
    out = {'sources': sources_of(ev), 'families': {}, 'angles': ev.get('angles', {})}
    for fam, sec in ev['families'].items():
        fields = []
        for rows in sec.values():
            for r in rows.values():
                for f in r:
                    if f not in fields: fields.append(f)
        ordr = ev['order'][fam]
        out['families'][fam] = build_series(sec, fields, order=lambda s, o=ordr: (o.index(s) if s in o else len(o), s), exact=not fam.startswith('inch'))
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
            'pitches_dp': [float(x) for x in ev['pitches_dp']['DORIAN']], 'din403_mm': [float(x) for x in ev['din403_mm']],
            'pitches_dp_status': 'confirmed' if all(sorted(v) == sorted(ev['pitches_dp']['DORIAN']) for v in ev['pitches_dp'].values()) and len(ev['pitches_dp']) >= 2 else 'review',
            'pitches_dp_publishers': sorted(ev['pitches_dp']),
            'trial_steps': knurl_steps(ev), 'ansi_wheel_example': ev.get('ansi_wheel_example'),
            'print_example': ev.get('print_example'), 'not_used': ev.get('not_used', [])}


def knurl_steps(ev):
    """Tick-off steps of the trial and error method. Every source key must exist;
    a step with two or more independent publishers is 'confirmed', with one it is
    'single', with none it is BenchMate's own advice ('own'). The two pjsminilathe
    pages are one publisher."""
    out = []
    for st in ev.get('trial_steps', []):
        for k in st['src']:
            if k not in ev['sources']: raise SystemExit('knurl trial step: unknown source ' + k)
        pubs = {ev['sources'][k]['publisher'] for k in st['src']}
        out.append({'t': st['t'], 'why': st['why'], 'src': st['src'],
                    'status': 'confirmed' if len(pubs) >= 2 else 'single' if pubs else 'own'})
    return out


def build_gundrill():
    """Gun drilling starting values. One maker's tables (Sterling) with a second
    maker's ranges (botek) beside them for the steels; nothing is merged. Checks
    that the tables are complete and rise or fall the way such tables must."""
    ev = load_ev('gundrill-evidence.json')
    if not ev: return None
    S = ev['sources']
    def need(k):
        if k not in S: raise SystemExit('gundrill: unknown source ' + k)
    for sec in ('speed_sfm', 'feed_in_rev', 'coolant', 'botek', 'unisig_flow'): need(ev[sec]['src'])
    cols = ev['feed_in_rev']['columns']
    for g in ev['speed_sfm']['groups']:
        if g['feed'] not in cols: raise SystemExit('gundrill: feed column of ' + g['id'])
        for r in g['rows']:
            if not (r[1] > r[2] > 0): raise SystemExit('gundrill: speed row ' + g['id'] + ' ' + r[0])
        hp = [r[1] for r in g['rows']]
        if hp != sorted(hp, reverse=True): raise SystemExit('gundrill: speeds of ' + g['id'] + ' should fall with hardness')
    fr = ev['feed_in_rev']['rows']
    if any(len(r) != 7 for r in fr) or [r[0] for r in fr] != sorted(r[0] for r in fr): raise SystemExit('gundrill: feed rows')
    for c in range(1, 7):
        v = [r[c] for r in fr]
        if v != sorted(v): raise SystemExit('gundrill: feed column %d should rise with diameter' % c)
    cr = ev['coolant']['rows']
    if [r[1] for r in cr] != sorted((r[1] for r in cr), reverse=True) or [r[2] for r in cr] != sorted(r[2] for r in cr): raise SystemExit('gundrill: coolant rows')
    bf = ev['botek']['feed_mm_rev']
    for i, r in enumerate(bf):
        if i and abs(r[0] - bf[i - 1][1] - 0.01) > 1e-9: raise SystemExit('gundrill: botek diameter rows leave a gap at %s' % r[0])
        for lo, hi in r[2:]:
            if not (0 < lo < hi): raise SystemExit('gundrill: botek feed range at %s' % r[0])
    rules = []
    for st in ev['rules']:
        for k in st['src']: need(k)
        pubs = {S[k]['publisher'] for k in st['src']}
        rules.append({'t': st['t'], 'src': st['src'], 'status': 'confirmed' if len(pubs) >= 2 else 'single'})
    return {'sources': sources_of(ev), 'speed': ev['speed_sfm'], 'feed': ev['feed_in_rev'], 'coolant': ev['coolant'],
            'botek': {k: v for k, v in ev['botek'].items() if not k.startswith('_')}, 'unisig_flow': ev['unisig_flow'],
            'rules': rules, 'not_used': ev['not_used']}


def build_holdertorque():
    """Collet nut and pull stud torque. Each maker's figures for its own holders,
    side by side; nothing is merged. Checks that every row names a known source,
    that the bore ranges of a collet size run upwards without overlapping and
    that the torque never falls as the bore grows."""
    ev = load_ev('holdertorque-evidence.json')
    if not ev: return None
    S = ev['sources']
    def need(k):
        if k not in S: raise SystemExit('holdertorque: unknown source ' + k)
    E = ev['er']
    need(E['src']); need(E['ceiling_src']); need(ev['techniks_nut']['src'])
    if not (0 < E['ceiling_pct'] <= 50): raise SystemExit('holdertorque: ceiling percent')
    last = {}
    for size, mb, lo, hi, std, mini in E['rows']:
        if not (0 < lo <= hi) or (std is None and mini is None): raise SystemExit('holdertorque: row %s %s' % (size, lo))
        if size in last:
            plo, phi, pstd, pmini = last[size]
            if lo <= phi: raise SystemExit('holdertorque: bore ranges of %s overlap at %s' % (size, lo))
            for a, b in ((pstd, std), (pmini, mini)):
                if (a is None) != (b is None) or (a is not None and b < a): raise SystemExit('holdertorque: torque of %s at %s' % (size, lo))
        last[size] = (lo, hi, std, mini)
    sizes = list(last)
    for size, nut, t in ev['techniks_nut']['rows']:
        if not (t > 0 and nut): raise SystemExit('holdertorque: Techniks row ' + size)
    studs = []
    for r in ev['pullstud']['rows']:
        for v in r['v']:
            need(v['src'])
            if v['unit'] not in ('Nm', 'ftlb') or not (0 < v['lo'] <= v['hi']): raise SystemExit('holdertorque: pull stud ' + r['taper'])
        pubs = [S[v['src']]['publisher'] for v in r['v']]
        if len(set(pubs)) != len(pubs): raise SystemExit('holdertorque: one figure per maker for ' + r['taper'])
        studs.append({'taper': r['taper'], 'v': r['v'], 'status': 'single' if len(pubs) == 1 else 'differs'})
    rules = []
    for st in ev['rules']:
        for k in st['src']: need(k)
        rules.append({'t': st['t'], 'src': st['src'], 'status': 'confirmed' if len({S[k]['publisher'] for k in st['src']}) >= 2 else 'single'})
    return {'sources': sources_of(ev), 'er': {k: v for k, v in E.items() if not k.startswith('_')}, 'sizes': sizes,
            'techniks_nut': {k: v for k, v in ev['techniks_nut'].items() if not k.startswith('_')},
            'pullstud': studs, 'rules': rules, 'gaps': ev['gaps']}


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


# ---------------------------------------------------------------- G and M codes
# Kinds of source that count on their own for the control they describe: the
# maker's manual, a machine builder's document for its own machines, the maker's
# distribution network, or a public standard / report (generic base only).
PRIMARY = {'maker', 'builder', 'distributor', 'standard'}


def gm_status(srcs, row):
    """'maker' when a primary source prints it, 'confirmed' when two independent
    secondary sources (different families) agree. Anything else stops the build."""
    kinds = {srcs[s['s']]['kind'] for s in row['src']}
    if kinds & PRIMARY:
        return 'maker'
    fams = {srcs[s['s']].get('family', s['s']) for s in row['src']}
    if len(fams) >= 2:
        return 'confirmed'
    raise SystemExit(f"{row.get('ctrl')} {row.get('code', row.get('topic'))}: needs the maker's document or two independent sources, has {sorted(fams)}")


def build_gcodes():
    """G-code, M-code and macro reference. Every row must name a known source."""
    ev = load_ev('gcodes-evidence.json')
    if not ev: return None
    srcs = ev['sources']
    for k, s in srcs.items():
        for f in ('publisher', 'title', 'url', 'accessed', 'kind'):
            if not s.get(f): raise SystemExit(f'gcodes source {k}: missing {f}')
        if s['kind'] not in PRIMARY | {'secondary'}: raise SystemExit(f'gcodes source {k}: unknown kind {s["kind"]}')
    ctrls = ev['controls']
    seen = set()
    for sec in ('codes', 'macro', 'disagreements'):
        for r in ev[sec]:
            if r['ctrl'] not in ctrls: raise SystemExit(f"{sec}: unknown control {r['ctrl']}")
            if not r.get('src'): raise SystemExit(f"{sec} {r['ctrl']} {r.get('code', r.get('topic'))}: no source")
            for s in r['src']:
                if s['s'] not in srcs: raise SystemExit(f"{sec} {r['ctrl']}: unknown source {s['s']}")
            if sec == 'codes':
                if not r['meaning'] or not (r['mill'] or r['lathe']): raise SystemExit(f"{r['ctrl']} {r['code']}: meaning and mill/lathe needed")
                if not re.fullmatch(r'[GM]\d+(\.\d+)?', r['code']): raise SystemExit(f"{r['ctrl']}: bad code {r['code']}")
                key = (r['ctrl'], r['code'], r['mill'], r['lathe'])
                if key in seen: raise SystemExit(f'duplicate row {key}')
                seen.add(key)
            if sec != 'disagreements':
                r['status'] = gm_status(srcs, r)
    # System variables: a row may rest on one independent source, and is then marked "one source".
    # 'ranges' lists every number or range named in 'var', so a search for a number finds its row.
    seen_sv = set()
    for r in ev.get('sysvars', []):
        if r['ctrl'] not in ctrls: raise SystemExit(f"sysvars: unknown control {r['ctrl']}")
        if not r.get('src') or not r.get('text') or not r.get('group'): raise SystemExit(f"sysvars {r['ctrl']} {r.get('var')}: group, text and source needed")
        for x in r['src']:
            if x['s'] not in srcs: raise SystemExit(f"sysvars {r['ctrl']}: unknown source {x['s']}")
        rng = [(int(a), int(b or a)) for a, b in re.findall(r'#(\d+)(?:-#(\d+))?', r['var'])]
        if not rng or any(a > b for a, b in rng): raise SystemExit(f"sysvars {r['ctrl']}: bad variable {r['var']}")
        if re.sub(r'#\d+(-#\d+)?', '', r['var']).strip(' ()'): raise SystemExit(f"sysvars {r['ctrl']}: bad variable text {r['var']}")
        key = (r['ctrl'], r['var'])
        if key in seen_sv: raise SystemExit(f'duplicate system variable {key}')
        seen_sv.add(key)
        r['ranges'] = [list(x) for x in rng]
        kinds = {srcs[x['s']]['kind'] for x in r['src']}
        fams = {srcs[x['s']].get('family', x['s']) for x in r['src']}
        r['status'] = 'maker' if kinds & PRIMARY else 'confirmed' if len(fams) >= 2 else 'single'
    for c in ev['gaps']:
        if c not in ctrls: raise SystemExit(f'gaps: unknown control {c}')
    return {'sources': srcs, 'controls': ctrls, 'codes': ev['codes'], 'macro': ev['macro'],
            'sysvars': ev.get('sysvars', []), 'disagreements': ev['disagreements'], 'gaps': ev['gaps']}


# ---------------------------------------------------------------- fasteners and machine elements
def inch_size(s):
    """'#10' (number size) -> 0.190; '1/4' -> 0.25; '1 1/4' -> 1.25; '1' -> 1 in."""
    s = s.strip()
    if s.startswith('#'):
        return 0.060 + 0.013 * int(s[1:])
    return frac_in(s)


def drill_inch(name, drills):
    """Decimal inch of a drill name as printed ('#9', 'F', '29/64', '1 1/64'), from the drill chart consensus."""
    n = name.strip()
    if n.startswith('#') or (len(n) == 1 and n.isalpha()):
        key = n if n.startswith('#') else n.upper()
        for d in drills:
            if d['name'] == key: return d['inch']
        raise SystemExit(f'unknown drill {name}')
    return frac_in(n)


def build_fasteners(drills):
    """Fasteners and machine elements: every value as printed by each publisher, with consensus."""
    ev = load_ev('fasteners-evidence.json')
    if not ev: return None
    out = {'sources': sources_of(ev)}
    pos = lambda lst: (lambda s: (lst.index(s) if s in lst else len(lst), s))
    out['iso898'] = build_series(ev['iso898'], ['sp', 'yield_min', 'rm_min', 'hv'], order=pos(ev['iso898_order']), exact=True)
    out['sae'] = build_series(ev['sae'], ['sp', 'yield_min', 'rm_min', 'hrc_min'], order=pos(ev['sae_order']), exact=True)
    out['shcs_inch'] = build_series(ev['shcs_inch'], ['head_d_max', 'head_d_min', 'head_h_max', 'head_h_min', 'key'], order=inch_size)
    mnum = lambda s: float(s[1:])
    out['shcs_metric'] = build_series(ev['shcs_metric'], ['dk_max', 'dk_min', 'k_max', 'k_min', 's_key'], order=mnum)
    out['clearance_metric'] = build_series(ev['clearance_metric'], ['fine', 'medium', 'coarse'], order=mnum, exact=True)
    ci = {}
    for pub, rows in ev['clearance_inch'].items():
        for size, r in rows.items():
            q = dict(r)
            if 'close_drill' in r: q['close'] = f"{drill_inch(r['close_drill'], drills):.4f}"
            if 'free_drill' in r: q['free'] = f"{drill_inch(r['free_drill'], drills):.4f}"
            ci.setdefault(pub, {})[size] = q
    out['clearance_inch'] = build_series(ci, ['close', 'normal', 'free', 'close_drill', 'free_drill'], order=inch_size, exact=True)
    out['cbore_metric'] = build_series(ev['cbore_metric'], ['hole', 'cbore_d', 'depth_min', 'depth_max'], order=mnum, exact=True)
    cbi = {pub: {s: {'cbore_d': f"{frac_in(r['cbore_d']):.4f}", 'cbore_frac': r['cbore_d']} for s, r in rows.items()} for pub, rows in ev['cbore_inch'].items()}
    out['cbore_inch'] = build_series(cbi, ['cbore_d', 'cbore_frac'], order=inch_size)
    out['af_metric'] = build_series(ev['af_metric'], ['iso', 'din', 'jis'], order=mnum, exact=True)
    out['af_inch'] = build_series(ev['af_inch'], ['hex', 'bs'], order=inch_size)
    out['keys_metric'] = build_series(ev['keys_metric'], ['d_over', 'd_to', 't1', 't2', 'lengths'], order=pos(ev['keys_metric_order']), exact=True)
    out['keys_inch'] = build_series(ev['keys_inch'], ['range', 'width', 'square_h', 'rect_h'], order=lambda s: frac_in(s.split('-')[0]))
    out['tslots'] = build_series(ev['tslots'], ['b_min', 'b_max', 'c_min', 'c_max', 'h_min', 'h_max', 'bolt'], order=float, exact=True)
    out['tslot_pitch'] = ev['tslot_pitch']
    out['as568'] = build_series(ev['as568'], ['id', 'id_tol', 'cs', 'cs_tol'], order=int)
    for k in ('torque_friction', 'oring_rules', 'sae_note', 'clearance_metric_note', 'clearance_inch_note', 'af_metric_note', 'keys_inch_note', 'tslot_pitch_source'):
        out[k] = ev.get(k)
    # every row must name at least one publisher; record the publishers of each row
    for sec, v in out.items():
        if isinstance(v, list):
            for row in v:
                pubs = sorted({p for f, c in row.items() if isinstance(c, dict) for g in c['groups'] for p in g['publishers']})
                if not pubs: raise SystemExit(f'fasteners {sec} {row["size"]}: no publisher')
                row['publishers'] = pubs
    return out


# ---------------------------------------------------------------- ISO 2768-1, drawing abbreviations
def build_iso2768():
    ev = load_ev('iso2768-evidence.json')
    if not ev: return None
    out = {'sources': sources_of(ev), 'standard': ev['standard']}
    for sec, order in (('linear', 'linear_ranges'), ('edge', 'edge_ranges'), ('angle_min', 'angle_ranges')):
        rng = ev[order]
        out[sec] = build_series(ev[sec], ['f', 'm', 'c', 'v'], order=lambda s, r=rng: r.index(s), exact=True)
        out[order] = rng
    return out


def build_abbrev():
    ev = load_ev('abbrev-evidence.json')
    if not ev: return None
    rows = []
    for ab, own, cat in ev['own']:
        printed = {pub: m[ab] for pub, m in ev['printed'].items() if ab in m}
        if not printed: raise SystemExit(f'abbreviation {ab}: no publisher')
        rows.append({'ab': ab, 'own': own, 'cat': cat, 'printed': printed,
                     'status': 'confirmed' if len(printed) >= 2 else 'review'})
    return {'sources': sources_of(ev), 'rows': rows}


def build_tooling():
    """Tooling reference (parity B3): tap limit steps, forming tap constants, coating
    temperatures and saw teeth rules, each with publisher consensus."""
    ev = load_ev('tooling-evidence.json')
    if not ev: return None
    def by_item(sec):
        items = []
        for rows in sec.values():
            for k in rows:
                if k not in items: items.append(k)
        return {k: any_consensus({pub: rows[k] for pub, rows in sec.items() if k in rows}) for k in items}
    return {'sources': sources_of(ev), 'tap_limits': by_item(ev['tap_limits']), 'form_tap': by_item(ev['form_tap']),
            'coating_max_c': by_item(ev['coating_max_c']), 'saw_teeth': by_item(ev['saw_teeth']),
            'osg_d_bands_in': ev['osg_d_bands_in'], 'osg_recommended': ev['osg_recommended'],
            'notes': {k: v for k, v in ev.items() if k.startswith('_')}}


# ---------------------------------------------------------------- ANSI B4.1 inch fits, preferred numbers (inspection round 2)
ANSI_RANGES = ['0-0.12', '0.12-0.24', '0.24-0.40', '0.40-0.71', '0.71-1.19', '1.19-1.97', '1.97-3.15', '3.15-4.73',
               '4.73-7.09', '7.09-9.85', '9.85-12.41', '12.41-15.75', '15.75-19.69']
ANSI_FIELDS = ['a', 'b', 'hole_plus', 'hole_minus', 'shaft_plus', 'shaft_minus']


def ansi_main_range(key):
    lo, hi = (float(x) for x in key.split('-'))
    for r in ANSI_RANGES:
        a, b = (float(x) for x in r.split('-'))
        if lo >= a - 1e-9 and hi <= b + 1e-9: return r
    raise SystemExit('ANSI range ' + key + ' is not inside a standard size range')


def ansi_expected_limits(fam, hp, hm, sp, sm):
    """The two printed limits from the hole and shaft limits (thousandths): RC/LC/LT print (min clearance, max
    clearance), a negative clearance being interference; LN/FN print (min interference, max interference)."""
    if fam in ('LN', 'FN'): return (round(sm - hp, 4), round(sp - hm, 4))
    return (round(hm - sp, 4), round(hp - sm, 4))


def build_ansi_fits():
    """ANSI B4.1 preferred inch fits: consensus per printed cell, plus two checks of each publisher's rows:
    (1) the printed limits of clearance/interference must follow from the printed hole and shaft limits;
    (2) every class that uses the same hole (or shaft) grade must show the same tolerance in a size range
        (the grades come from the class symbols, e.g. RC3 = H7/f6)."""
    ev = load_ev('ansi-fits-evidence.json')
    if not ev: return None
    sym = next(iter(ev['symbols'].values()))
    desc = next(iter(ev['descriptions'].values()))
    tol = collections.defaultdict(lambda: collections.defaultdict(list))  # (pub, grade, range) -> {tolerance: [classes]}
    for pub, classes in ev['fits'].items():
        for cls, rows in classes.items():
            h, sh = sym[cls].split('/')
            for key, v in rows.items():
                hp, hm, sp, sm = (float(x) for x in v[2:])
                mr = ansi_main_range(key)
                tol[(pub, h, mr)][round(hp - hm, 4)].append(cls)
                if sh != '-': tol[(pub, sh, mr)][round(sp - sm, 4)].append(cls)
    grade_tol = {k: max(vals.items(), key=lambda kv: len(set(kv[1])))[0] for k, vals in tol.items()}
    classes, problems = {}, []
    for cls in sorted({c for v in ev['fits'].values() for c in v}, key=lambda c: (c[:2], int(c[2:]))):
        fam = cls[:2]; h, sh = sym[cls].split('/')
        keys = sorted({k for v in ev['fits'].values() for k in v.get(cls, {})}, key=lambda k: float(k.split('-')[0]))
        rows = []
        for key in keys:
            row, notes = {'range': key}, []
            for i, f in enumerate(ANSI_FIELDS):
                row[f] = exact_consensus({pub: v[cls][key][i] for pub, v in ev['fits'].items() if key in v.get(cls, {})})
            for pub, v in ev['fits'].items():
                if key not in v.get(cls, {}): continue
                a, b, hp, hm, sp, sm = (float(x) for x in v[cls][key])
                ea, eb = ansi_expected_limits(fam, hp, hm, sp, sm)
                if abs(ea - a) > 1e-9 or abs(eb - b) > 1e-9:
                    notes.append(f'{pub} prints the fit limits {v[cls][key][0]} / {v[cls][key][1]}, but its hole and shaft limits give {ea:g} / {eb:g}')
                mr = ansi_main_range(key)
                for g, t in ((h, round(hp - hm, 4)), (sh, round(sp - sm, 4))):
                    if g == '-' or (pub, g, mr) not in grade_tol: continue
                    if abs(grade_tol[(pub, g, mr)] - t) > 1e-9:
                        notes.append(f'{pub}: the {g} tolerance here is {t:g}; the other classes using {g} in {mr} in show {grade_tol[(pub, g, mr)]:g}')
            row['notes'] = notes
            if notes: problems.append((cls, key, notes))
            rows.append(row)
        classes[cls] = {'family': fam, 'symbol': sym[cls], 'desc': desc.get(cls, ''), 'rows': rows}
    for cls, key, notes in problems: print('  ANSI check', cls, key, '; '.join(notes))
    return {'sources': sources_of(ev), 'ranges': ANSI_RANGES, 'classes': classes}


def build_preferred():
    """Renard basic series. R40 is the finest basic series; R20, R10 and R5 take every 2nd, 4th and 8th term
    (ISO 3). For each value: which independent publishers print it. Wikipedia's R40 column holds every R20,
    R10 and R5 value at its nested position, so it counts for the coarser series too; WIKI_PREF is the same
    publisher as WIKI_RENARD and is not counted twice."""
    ev = load_ev('preferred-evidence.json')
    if not ev: return None
    pr, same = ev['printed'], ev.get('same_publisher', {})
    r40 = pr['WIKI_RENARD']['R40']
    out = {}
    for name, step in (('R40', 1), ('R20', 2), ('R10', 4), ('R5', 8)):
        lst = []
        for i in range(0, 40, step):
            v = r40[i]
            # every basic-series value is an R40 value, so a value printed in any basic series counts
            pubs = [pub for pub, ser in pr.items() if pub not in same and any(v in ser.get(s, []) for s in ('R5', 'R10', 'R20', 'R40'))]
            lst.append({'i': i, 'value': v, 'publishers': pubs, 'status': 'confirmed' if len(pubs) >= 2 else 'review'})
        out[name] = lst
    r80 = []
    for i, v in enumerate(r40):  # R80 index counts 80 steps per decade
        r80.append({'i': 2 * i, 'value': v, 'publishers': out['R40'][i]['publishers'], 'status': out['R40'][i]['status']})
        r80.append({'i': 2 * i + 1, 'value': pr['WIKI_RENARD']['R80_extra'][i], 'publishers': ['WIKI_RENARD'], 'status': 'review'})
    out['R80'] = r80
    return {'sources': sources_of(ev), 'series': out}


# ---------------------------------------------------------------- materials reference (B4)
# Unit of each evidence key -> (canonical unit, factor, offset): canonical = (printed - offset) * factor.
MR_UNITS = {'c': (1, 0), 'f': (5 / 9, 32), 'm': (1, 0), 'ft': (0.3048, 0), 'mm': (1, 0), 'in': (25.4, 0),
            'd': (1, 0), 'x5f': (18, 0), 'k': (1, 0), 'sg': (1000, 0)}


def mr_family(srcs, key, entry=None):
    return (entry or {}).get('family') or srcs[key].get('family') or key


def mr_interval(entry):
    """(lo, hi) in canonical units from an evidence entry, or None for text-only entries."""
    for k, (fac, off) in MR_UNITS.items():
        if k in entry:
            parts = [float(x) for x in str(entry[k]).split('-')]
            lo, hi = parts[0], parts[-1]
            return (round((lo - off) * fac, 3), round((hi - off) * fac, 3))
    return None


def mr_fmt(iv):
    f = lambda x: f"{x:.3f}".rstrip('0').rstrip('.')
    return f(iv[0]) if iv[0] == iv[1] else f(iv[0]) + '-' + f(iv[1])


def mr_consensus(srcs, field_ev, mode):
    """field_ev: {source: entry}. mode 'temp': ends within 3 degC (degF/degC rounding);
    'range': ends within 2 %; 'overlap': the printed intervals overlap (3 degC or 2 % slack);
    'colour': within 10 degC. Copies of one source (same family) count once."""
    rows = []
    for k, e in field_ev.items():
        if k not in srcs: raise SystemExit(f'matref: unknown source {k}')
        iv = mr_interval(e)
        rows.append((k, mr_family(srcs, k, e), iv, e))
    num = [r for r in rows if r[2]]
    if not num:  # text only: shown as printed, no comparison
        fams = {r[1] for r in rows}
        return {'status': 'printed', 'groups': [], 'printed': field_ev, 'families': len(fams)}
    def ok(a, b):
        if mode == 'temp': return abs(a[0] - b[0]) <= 3 and abs(a[1] - b[1]) <= 3
        if mode == 'colour': return abs(a[0] - b[0]) <= 10
        if mode == 'overlap':
            # 3 units of slack for degC and 10^-6/K (rounding of converted printings), 2 % for densities
            slack = 3 if max(abs(a[1]), abs(b[1])) < 700 else 0.02 * max(abs(a[1]), abs(b[1]))
            return a[0] <= b[1] + slack and b[0] <= a[1] + slack
        tol = lambda x, y: abs(x - y) <= 0.02 * max(abs(x), abs(y)) + 1e-9
        return tol(a[0], b[0]) and tol(a[1], b[1])
    groups = []
    for k, fam, iv, e in num:
        for g in groups:
            if ok(g['iv'], iv): g['publishers'].append(k); g['fams'].add(fam); break
        else: groups.append({'iv': iv, 'publishers': [k], 'fams': {fam}})
    groups.sort(key=lambda g: -len(g['fams']))
    strong = [g for g in groups if len(g['fams']) >= 2]
    if len(groups) == 1: status = 'confirmed' if len(groups[0]['fams']) >= 2 else 'review'
    elif len(strong) == 1: status = 'confirmed_with_outlier'
    else: status = 'differs'
    printed = {k: dict(e, lo=iv[0], hi=iv[1]) if iv else e for k, fam, iv, e in rows}
    return {'status': status, 'printed': printed,
            'groups': [{'value': mr_fmt(g['iv']), 'lo': g['iv'][0], 'hi': g['iv'][1], 'publishers': g['publishers'], 'families': len(g['fams'])} for g in groups]}


def mr_said(srcs, keys):
    """Status of an own-words statement from the publishers that say the same."""
    for k in keys:
        if k not in srcs: raise SystemExit(f'matref: unknown source {k}')
    n = len({mr_family(srcs, k) for k in keys})
    return 'confirmed' if n >= 2 else 'review' if n == 1 else 'unverified'


def build_matref():
    ev = load_ev('matref-evidence.json')
    if not ev: return None
    srcs = sources_of(ev)
    out = {'sources': srcs, 'about': ev['_about']}
    # temper and heat-tint colours
    for sec in ('temper_carbon', 'tint_stainless'):
        t = ev[sec]
        rows = []
        for key in t['order']:
            pr = {pub: {x: v[key][x] for x in ('c', 'fp', 'name', 'v') if x in v[key]} for pub, v in t['printed'].items() if key in v}
            c = mr_consensus(srcs, pr, 'colour')
            rows.append({'key': key, 'name': t['own'][key][0], 'swatch': t['own'][key][1], **c})
        out[sec] = {'rows': rows, 'note': t['_note']}
    out['colour_factors'] = [{'factor': f, 'text': x, 'src': s, 'status': mr_said(srcs, s)} for f, x, s in ev['colour_factors']]
    out['titanium_note'] = ev['titanium_note']
    # heat treatment
    out['terms'] = [dict(t, status=mr_said(srcs, t['used_by'])) for t in ev['terms']]
    g = ev['grades']
    rows = []
    for gr in g['order']:
        r = g['rows'][gr]
        fields = {f: mr_consensus(srcs, fe, 'temp') for f, fe in r['fields'].items()}
        rows.append({'grade': gr, 'label': r['label'], 'kind': r['kind'], 'fields': fields,
                     'publishers': sorted({p for fe in r['fields'].values() for p in fe})})
    out['grades'] = {'fields': g['_fields'], 'rows': rows}
    ph = ev['ph174']
    for c in ph['conditions']:  # the condition name is the ageing temperature in degF; check the printed degC against it
        if abs((c['f'] - 32) * 5 / 9 - float(c['ATLAS_630']['c'])) > 3: raise SystemExit(f"17-4 {c['cond']}: printed degC does not match the name")
    out['ph174'] = dict(ph, naming_status=mr_said(srcs, list(ph['naming'])))
    out['temper_hardness_note'] = ev['temper_hardness_note']
    # galvanic series
    gs, go = ev['galv_sea'], ev['galv_order']
    rank = {}
    for i, (name, key) in enumerate(go['rows']):
        if key: rank.setdefault(key, []).append(i)
    out['galv_sea'] = {'src': gs['src'], 'note': gs['_note'], 'rule': gs['rule'],
                       'rows': [{'key': k, 'name': n, 'v': float(v), 'printed': v, 'wiki_rank': rank.get(k), 'status': 'review'} for k, n, v in gs['rows']]}
    out['galv_order'] = {'src': go['src'], 'note': go['_note'], 'rows': go['rows']}
    ai = ev['anodic_index']
    lim = []
    for L in ai['limits']:
        pr = {k: {'d': v['v'], 'v': v['text']} for k, v in L.items() if k in srcs}
        lim.append({'env': L['env'], 'label': L['label'], **mr_consensus(srcs, pr, 'range')})
    out['anodic_index'] = {'src': ai['src'], 'note': ai['_note'], 'limits': lim,
                           'rows': [{'key': k, 'name': n, 'v': float(v), 'printed': v, 'status': 'review'} for k, n, v in ai['rows']]}
    # plastics: link to the materials data where it already holds the plastic
    mats = {}
    mp = ROOT / 'data' / 'materials.json'
    if mp.exists():
        for m in json.loads(mp.read_text())['materials']:
            mats[m['grade']] = m
    pl = ev['plastics']
    prow = []
    for key in pl['order']:
        r = pl['rows'][key]
        mode = {'max_temp': 'overlap', 'cte': 'overlap', 'density': 'overlap', 'anneal_hold': 'temp'}
        fields = {f: mr_consensus(srcs, fe, mode.get(f, 'range')) for f, fe in r['fields'].items()}
        link = None
        if r.get('material'):
            m = mats.get(r['material'])
            if not m: raise SystemExit(f"matref plastics {key}: material {r['material']} not in data/materials.json")
            link = {'grade': m['grade'], 'props': {}}
            for pr in m.get('properties', []):
                if pr['prop'] in ('density', 'cte') and pr['prop'] not in link['props']:
                    v = pr['values'][0]
                    link['props'][pr['prop']] = {'value': v['value'], 'max': v.get('max'), 'unit': pr['unit'], 'status': pr['status'], 'publishers': v['publishers'],
                                                 'others': [x['value'] for x in pr['values'][1:]]}
            for f in ('density', 'cte'):
                if f in fields: raise SystemExit(f'matref plastics {key}: {f} is already in the materials data, do not duplicate')
        notes = [{'text': t, 'src': s, 'status': mr_said(srcs, s)} for t, s in r['notes']]
        prow.append({'key': key, 'name': r['name'], 'fields': fields, 'materials': link, 'notes': notes})
    out['plastics'] = {'fields': pl['_fields'], 'units': pl['_units'], 'rows': prow,
                       'general': [{'text': t, 'src': s, 'status': mr_said(srcs, s)} for t, s in pl['general']]}
    mi = ev['metalid']
    out['metalid'] = {'spark': mi['spark'], 'tests': [{'test': a, 'text': b, 'src': s, 'status': mr_said(srcs, s)} for a, b, s in mi['tests']]}
    return out


def matref_summary(m):
    """Counts of compared values by status (heat treatment, colours, plastics, galvanic limits)."""
    st = collections.Counter()
    for sec in ('temper_carbon', 'tint_stainless'):
        for r in m[sec]['rows']: st[r['status']] += 1
    for r in m['grades']['rows']:
        for c in r['fields'].values(): st[c['status']] += 1
    for r in m['plastics']['rows']:
        for c in r['fields'].values(): st[c['status']] += 1
    for c in m['anodic_index']['limits']: st[c['status']] += 1
    st['review'] += len(m['galv_sea']['rows']) + len(m['anodic_index']['rows']) + len(m['ph174']['conditions'])
    return st


def main():
    out = {'schema': 1, 'drills': build_drills(), 'threads': build_threads(), 'iso286': build_iso286(),
           'other_threads': build_other_threads(), 'tapers': build_tapers(), 'inserts': build_inserts(), 'iso513': build_iso513(),
           'surface': build_surface(), 'hardness': build_hardness(), 'knurl': build_knurl(), 'gundrill': build_gundrill(), 'holdertorque': build_holdertorque(), 'gcodes': build_gcodes(),
           'grinding': build_grinding(), 'iso2768': build_iso2768(), 'abbrev': build_abbrev(),
           'power_threads': build_power_threads(), 'tooling': build_tooling(),
           'ansi_fits': build_ansi_fits(), 'preferred': build_preferred(),
           'matref': build_matref(), 'centredrills': build_centredrills()}
    for fam, rows in (out['centredrills'] or {}).get('families', {}).items():
        st = collections.Counter(c['status'] for r in rows for f, c in r.items() if f != 'size')
        print('  centre drills', fam, len(rows), 'sizes', dict(st))
        for r in rows:
            for f, c in r.items():
                if f != 'size' and c['status'] not in ('confirmed', 'review'): print('   ', fam, r['size'], f, c['status'], [(g['value'], g['publishers']) for g in c['groups']])
    out['fasteners'] = build_fasteners(out['drills']['drills'])
    for sec in ('other_threads', 'tapers', 'power_threads'):
        if not out[sec]: continue
        for k, rows in out[sec].items():
            if k in ('sources', 'notes'): continue
            for r in (rows.values() if isinstance(rows, dict) else [rows]):
                for row in (r if isinstance(r, list) else []):
                    for f, c in row.items():
                        if isinstance(c, dict) and c['status'] not in ('confirmed', 'review'):
                            print(' ', sec, k, row['size'], f, c['status'], c['groups'])
    for sec, items in (out['tooling'] or {}).items():
        if sec in ('sources', 'notes', 'osg_d_bands_in', 'osg_recommended'): continue
        for k, c in items.items(): print('  tooling', sec, k, c['status'], [(g['value'], g['publishers']) for g in c['groups']])
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
    g = out['gcodes']
    if g:
        n = collections.Counter((r['ctrl'], r['status']) for r in g['codes'])
        print('  gcodes', len(g['codes']), 'rows,', len(g['macro']), 'macro notes,', len(g['disagreements']), 'disagreements:', dict(n))
    fa = out['fasteners']
    if fa:
        for sec, rows in fa.items():
            if not isinstance(rows, list): continue
            st = collections.Counter(c['status'] for r in rows for f, c in r.items() if isinstance(c, dict))
            print('  fasteners', sec, len(rows), 'rows', dict(st))
            for r in rows:
                for f, c in r.items():
                    if isinstance(c, dict) and c['status'] not in ('confirmed', 'review'):
                        print('    ', sec, r['size'], f, [(g['value'], g['publishers']) for g in c['groups']])
    i2 = out['iso2768']
    print('  iso2768', {k: dict(collections.Counter(c['status'] for r in i2[k] for f, c in r.items() if isinstance(c, dict))) for k in ('linear', 'edge', 'angle_min')})
    print('  abbreviations', dict(collections.Counter(r['status'] for r in out['abbrev']['rows'])))
    pf = out['preferred']
    print('  preferred numbers', {k: dict(collections.Counter(x['status'] for x in v)) for k, v in pf['series'].items()})
    af = out['ansi_fits']
    print('  ANSI fits', len(af['classes']), 'classes, cells', dict(collections.Counter(r[f]['status'] for c in af['classes'].values() for r in c['rows'] for f in ANSI_FIELDS)),
          'rows with check notes:', sum(1 for c in af['classes'].values() for r in c['rows'] if r['notes']))
    print('  ISO 286 j/J', {k: dict(collections.Counter(c['status'] for rows in iso[k].values() for c in rows.values())) for k in ('j_shaft', 'j_hole')})
    if out['matref']:
        print('  matref', dict(matref_summary(out['matref'])))
    print('  knurl pitches', [(x['p'], x['status']) for x in out['knurl']['pitches_mm']])


if __name__ == '__main__':
    main()
