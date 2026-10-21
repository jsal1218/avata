"""Starter sync e2e (Playwright, real service workers). Usage: python3 tools/e2e_starters.py

On 2026-10-18 Jordan removed Models 1-4, 8, 11, 15 and 16. The rest were renumbered by name only (stable ids exact-5, 6, 7,
9, 10, 12, 13, 14 = Model 1-8; relabelStarters() renames default-named records once, user names kept) and exact-17 was added as
Model 9, then exact-18..22 as Model 10-14, then exact-23, 24 as Model 15-16. Shipped: Model 1-16 (Model 1 with 4 outfits: Base, Tank & shorts, Yoga set, Linen set; Model 2 with Base, Yoga set), Generated 1 (4 outfits), Generated 2 (2 outfits), Generated 3 (Model 2 in black, 4 outfits).
On 2026-10-19 the Photorealistic section was removed: Photoreal 1 (old Model 2) and Photoreal 2 are dropped once like the removed exact models
(their app-seeded sample looks go, the user's own looks are kept detached); existing Model 1 records gain the Tank & shorts outfit in place (user edits kept). Every upgrade scenario checks that the removed starters' records are dropped once
(even renamed ones), are never re-added, and that user-created models stay untouched; the user's own looks of a removed
starter are kept, detached (modelId null); app-seeded sample looks of Model 1 are removed.
A) Legacy upgrade (Models 1+2 only, old ids, old SW cache): edits on Model 1, user model, generated look on Model 1, edited /
   deleted sample looks. After deploy: Model 1 gone (renamed or not), her generated look kept + detached, her sample looks gone;
   Model 2 → Photoreal 1 with its sample looks; the remaining exact models + Generated 1 added once; user model untouched.
B) Renumber upgrade (4d0c090, Models 1-6 old ids): old Model 5 deleted (look detached); Models 3 / 6 are renumbered to exact-2 /
   exact-4 and then removed (looks detached); deleted Model 4 stays deleted; new Model 5 + the rest added once.
C) Fresh install: Model 1-9, Photoreal 1, Generated 1, all known; removed ids recorded as known too.
D) Model 1-5 release (8d138e9): Models 1, 2, 4 dropped, renamed Model 5 kept as is, remaining Models 6-14 + Generated 1 added once.
E) Model 1-15 release (7781450): renamed Model 15 dropped, Generated 1 added once with her 4 outfits (model page chips).
F) Model 1-16 + Generated 1 release (eb3faca, the last one live): renamed Model 16 and Models 1-4, 8, 11, 15 dropped once;
   a generated look on Model 8 kept + detached; renamed Generated 1 and user model untouched; relaunch idempotent; never re-added.
G) Model 1-9 + Photoreal 1 + Generated 1 release (457192b): Generated 2 (2 outfits) and Models 10-14 added once; renamed /
   deleted starters and user model untouched; model page outfit chips; relaunch idempotent; deleted Generated 2 never re-added.
H) Generated 2 release (1de7a72, the last one live): Models 10-14 (exact-18..22) added once; renamed Model 9 and a user model
   named 'Model 10' untouched; relaunch idempotent; a deleted new model is never re-added.
I) Models 10-14 release (2e814c1): Generated 3 added once with 4 outfits; renamed Model 2 and user model
   untouched; model page outfit chips; relaunch idempotent; a deleted Generated 3 is never re-added.
J) Generated 3 + Photoreal 2 release (5664f6d, the last one live): renamed Photoreal 1 and Photoreal 2 dropped once, a look on Photoreal 2
   kept detached; renamed Model 1 gains Tank & shorts (name kept, model page chips); Generated 3 kept; idempotent; never re-added.
K) Model 1 Tank & shorts release (c217703, the last one live): Model 1 gains Yoga set + Linen set and Model 2 gains Yoga set in place
   (renamed, edits kept), Models 15-16 (exact-23, 24) added once, everything else untouched.
N) Model 1 Red dress release (a1a2db9, the last one live): renamed Model 2 (Base, Yoga set) gains Generated 3's Turtleneck, Slip dress, Tank & shorts in place, edits kept; nothing else changes.
O) Model 2 + Generated 3 outfits release (bbd088a): renamed Model 2 (5 outfits) gains USA jersey in place, edits kept; nothing else changes.
M) Model 13 / Model 17 outfits release (a20674e): renamed Model 1 (4 outfits) gains Red dress in place, edits kept; nothing else changes.
L) Model 17 Base + Red dress release (f2c6373): renamed Model 17 gains Leather catsuit + Tech suit and renamed Model 13 gains Beige Linen + A, in place, edits kept; nothing else changes.
"""
import hashlib, json, pathlib, re, shutil, socket, subprocess, sys, tempfile, time, io, tarfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
def site(ref):
  d = pathlib.Path(tempfile.mkdtemp(prefix='avata-starters-')) / 'site'; d.mkdir()
  tarfile.open(fileobj=io.BytesIO(subprocess.run(['git', 'archive', ref], cwd=ROOT, capture_output=True, check=True).stdout)).extractall(d, **({'filter': 'data'} if hasattr(tarfile, 'data_filter') else {}))
  return d
def sha(b): return hashlib.sha256(b).hexdigest()
K = ('sheet', 'front', 'back', 'thumb')
KEEP = [5, 6, 7, 9, 10, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25]; REMOVED = [1, 2, 3, 4, 8, 11, 15, 16]   # stable ids; KEEP is labelled Model 1-14 in this order
LABEL = {f'starter-exact-{n}': f'Model {i + 1}' for i, n in enumerate(KEEP)}
OLD_DEFAULT = {f'starter-exact-{n}': f'Model {n}' for n in KEEP if n < 17}   # names before the relabel
def relabeled(rec):   # what relabelStarters() makes of a stored record
  return {**rec, 'name': LABEL[rec['id']]} if rec.get('starter') is True and OLD_DEFAULT.get(rec.get('id')) == rec.get('name') else rec
REMOVED_IDS = [f'starter-exact-{n}' for n in REMOVED] + ['starter-photoreal-1', 'starter-photoreal-2']   # Photoreal 1-2 removed 2026-10-19
NEW_EXACT = [f'starter-exact-{n}' for n in KEEP if n >= 17]   # added after the relabel: Model 9 (exact-17), Model 10-14 (exact-18..22)
GEN_OUTFITS = [('base', 'Base', 'generated-1'), ('summer-denim', 'Summer denim', 'generated-1-summer-denim'), ('sundress', 'Sundress', 'generated-1-sundress'), ('linen-set', 'Linen set', 'generated-1-linen-set')]
GEN2_OUTFITS = [('base', 'Base', 'generated-2'), ('yoga-set', 'Yoga set', 'generated-2-yoga-set')]
M1_OUTFITS = [('base', 'Base', 'exact-5'), ('tank-shorts', 'Tank & shorts', 'exact-5-tank-shorts'), ('yoga-set', 'Yoga set', 'exact-5-yoga-set'), ('linen-set', 'Linen set', 'exact-5-linen-set'), ('red-dress', 'Red dress', 'exact-5-red-dress')]
M2_OUTFITS = [('base', 'Base', 'exact-6'), ('yoga-set', 'Yoga set', 'exact-6-yoga-set'), ('turtleneck', 'Turtleneck', 'generated-3-turtleneck'), ('slip-dress', 'Slip dress', 'generated-3-slip-dress'), ('tank-shorts', 'Tank & shorts', 'generated-3-tank-shorts'), ('usa-jersey', 'USA jersey', 'exact-6-usa-jersey')]
M13_OUTFITS = [('base', 'Base', 'exact-21'), ('beige-linen', 'Beige Linen', 'exact-21-beige-linen'), ('a', 'A', 'exact-21-a')]
M17_OUTFITS = [('base', 'Base', 'exact-25'), ('red-dress', 'Red dress', 'exact-25-red-dress'), ('leather-catsuit', 'Leather catsuit', 'exact-25-leather-catsuit'), ('tech-suit', 'Tech suit', 'exact-25-tech-suit')]
GEN3_OUTFITS = [('base', 'Base', 'generated-3'), ('turtleneck', 'Turtleneck', 'generated-3-turtleneck'), ('slip-dress', 'Slip dress', 'generated-3-slip-dress'), ('tank-shorts', 'Tank & shorts', 'generated-3-tank-shorts')]
FILES = [f'exact-{n}' for n in KEEP] + [o[2] for o in M1_OUTFITS[1:]] + [o[2] for o in M2_OUTFITS[1:]] + [o[2] for o in M17_OUTFITS[1:]] + [o[2] for o in M13_OUTFITS[1:]] + [o[2] for o in GEN_OUTFITS] + [o[2] for o in GEN2_OUTFITS] + [o[2] for o in GEN3_OUTFITS]
NEW = {f'{m}-{k}': sha((ROOT / f'assets/models/{m}-{k}.webp').read_bytes()) for m in FILES for k in K}
REVS = dict(re.findall(r"id: '(starter-[a-z]+-\d+)'.*?assetRev: '([0-9a-f]+)'", (ROOT / 'js/starters.js').read_text()))
EXACT = [f'starter-exact-{n}' for n in KEEP]
ALL_NEW = EXACT + ['starter-generated-1', 'starter-generated-2', 'starter-generated-3']
LATER = [f'starter-exact-{n}' for n in KEEP if n >= 6]   # every kept exact starter after exact-5 (incl. new exact-17..22)
KNOWN_AFTER = sorted(set(ALL_NEW) | set(REMOVED_IDS))   # removed ids stay known, so they are never re-added
NEW_15_16 = {'starter-exact-23', 'starter-exact-24', 'starter-exact-25'}   # Models 15-16 (2026-10-19) and Model 17 (2026-10-20): every older install gains them once
UI_STARTERS = [f'Model {i + 1}' for i in range(len(KEEP))]
assert sorted(REVS) == sorted(ALL_NEW), REVS
for n in REMOVED: assert not (ROOT / f'assets/models/exact-{n}-front.webp').exists()
assert not (ROOT / 'assets/models/photoreal-1-front.webp').exists()

IDB = """async ([store, op, val]) => { const db = await new Promise((r, j) => { const q = indexedDB.open('avata'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const res = await new Promise((r, j) => { const t = db.transaction(store, op === 'get' || op === 'all' ? 'readonly' : 'readwrite'); const s = t.objectStore(store);
    const q = op === 'all' ? s.getAll() : op === 'get' ? s.get(val) : op === 'del' ? s.delete(val) : s.put(val); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  db.close(); return res; }"""
SNAP = """async () => { const db = await new Promise((r, j) => { const q = indexedDB.open('avata'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const all = st => new Promise(r => { const q = db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => r(q.result); });
  const h = async b => b instanceof Blob ? 'sha:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('')
    : Array.isArray(b) ? Promise.all(b.map(h)) : b && typeof b === 'object' ? Object.fromEntries(await Promise.all(Object.entries(b).map(async ([k, v]) => [k, await h(v)]))) : b; // outfits: [{..., front: Blob}]
  const out = {}; for (const st of ['models', 'looks']) { out[st] = {}; for (const rec of await all(st)) { const o = {}; for (const [k, v] of Object.entries(rec)) o[k] = await h(v); out[st][rec.id] = o; } }
  db.close(); return out; }"""
R, errors, ok = {}, [], True
def check(name, cond):
  global ok; R[name] = bool(cond); ok &= bool(cond)
def serve(d):
  s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
  return subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL), f'http://127.0.0.1:{port}/'
def deploy(d):
  for f in ['index.html', 'sw.js', 'styles.css', 'manifest.webmanifest']: shutil.copy(ROOT / f, d / f)
  shutil.copytree(ROOT / 'js', d / 'js', dirs_exist_ok=True); shutil.copytree(ROOT / 'assets', d / 'assets', dirs_exist_ok=True)
def ctx(b):
  c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = c.new_page()
  pg.on('pageerror', lambda e: errors.append(str(e))); return c, pg
def imgs_current(m, f): return all(m.get(k) == 'sha:' + NEW[f'{f}-{k}'] for k in K)
def gen_ok(M):  # Generated 1 = one model record carrying all 4 outfits (current images); top-level images = her base outfit
  g = M.get('starter-generated-1', {}); o = g.get('outfits') or []
  return (g.get('name') == 'Generated 1' and g.get('starter') is True and g.get('assetRev') == REVS['starter-generated-1'] and imgs_current(g, 'generated-1')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in GEN_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, GEN_OUTFITS))
          and not any(k.startswith('starter-generated-1-') or 'summer' in k for k in M))
def gen2_ok(M):  # Generated 2 = one model record carrying both outfits (current images); top-level images = her base outfit
  g = M.get('starter-generated-2', {}); o = g.get('outfits') or []
  return (g.get('name') == 'Generated 2' and g.get('starter') is True and g.get('assetRev') == REVS['starter-generated-2'] and imgs_current(g, 'generated-2')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in GEN2_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, GEN2_OUTFITS))
          and not any(k.startswith('starter-generated-2-') for k in M))
def gen3_ok(M):  # Generated 3 = Model 2 in black: one model record carrying all 4 outfits (current images)
  g = M.get('starter-generated-3', {}); o = g.get('outfits') or []
  return (g.get('name') == 'Generated 3' and g.get('starter') is True and g.get('assetRev') == REVS['starter-generated-3'] and imgs_current(g, 'generated-3')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in GEN3_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, GEN3_OUTFITS))
          and not any(k.startswith('starter-generated-3-') for k in M))
def m1_ok(M, prev=None):  # Model 1 = one record carrying Base + Tank & shorts (current images); an upgraded record keeps every other field
  g = M.get('starter-exact-5', {}); o = g.get('outfits') or []
  same = prev is None or {k: v for k, v in g.items() if k not in (*K, 'outfits', 'assetRev')} == {k: v for k, v in relabeled(prev).items() if k not in (*K, 'outfits', 'assetRev')}
  return (same and g.get('starter') is True and g.get('assetRev') == REVS['starter-exact-5'] and imgs_current(g, 'exact-5')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in M1_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, M1_OUTFITS)))
def m2_ok(M, prev=None):  # Model 2 = one record carrying Base + Yoga set (current images); an upgraded record keeps every other field
  g = M.get('starter-exact-6', {}); o = g.get('outfits') or []
  same = prev is None or {k: v for k, v in g.items() if k not in (*K, 'outfits', 'assetRev')} == {k: v for k, v in relabeled(prev).items() if k not in (*K, 'outfits', 'assetRev')}
  return (same and g.get('starter') is True and g.get('assetRev') == REVS['starter-exact-6'] and imgs_current(g, 'exact-6')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in M2_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, M2_OUTFITS)))
def no_photoreal(M, L=None):  # Photoreal 1-2 gone; their app-seeded sample looks gone
  return not any('photoreal' in k for k in M) and (L is None or not any(k.startswith('sample-look-') for k in L))
def m17_ok(M, prev=None):  # Model 17 = one record carrying Base, Red dress, Leather catsuit, Tech suit (current images); an upgraded record keeps every other field
  g = M.get('starter-exact-25', {}); o = g.get('outfits') or []
  same = prev is None or {k: v for k, v in g.items() if k not in (*K, 'outfits', 'assetRev')} == {k: v for k, v in prev.items() if k not in (*K, 'outfits', 'assetRev')}
  return (same and g.get('starter') is True and g.get('assetRev') == REVS['starter-exact-25'] and imgs_current(g, 'exact-25')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in M17_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, M17_OUTFITS)))
def m13_ok(M, prev=None):  # Model 13 = one record carrying Base + Beige Linen (current images); an upgraded record keeps every other field
  g = M.get('starter-exact-21', {}); o = g.get('outfits') or []
  same = prev is None or {k: v for k, v in g.items() if k not in (*K, 'outfits', 'assetRev')} == {k: v for k, v in relabeled(prev).items() if k not in (*K, 'outfits', 'assetRev')}
  return (same and g.get('starter') is True and g.get('assetRev') == REVS['starter-exact-21'] and imgs_current(g, 'exact-21')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in M13_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, M13_OUTFITS)))
def kept(M, before, f=lambda v: v):  # every surviving record unchanged (relabel aside), except Models 1, 2, 13 and 17, which only gain their outfits
  return (all(M[k] == f(v) for k, v in before.items() if k not in REMOVED_IDS and k not in ('starter-exact-5', 'starter-exact-6', 'starter-exact-21', 'starter-exact-25'))
          and ('starter-exact-21' not in before or m13_ok(M, before['starter-exact-21']))
          and ('starter-exact-5' not in before or m1_ok(M, before['starter-exact-5'])) and ('starter-exact-6' not in before or m2_ok(M, before['starter-exact-6']))
          and ('starter-exact-25' not in before or m17_ok(M, before['starter-exact-25'])))
def ui_names(pg, base):
  pg.goto(base + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(500); return pg.locator('.lib-card .nm').all_inner_texts()

servers = []
try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    def no_removed(M): return not any(k in M for k in REMOVED_IDS)
    def added_ok(M, ids): return all(M.get(s, {}).get('name') == LABEL[s] and M[s].get('starter') is True and imgs_current(M[s], s.replace('starter-', '')) and M[s].get('assetRev') == REVS[s] for s in ids)
    M1_SAMPLES = {'sample-look-model-1-front', 'sample-look-model-1-back', 'sample-look-model-1-sheet'}
    M2_SAMPLES = {'sample-look-model-2-front', 'sample-look-model-2-back', 'sample-look-model-2-sheet'}   # Photoreal 1's, removed with her

    # ---------------- A) legacy (Models 1+2 only) ----------------
    A = site('e9c1066^'); srv, BASE = serve(A); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(800)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-model-1']); m.name = 'Ava (renamed)'; m.note = 'my own note'; m.heightCm = 171; await f(['models', 'put', m]);
      const front = (await f(['models', 'get', 'starter-model-2'])).front;
      await f(['models', 'put', { id: 'user-model-x', name: 'My Model', front, back: null, sheet: null, thumb: front, heightCm: 165, createdAt: Date.now(), starter: false }]);
      const m1 = await f(['models', 'get', 'starter-model-1']);
      await f(['looks', 'put', { id: 'gen-look-1', image: m1.front, thumb: m1.thumb, modelId: 'starter-model-1', styleIds: [], view: 'front', title: 'My render', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      const sl = await f(['looks', 'get', 'sample-look-model-1-front']); sl.title = 'Edited sample'; sl.favorite = true; await f(['looks', 'put', sl]);
      await f(['looks', 'del', 'sample-look-model-2-back']); }""", IDB)
    before = pg.evaluate(SNAP)
    deploy(A); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(2500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('A_model1_removed_even_renamed', 'starter-exact-1' not in M and not any(m.get('name') == 'Ava (renamed)' for m in M.values()))
    check('A_model2_photoreal1_removed', no_photoreal(M, L))
    check('A_no_old_ids_left', not any(k.startswith('starter-model-') for k in M))
    check('A_user_model_untouched', M.get('user-model-x') == before['models']['user-model-x'])
    check('A_generated_look_on_model1_kept_detached', {**L['gen-look-1'], 'modelId': 0} == {**before['looks']['gen-look-1'], 'modelId': 0} and L['gen-look-1']['modelId'] is None)
    check('A_model1_sample_looks_removed', not (M1_SAMPLES & set(L)))
    check('A_photoreal_sample_looks_removed', not (M2_SAMPLES & set(L)) and set(L) == set(before['looks']) - M1_SAMPLES - M2_SAMPLES)
    check('A_remaining_exact_added_once', added_ok(M, EXACT) and set(M) == {'user-model-x', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', *EXACT} and no_removed(M) and m1_ok(M))
    check('A_generated1_with_4_outfits', gen_ok(M))
    R['A_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('A_known', sorted(R['A_known_list']) == KNOWN_AFTER)
    R['A_ui_names'] = names; check('A_ui_names', names == UI_STARTERS + ['Generated 1', 'Generated 2', 'Generated 3', 'My Model'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-upgrade.png'))
    pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500); check('A_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-exact-6']); pg.evaluate(IDB, ['models', 'del', 'starter-generated-1']); gone = pg.evaluate(SNAP)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('A_deleted_starters_stay_deleted', pg.evaluate(SNAP) == gone)
    c.close()

    # ---------------- B) previous release (Models 1-6, old ids) ----------------
    B = site('4d0c090'); srv, BASE = serve(B); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 6"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m6 = await f(['models', 'get', 'starter-model-6']); m6.name = 'Platinum (mine)'; m6.heightCm = 175; await f(['models', 'put', m6]);
      const m3 = await f(['models', 'get', 'starter-model-3']); m3.note = 'note on 3'; await f(['models', 'put', m3]);
      await f(['models', 'del', 'starter-model-4']);
      const m5 = await f(['models', 'get', 'starter-model-5']);
      await f(['looks', 'put', { id: 'gen-on-5', image: m5.front, thumb: m5.thumb, modelId: 'starter-model-5', styleIds: [], view: 'front', title: 'Render on old 5', tags: [], favorite: false, source: 'generated', createdAt: Date.now() }]);
      await f(['looks', 'put', { id: 'gen-on-6', image: m6.front, thumb: m6.thumb, modelId: 'starter-model-6', styleIds: [], view: 'front', title: 'Render on 6', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      await f(['models', 'put', { id: 'user-model-y', name: 'Model 5', front: m5.front, back: null, sheet: null, thumb: m5.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('B_old_install_has_old_ids', {'starter-model-1', 'starter-model-2', 'starter-model-3', 'starter-model-5', 'starter-model-6'} <= set(before['models']))
    deploy(B); pg.goto(BASE); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(2500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('B_old_model5_deleted', 'starter-model-5' not in M and not any(m.get('note', '').startswith('Long wavy black hair, deep tan') and m.get('id') != 'starter-exact-5' for m in M.values()))
    check('B_look_on_old5_kept_detached', {**L['gen-on-5'], 'modelId': 0} == {**before['looks']['gen-on-5'], 'modelId': 0} and L['gen-on-5']['modelId'] is None)
    check('B_renumbered_models_then_removed', no_removed(M) and not any(m.get('name') == 'Platinum (mine)' or m.get('note') == 'note on 3' for m in M.values()))
    check('B_look_on_6_kept_detached', {**L['gen-on-6'], 'modelId': 0} == {**before['looks']['gen-on-6'], 'modelId': 0} and L['gen-on-6']['modelId'] is None)
    check('B_model2_photoreal1_removed', no_photoreal(M, L))
    e5 = M.get('starter-exact-5', {}); check('B_new_model5_added_once', e5.get('name') == 'Model 1' and m1_ok(M))
    check('B_user_models_untouched', M.get('user-model-y') == before['models']['user-model-y'])
    check('B_remaining_6_14_added_once', added_ok(M, LATER))
    check('B_exact_set', set(M) == {*EXACT, 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', 'user-model-y'})
    check('B_generated1_with_4_outfits', gen_ok(M))
    check('B_looks_kept_except_sample_looks', set(L) == set(before['looks']) - M1_SAMPLES - M2_SAMPLES)
    R['B_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('B_known', sorted(R['B_known_list']) == KNOWN_AFTER)
    R['B_ui_names'] = names
    check('B_ui', names == UI_STARTERS + ['Generated 1', 'Generated 2', 'Generated 3', 'Model 5'])   # the user's own 'Model 5' after the starters
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-renumber.png'))
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('B_idempotent', pg.evaluate(SNAP) == after)
    c.close()

    # ---------------- C) fresh install ----------------
    c, pg = ctx(b)
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    fresh = pg.evaluate(SNAP)
    check('C_fresh_all_starters', all(fresh['models'].get(s, {}).get('assetRev') == REVS[s] for s in ALL_NEW) and set(fresh['models']) == set(ALL_NEW))
    check('C_fresh_order', [k for k, v in sorted(fresh['models'].items(), key=lambda kv: kv[1]['createdAt'])] == ALL_NEW)
    check('C_fresh_generated1_with_4_outfits', gen_ok(fresh['models']))
    check('C_fresh_generated2_with_2_outfits', gen2_ok(fresh['models']))
    check('C_fresh_generated3_with_4_outfits', gen3_ok(fresh['models']))
    check('C_fresh_model1_with_2_outfits', m1_ok(fresh['models']))
    check('C_fresh_no_photoreal_no_sample_looks', no_photoreal(fresh['models'], fresh['looks']))
    check('C_fresh_known', sorted(pg.evaluate(IDB, ['kv', 'get', 'knownStarters'])) == KNOWN_AFTER)
    R['C_ui_names'] = pg.locator('.lib-card .nm').all_inner_texts()
    check('C_ui_names', R['C_ui_names'] == UI_STARTERS + ['Generated 1', 'Generated 2', 'Generated 3'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-fresh.png'), full_page=True)
    c.close()

    # ---------------- D) Model 1-5 release (new ids) → Models 1, 2, 4 dropped; remaining 6-14 added once ----------------
    D = site('8d138e9'); srv, BASE = serve(D); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 6"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m5 = await f(['models', 'get', 'starter-exact-5']); m5.name = 'Wavy (mine)'; m5.heightCm = 168; await f(['models', 'put', m5]);
      await f(['models', 'del', 'starter-exact-3']);
      await f(['models', 'put', { id: 'user-model-z', name: 'My Own', front: m5.front, back: null, sheet: null, thumb: m5.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]);
      await f(['models', 'put', { id: 'user-model-w', name: 'My Second', front: m5.front, back: null, sheet: null, thumb: m5.thumb, heightCm: 160, createdAt: Date.now() + 5, starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('D_old_install_is_model1_5', set(before['models']) == {'starter-exact-1', 'starter-exact-2', 'starter-exact-4', 'starter-exact-5', 'starter-photoreal-1', 'user-model-z', 'user-model-w'})
    deploy(D); pg.goto(BASE); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('D_remaining_6_14_added_once', added_ok(M, LATER))
    check('D_exact_set', set(M) == {'starter-exact-5', 'user-model-z', 'user-model-w', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', *LATER} and no_removed(M))
    check('D_generated1_with_4_outfits', gen_ok(M))
    check('D_kept_records_untouched_model1_gains_outfit', kept(M, before['models']) and M['starter-exact-5']['name'] == 'Wavy (mine)')
    R['D_ui_names'] = names
    check('D_ui_order', names == ['Wavy (mine)'] + UI_STARTERS[1:] + ['Generated 1', 'Generated 2', 'Generated 3', 'My Own', 'My Second'])
    R['D_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('D_known', sorted(R['D_known_list']) == KNOWN_AFTER)
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-m6-15.png'), full_page=True)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('D_idempotent', pg.evaluate(SNAP) == after and ui_names(pg, BASE) == names)
    c.close()

    # ---------------- E) Model 1-15 release → renamed Model 15 dropped, Generated 1 (one model, 4 outfits) added once ----------------
    E = site('7781450'); srv, BASE = serve(E); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 16"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-exact-15']); m.name = 'Gold (mine)'; await f(['models', 'put', m]);
      await f(['models', 'put', { id: 'user-model-e', name: 'Mine E', front: m.front, back: null, sheet: null, thumb: m.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('E_old_install_has_no_generated', 'starter-generated-1' not in before['models'] and len(before['models']) == 17)
    deploy(E); pg.goto(BASE); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('E_generated1_added_once_with_4_outfits', gen_ok(M) and set(M) == (set(before['models']) - set(REMOVED_IDS)) | {'starter-generated-1', 'starter-generated-2', 'starter-generated-3', *NEW_EXACT} and added_ok(M, NEW_EXACT))
    check('E_removed_dropped_even_renamed_model15', no_removed(M) and not any(m.get('name') == 'Gold (mine)' for m in M.values()))
    check('E_kept_records_relabeled_only', kept(M, before['models'], relabeled))
    R['E_ui_names'] = names
    check('E_ui_order', names == UI_STARTERS + ['Generated 1', 'Generated 2', 'Generated 3', 'Mine E'])
    pg.goto(BASE + '#/model/starter-generated-1'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    R['E_detail_chips'] = pg.locator('#mOutfits .oc').all_inner_texts()
    pg.click('#mOutfits .oc[data-i="2"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('E_detail_outfit_switch', [c.strip() for c in R['E_detail_chips']] == ['Base', 'Summer denim', 'Sundress', 'Linen set'] and sel == [NEW['generated-1-sundress-front'], NEW['generated-1-sundress-back'], 'Sundress'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-generated-1-detail.png'))
    R['E_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('E_known', sorted(R['E_known_list']) == KNOWN_AFTER)
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('E_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-generated-1']); gone = pg.evaluate(SNAP)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('E_deleted_generated_stays_deleted', pg.evaluate(SNAP) == gone and 'starter-generated-1' not in gone['models'])
    c.close()

    # ---------------- F) Model 1-16 + Generated 1 release (eb3faca, live before this change) → the 8 removed starters dropped once ----------------
    F = site('eb3faca'); srv, BASE = serve(F); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 18"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const g = await f(['models', 'get', 'starter-generated-1']); g.name = 'Chestnut (mine)'; await f(['models', 'put', g]);
      const m16 = await f(['models', 'get', 'starter-exact-16']); m16.name = 'Bun (mine)'; await f(['models', 'put', m16]);
      const m9 = await f(['models', 'get', 'starter-exact-9']); m9.name = 'Silver (mine)'; m9.heightCm = 172; await f(['models', 'put', m9]);
      const m8 = await f(['models', 'get', 'starter-exact-8']);
      await f(['looks', 'put', { id: 'gen-on-8', image: m8.front, thumb: m8.thumb, modelId: 'starter-exact-8', styleIds: [], view: 'front', title: 'Render on 8', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      await f(['looks', 'put', { id: 'gen-on-9', image: m8.front, thumb: m8.thumb, modelId: 'starter-exact-9', styleIds: [], view: 'front', title: 'Render on 9', tags: [], favorite: false, source: 'generated', createdAt: Date.now() }]);
      await f(['models', 'put', { id: 'user-model-f', name: 'Mine F', front: g.front, back: null, sheet: null, thumb: g.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('F_old_install_has_all_16', all(f'starter-exact-{n}' in before['models'] for n in range(1, 17)) and len(before['models']) == 19)
    deploy(F); pg.goto(BASE); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('F_generated2_added_once', gen2_ok(M))
    check('F_removed_dropped_once_even_renamed', no_removed(M) and not any(m.get('name') == 'Bun (mine)' for m in M.values()))
    check('F_model_set', set(M) == {*EXACT, 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', 'user-model-f'} and added_ok(M, NEW_EXACT))
    check('F_kept_records_relabeled_only', kept(M, before['models'], relabeled))
    check('F_user_renamed_starter_kept', M['starter-exact-9']['name'] == 'Silver (mine)' and M['starter-exact-9']['heightCm'] == 172 and M['starter-exact-10']['name'] == 'Model 5' and M['starter-exact-5']['name'] == 'Model 1')
    check('F_user_model_and_renamed_generated_kept', M['user-model-f'] == before['models']['user-model-f'] and M['starter-generated-1']['name'] == 'Chestnut (mine)')
    check('F_look_on_removed_8_kept_detached', {**L['gen-on-8'], 'modelId': 0} == {**before['looks']['gen-on-8'], 'modelId': 0} and L['gen-on-8']['modelId'] is None)
    check('F_look_on_kept_9_untouched', L['gen-on-9'] == before['looks']['gen-on-9'])
    check('F_looks_kept_except_sample_looks', set(L) == set(before['looks']) - M1_SAMPLES - M2_SAMPLES)
    R['F_ui_names'] = names
    check('F_ui_order', names == UI_STARTERS[:3] + ['Silver (mine)'] + UI_STARTERS[4:] + ['Chestnut (mine)', 'Generated 2', 'Generated 3', 'Mine F'])
    check('F_relabel_flag', pg.evaluate(IDB, ['kv', 'get', 'relabel-2026-10-18']) is True)
    R['F_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('F_known', sorted(R['F_known_list']) == KNOWN_AFTER)
    check('F_removal_flag', pg.evaluate(IDB, ['kv', 'get', 'removed-starters-2026-10-18']) is True)
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-removal.png'), full_page=True)
    for _ in range(3): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('F_idempotent_never_readded', pg.evaluate(SNAP) == after and ui_names(pg, BASE) == names)
    c.close()
    # ---------------- G) Model 1-9 + Photoreal 1 + Generated 1 release (457192b, live before this change) → Generated 2 added once ----------------
    G = site('457192b'); srv, BASE = serve(G); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 11"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const g = await f(['models', 'get', 'starter-generated-1']); g.name = 'Chestnut (mine)'; await f(['models', 'put', g]);
      const m3 = await f(['models', 'get', 'starter-exact-7']); m3.name = 'Auburn (mine)'; await f(['models', 'put', m3]);
      await f(['models', 'del', 'starter-exact-12']);
      await f(['models', 'put', { id: 'user-model-g', name: 'Mine G', front: g.front, back: null, sheet: null, thumb: g.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('G_old_install_has_no_generated2', 'starter-generated-2' not in before['models'] and 'starter-generated-1' in before['models'] and len(before['models']) == 11)
    deploy(G); pg.goto(BASE); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('G_generated2_and_models_10_14_added_once', gen2_ok(M) and set(M) == (set(before['models']) - set(REMOVED_IDS)) | {'starter-generated-2', 'starter-generated-3', *NEW_EXACT[1:]} and added_ok(M, NEW_EXACT[1:]) and no_photoreal(M))
    check('G_existing_records_untouched', kept(M, before['models']))
    check('G_deleted_model6_stays_deleted', 'starter-exact-12' not in M)
    R['G_ui_names'] = names
    check('G_ui_order', names == UI_STARTERS[:2] + ['Auburn (mine)'] + UI_STARTERS[3:5] + UI_STARTERS[6:] + ['Chestnut (mine)', 'Generated 2', 'Generated 3', 'Mine G'])
    check('G_models_10_14_after_model_9', names[7:13] == ['Model 9', 'Model 10', 'Model 11', 'Model 12', 'Model 13', 'Model 14'])
    R['G_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('G_known', sorted(R['G_known_list']) == KNOWN_AFTER)
    pg.goto(BASE + '#/model/starter-generated-2'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    R['G_detail_chips'] = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]
    pg.click('#mOutfits .oc[data-i="1"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('G_detail_outfit_switch', R['G_detail_chips'] == ['Base', 'Yoga set'] and sel == [NEW['generated-2-yoga-set-front'], NEW['generated-2-yoga-set-back'], 'Yoga set'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-generated-2-detail.png'))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('G_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-generated-2']); gone = pg.evaluate(SNAP)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('G_deleted_generated2_stays_deleted', pg.evaluate(SNAP) == gone and 'starter-generated-2' not in gone['models'])
    c.close()
    # ---------------- H) Generated 2 release (1de7a72, live before this change) → Models 10-14 added once ----------------
    H = site('1de7a72'); srv, BASE = serve(H); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 12"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-exact-17']); m.name = 'Bob (mine)'; await f(['models', 'put', m]);
      await f(['models', 'put', { id: 'user-model-h', name: 'Model 10', front: m.front, back: null, sheet: null, thumb: m.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('H_old_install_has_12_starters', len(before['models']) == 13 and not any(k in before['models'] for k in NEW_EXACT[1:]))
    deploy(H); pg.goto(BASE); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('H_models_10_14_added_once', set(M) == (set(before['models']) - set(REMOVED_IDS)) | set(NEW_EXACT[1:]) | {'starter-generated-3'} and added_ok(M, NEW_EXACT[1:]) and no_photoreal(M))
    check('H_existing_records_untouched', kept(M, before['models']))
    R['H_ui_names'] = names
    check('H_ui_order', names == UI_STARTERS[:8] + ['Bob (mine)'] + UI_STARTERS[9:] + ['Generated 1', 'Generated 2', 'Generated 3', 'Model 10'])   # the user's own 'Model 10' stays after the starters
    R['H_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('H_known', sorted(R['H_known_list']) == KNOWN_AFTER)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('H_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-exact-20']); gone = pg.evaluate(SNAP)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('H_deleted_model12_stays_deleted', pg.evaluate(SNAP) == gone)
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-m10-14.png'), full_page=True)
    c.close()
    # ---------------- I) Models 10-14 release (2e814c1, live before this change) → Generated 3 (Model 2 in black, 4 outfits) added once ----------------
    I = site('2e814c1'); srv, BASE = serve(I); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 17"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-exact-6']); m.name = 'Pink (mine)'; await f(['models', 'put', m]);
      await f(['models', 'put', { id: 'user-model-i', name: 'Mine I', front: m.front, back: null, sheet: null, thumb: m.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('I_old_install_has_no_generated3', 'starter-generated-3' not in before['models'] and len(before['models']) == 18)
    deploy(I); pg.goto(BASE); pg.reload(); pg.wait_for_selector('#app, body'); pg.wait_for_timeout(1000); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('I_generated3_added_once_with_4_outfits_photoreal_dropped', gen3_ok(M) and no_photoreal(M) and set(M) == (set(before['models']) - set(REMOVED_IDS)) | {'starter-generated-3'} | NEW_15_16)
    check('I_existing_records_untouched_incl_model2', kept(M, before['models']) and M['starter-exact-6']['name'] == 'Pink (mine)')
    R['I_ui_names'] = names
    check('I_ui_order', names == UI_STARTERS[:1] + ['Pink (mine)'] + UI_STARTERS[2:] + ['Generated 1', 'Generated 2', 'Generated 3', 'Mine I'])
    R['I_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('I_known', sorted(R['I_known_list']) == KNOWN_AFTER)
    pg.goto(BASE + '#/model/starter-generated-3'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    R['I_detail_chips'] = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]
    pg.click('#mOutfits .oc[data-i="3"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('I_detail_outfit_switch', R['I_detail_chips'] == ['Base', 'Turtleneck', 'Slip dress', 'Tank & shorts'] and sel == [NEW['generated-3-tank-shorts-front'], NEW['generated-3-tank-shorts-back'], 'Tank & shorts'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-generated-3-detail.png'))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('I_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-generated-3']); gone = pg.evaluate(SNAP)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('I_deleted_generated3_stays_deleted', pg.evaluate(SNAP) == gone)
    c.close()
    # ---------------- J) Generated 3 + Photoreal 2 release (5664f6d, live before this change) → Photoreal 1-2 dropped once; Model 1 gains Tank & shorts ----------------
    J = site('5664f6d'); srv, BASE = serve(J); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 19"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const p1 = await f(['models', 'get', 'starter-photoreal-1']); p1.name = 'Curls (mine)'; await f(['models', 'put', p1]);
      const p2 = await f(['models', 'get', 'starter-photoreal-2']);
      await f(['looks', 'put', { id: 'gen-on-p2', image: p2.front, thumb: p2.thumb, modelId: 'starter-photoreal-2', styleIds: [], view: 'front', title: 'Render on Photoreal 2', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      const m1 = await f(['models', 'get', 'starter-exact-5']); m1.name = 'Ava (mine)'; m1.heightCm = 166; await f(['models', 'put', m1]);
      await f(['models', 'put', { id: 'user-model-j', name: 'Mine J', front: m1.front, back: null, sheet: null, thumb: m1.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP)
    check('J_old_install_has_photoreal_1_2', {'starter-photoreal-1', 'starter-photoreal-2', 'starter-generated-3'} <= set(before['models']) and len(before['models']) == 20 and not before['models']['starter-exact-5'].get('outfits'))
    deploy(J); pg.goto(BASE); pg.reload(); pg.wait_for_timeout(3500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('J_photoreal_1_2_dropped_once_even_renamed', no_photoreal(M, L) and not any(m.get('name') == 'Curls (mine)' for m in M.values()) and set(M) == (set(before['models']) - {'starter-photoreal-1', 'starter-photoreal-2'}) | NEW_15_16)
    check('J_look_on_photoreal2_kept_detached', {**L['gen-on-p2'], 'modelId': 0} == {**before['looks']['gen-on-p2'], 'modelId': 0} and L['gen-on-p2']['modelId'] is None)
    check('J_generated3_kept_with_4_outfits', gen3_ok(M) and M['starter-generated-3'] == before['models']['starter-generated-3'])
    check('J_model1_gains_tank_shorts_keeps_edits', m1_ok(M, before['models']['starter-exact-5']) and M['starter-exact-5']['name'] == 'Ava (mine)' and M['starter-exact-5']['heightCm'] == 166)
    check('J_other_records_untouched', kept(M, before['models']) and M['user-model-j'] == before['models']['user-model-j'])
    R['J_ui_names'] = names
    check('J_ui_order', names == ['Ava (mine)'] + UI_STARTERS[1:] + ['Generated 1', 'Generated 2', 'Generated 3', 'Mine J'])
    R['J_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('J_known', sorted(R['J_known_list']) == KNOWN_AFTER)
    check('J_removal_flag', pg.evaluate(IDB, ['kv', 'get', 'removed-starters-2026-10-19']) is True)
    pg.goto(BASE + '#/model/starter-exact-5'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    R['J_detail_chips'] = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]
    pg.click('#mOutfits .oc[data-i="1"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('J_model1_detail_outfit_switch', R['J_detail_chips'] == [o[1] for o in M1_OUTFITS] and sel == [NEW['exact-5-tank-shorts-front'], NEW['exact-5-tank-shorts-back'], 'Tank & shorts'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-model-1-tank-shorts.png'))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(3): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('J_idempotent_never_readded', pg.evaluate(SNAP) == after and ui_names(pg, BASE) == names)
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-photoreal-removal.png'), full_page=True)
    c.close()
    # ---------------- K) Model 1 Tank & shorts release (c217703, live before this change) → Model 1 gains Yoga set + Linen set, Model 2 gains Yoga set, in place, edits kept ----------------
    Kd = site('c217703'); srv, BASE = serve(Kd); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 17"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m1 = await f(['models', 'get', 'starter-exact-5']); m1.name = 'Ava (mine)'; m1.heightCm = 166; m1.note = 'my note'; await f(['models', 'put', m1]);
      const m2 = await f(['models', 'get', 'starter-exact-6']); m2.name = 'Pink (mine)'; m2.heightCm = 171; await f(['models', 'put', m2]);
      await f(['looks', 'put', { id: 'gen-on-m2', image: m2.front, thumb: m2.thumb, modelId: 'starter-exact-6', styleIds: [], view: 'front', title: 'Render on Model 2', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      await f(['models', 'put', { id: 'user-model-k', name: 'Mine K', front: m1.front, back: null, sheet: null, thumb: m1.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP); BM = before['models']
    check('K_old_install_model1_2_outfits_model2_none', [o.get('id') for o in BM['starter-exact-5'].get('outfits') or []] == ['base', 'tank-shorts'] and not BM['starter-exact-6'].get('outfits') and len(BM) == 18)
    deploy(Kd); pg.goto(BASE); pg.reload(); pg.wait_for_timeout(3500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('K_model1_gains_yoga_linen_keeps_edits', m1_ok(M, BM['starter-exact-5']) and M['starter-exact-5']['name'] == 'Ava (mine)' and M['starter-exact-5']['heightCm'] == 166 and M['starter-exact-5']['note'] == 'my note')
    check('K_model2_gains_yoga_keeps_edits', m2_ok(M, BM['starter-exact-6']) and M['starter-exact-6']['name'] == 'Pink (mine)' and M['starter-exact-6']['heightCm'] == 171)
    check('K_models_15_16_17_added_once', NEW_15_16 - set(BM) == NEW_15_16 and M['starter-exact-25']['name'] == 'Model 17' and [o.get('id') for o in M['starter-exact-25'].get('outfits') or []] == [o[0] for o in M17_OUTFITS] and M['starter-exact-23']['name'] == 'Model 15' and M['starter-exact-24']['name'] == 'Model 16' and imgs_current(M['starter-exact-23'], 'exact-23') and imgs_current(M['starter-exact-24'], 'exact-24'))
    check('K_same_records_others_untouched', set(M) == set(BM) | NEW_15_16 and kept(M, BM) and M['user-model-k'] == BM['user-model-k'] and L == before['looks'])
    R['K_ui_names'] = names; check('K_ui_order', names == ['Ava (mine)', 'Pink (mine)'] + UI_STARTERS[2:] + ['Generated 1', 'Generated 2', 'Generated 3', 'Mine K'])
    for mid, outs, shot in (('starter-exact-5', M1_OUTFITS, 'starters-model-1-yoga-linen'), ('starter-exact-6', M2_OUTFITS, 'starters-model-2-yoga')):
      pg.goto(BASE + '#/model/' + mid); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
      chips = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]; R[f'K_{mid}_chips'] = chips; bad = []
      for i, (oid, nm, f) in enumerate(outs):
        pg.click(f'#mOutfits .oc[data-i="{i}"]'); pg.wait_for_timeout(400)
        sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
          return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
        if sel != [NEW[f'{f}-front'], NEW[f'{f}-back'], nm]: bad.append(oid)
        if oid == 'yoga-set': pg.screenshot(path=str(ROOT / f'screenshots/{shot}.png'))
      check(f'K_{mid}_detail_outfit_switch', chips == [o[1] for o in outs] and not bad)
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(3): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('K_idempotent', pg.evaluate(SNAP) == after)
    c.close()
    # ---------------- L) Model 17 Base + Red dress release (f2c6373, live before this change) → Model 17 gains Leather catsuit + Tech suit in place, edits kept ----------------
    Ld = site('f2c6373'); srv, BASE = serve(Ld); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 20"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-exact-25']); m.name = 'Plat (mine)'; m.heightCm = 165; m.note = 'mine'; await f(['models', 'put', m]);
      await f(['looks', 'put', { id: 'gen-on-m17', image: m.front, thumb: m.thumb, modelId: 'starter-exact-25', styleIds: [], view: 'front', title: 'Render on Model 17', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      const m13 = await f(['models', 'get', 'starter-exact-21']); m13.name = 'Wavy (mine)'; m13.heightCm = 168; await f(['models', 'put', m13]);
      await f(['models', 'put', { id: 'user-model-l', name: 'Mine L', front: m.front, back: null, sheet: null, thumb: m.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP); BM = before['models']
    check('L_old_install_model17_2_outfits', [o.get('id') for o in BM['starter-exact-25'].get('outfits') or []] == ['base', 'red-dress'] and len(BM) == 21)
    deploy(Ld); pg.goto(BASE); pg.reload(); pg.wait_for_timeout(3500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, Lk = after['models'], after['looks']
    check('L_model17_gains_2_outfits_keeps_edits', m17_ok(M, BM['starter-exact-25']) and M['starter-exact-25']['name'] == 'Plat (mine)' and M['starter-exact-25']['heightCm'] == 165 and M['starter-exact-25']['note'] == 'mine')
    check('L_model13_gains_beige_linen_keeps_edits', m13_ok(M, BM['starter-exact-21']) and M['starter-exact-21']['name'] == 'Wavy (mine)' and M['starter-exact-21']['heightCm'] == 168)
    check('L_same_records_others_untouched', set(M) == set(BM) and kept(M, BM) and Lk == before['looks'])
    R['L_ui_names'] = names; check('L_ui_order', names == UI_STARTERS[:12] + ['Wavy (mine)'] + UI_STARTERS[13:16] + ['Plat (mine)', 'Generated 1', 'Generated 2', 'Generated 3', 'Mine L'])
    pg.goto(BASE + '#/model/starter-exact-25'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    chips = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]; R['L_chips'] = chips; bad = []
    for i, (oid, nm, f) in enumerate(M17_OUTFITS):
      pg.click(f'#mOutfits .oc[data-i="{i}"]'); pg.wait_for_timeout(400)
      sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
        return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
      if sel != [NEW[f'{f}-front'], NEW[f'{f}-back'], nm]: bad.append(oid)
    check('L_model17_detail_outfit_switch', chips == [o[1] for o in M17_OUTFITS] and not bad)
    pg.screenshot(path=str(ROOT / 'screenshots/starters-model-17-outfits.png'))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(3): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('L_idempotent', pg.evaluate(SNAP) == after)
    c.close()
    # ---------------- M) Model 13 / 17 outfits release (a20674e, live before this change) → Model 1 gains Red dress in place, edits kept ----------------
    Md = site('a20674e'); srv, BASE = serve(Md); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 20"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-exact-5']); m.name = 'Ava (mine)'; m.heightCm = 166; m.note = 'mine'; await f(['models', 'put', m]);
      await f(['looks', 'put', { id: 'gen-on-m1', image: m.front, thumb: m.thumb, modelId: 'starter-exact-5', styleIds: [], view: 'front', title: 'Render on Model 1', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      await f(['models', 'put', { id: 'user-model-m', name: 'Mine M', front: m.front, back: null, sheet: null, thumb: m.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP); BM = before['models']
    check('M_old_install_model1_4_outfits', [o.get('id') for o in BM['starter-exact-5'].get('outfits') or []] == ['base', 'tank-shorts', 'yoga-set', 'linen-set'] and len(BM) == 21)
    deploy(Md); pg.goto(BASE); pg.reload(); pg.wait_for_timeout(3500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, Lk = after['models'], after['looks']
    check('M_model1_gains_red_dress_keeps_edits', m1_ok(M, BM['starter-exact-5']) and M['starter-exact-5']['name'] == 'Ava (mine)' and M['starter-exact-5']['heightCm'] == 166 and M['starter-exact-5']['note'] == 'mine')
    check('M_same_records_others_untouched', set(M) == set(BM) and kept(M, BM) and Lk == before['looks'])
    R['M_ui_names'] = names; check('M_ui_order', names == ['Ava (mine)'] + UI_STARTERS[1:] + ['Generated 1', 'Generated 2', 'Generated 3', 'Mine M'])
    pg.goto(BASE + '#/model/starter-exact-5'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    chips = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]; R['M_chips'] = chips
    pg.click('#mOutfits .oc[data-i="4"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('M_model1_detail_red_dress', chips == [o[1] for o in M1_OUTFITS] and sel == [NEW['exact-5-red-dress-front'], NEW['exact-5-red-dress-back'], 'Red dress'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-model-1-red-dress.png'))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(3): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('M_idempotent', pg.evaluate(SNAP) == after)
    c.close()
    # ---------------- N) Model 1 Red dress release (a1a2db9, live before this change) → Model 2 gains Generated 3's outfits in place, edits kept ----------------
    Nd = site('a1a2db9'); srv, BASE = serve(Nd); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 20"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-exact-6']); m.name = 'Pink (mine)'; m.heightCm = 171; m.note = 'mine'; await f(['models', 'put', m]);
      await f(['looks', 'put', { id: 'gen-on-m2n', image: m.front, thumb: m.thumb, modelId: 'starter-exact-6', styleIds: [], view: 'front', title: 'Render on Model 2', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      await f(['models', 'put', { id: 'user-model-n', name: 'Mine N', front: m.front, back: null, sheet: null, thumb: m.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP); BM = before['models']
    check('N_old_install_model2_2_outfits', [o.get('id') for o in BM['starter-exact-6'].get('outfits') or []] == ['base', 'yoga-set'] and len(BM) == 21)
    deploy(Nd); pg.goto(BASE); pg.reload(); pg.wait_for_timeout(3500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, Lk = after['models'], after['looks']
    check('N_model2_gains_g3_outfits_keeps_edits', m2_ok(M, BM['starter-exact-6']) and M['starter-exact-6']['name'] == 'Pink (mine)' and M['starter-exact-6']['heightCm'] == 171 and M['starter-exact-6']['note'] == 'mine')
    check('N_same_records_others_untouched', set(M) == set(BM) and kept(M, BM) and Lk == before['looks'] and M['starter-generated-3'] == BM['starter-generated-3'])
    R['N_ui_names'] = names; check('N_ui_order', names == UI_STARTERS[:1] + ['Pink (mine)'] + UI_STARTERS[2:] + ['Generated 1', 'Generated 2', 'Generated 3', 'Mine N'])
    pg.goto(BASE + '#/model/starter-exact-6'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    chips = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]; R['N_chips'] = chips
    pg.click('#mOutfits .oc[data-i="4"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('N_model2_detail_tank_shorts', chips == [o[1] for o in M2_OUTFITS] and sel == [NEW['generated-3-tank-shorts-front'], NEW['generated-3-tank-shorts-back'], 'Tank & shorts'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-model-2-g3-outfits.png'))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(3): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('N_idempotent', pg.evaluate(SNAP) == after)
    c.close()
    # ---------------- O) Model 2 + Generated 3 outfits release (bbd088a) → Model 2 gains USA jersey in place, edits kept ----------------
    Od = site('bbd088a'); srv, BASE = serve(Od); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 20"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-exact-6']); m.name = 'Pink (mine)'; m.heightCm = 171; m.note = 'mine'; await f(['models', 'put', m]);
      await f(['looks', 'put', { id: 'gen-on-m2o', image: m.front, thumb: m.thumb, modelId: 'starter-exact-6', styleIds: [], view: 'front', title: 'Render on Model 2', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      await f(['models', 'put', { id: 'user-model-o', name: 'Mine O', front: m.front, back: null, sheet: null, thumb: m.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP); BM = before['models']
    check('O_old_install_model2_5_outfits', [o.get('id') for o in BM['starter-exact-6'].get('outfits') or []] == ['base', 'yoga-set', 'turtleneck', 'slip-dress', 'tank-shorts'] and len(BM) == 21)
    deploy(Od); pg.goto(BASE); pg.reload(); pg.wait_for_timeout(3500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, Lk = after['models'], after['looks']
    check('O_model2_gains_usa_jersey_keeps_edits', m2_ok(M, BM['starter-exact-6']) and M['starter-exact-6']['name'] == 'Pink (mine)' and M['starter-exact-6']['heightCm'] == 171 and M['starter-exact-6']['note'] == 'mine')
    check('O_same_records_others_untouched', set(M) == set(BM) and kept(M, BM) and Lk == before['looks'] and M['starter-generated-3'] == BM['starter-generated-3'])
    R['O_ui_names'] = names; check('O_ui_order', names == UI_STARTERS[:1] + ['Pink (mine)'] + UI_STARTERS[2:] + ['Generated 1', 'Generated 2', 'Generated 3', 'Mine O'])
    pg.goto(BASE + '#/model/starter-exact-6'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    chips = [x.strip() for x in pg.locator('#mOutfits .oc').all_inner_texts()]; R['O_chips'] = chips
    pg.click('#mOutfits .oc[data-i="5"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('O_model2_detail_usa_jersey', chips == [o[1] for o in M2_OUTFITS] and sel == [NEW['exact-6-usa-jersey-front'], NEW['exact-6-usa-jersey-back'], 'USA jersey'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-model-2-usa-jersey.png'))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(3): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('O_idempotent', pg.evaluate(SNAP) == after)
    c.close()
    b.close()
finally:
  for s in servers: s.terminate()
R['errors'] = errors; check('no_page_errors', not errors); R['PASS'] = ok
print(json.dumps(R, indent=1)); sys.exit(0 if ok else 1)
