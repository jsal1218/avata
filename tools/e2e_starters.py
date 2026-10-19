"""Starter sync e2e (Playwright, real service workers). Usage: python3 tools/e2e_starters.py

On 2026-10-18 Jordan removed Models 1-4, 8, 11, 15 and 16. The rest were renumbered by name only (stable ids exact-5, 6, 7,
9, 10, 12, 13, 14 = Model 1-8; relabelStarters() renames default-named records once, user names kept) and exact-17 was added as
Model 9, then exact-18..22 as Model 10-14. Shipped: Model 1-14, Photoreal 1, Generated 1 (4 outfits), Generated 2 (2 outfits), Generated 3 (Model 2 in black, 4 outfits; also shown as Photoreal 2). Every upgrade scenario checks that the removed starters' records are dropped once
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
I) Models 10-14 release (2e814c1, the last one live): Generated 3 and Photoreal 2 added once with 4 outfits; renamed Model 2 and user model
   untouched; model page outfit chips; relaunch idempotent; a deleted Generated 3 is never re-added."""
import hashlib, json, pathlib, re, shutil, socket, subprocess, sys, tempfile, time, io, tarfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
def site(ref):
  d = pathlib.Path(tempfile.mkdtemp(prefix='avata-starters-')) / 'site'; d.mkdir()
  tarfile.open(fileobj=io.BytesIO(subprocess.run(['git', 'archive', ref], cwd=ROOT, capture_output=True, check=True).stdout)).extractall(d, **({'filter': 'data'} if hasattr(tarfile, 'data_filter') else {}))
  return d
def sha(b): return hashlib.sha256(b).hexdigest()
K = ('sheet', 'front', 'back', 'thumb')
KEEP = [5, 6, 7, 9, 10, 12, 13, 14, 17, 18, 19, 20, 21, 22]; REMOVED = [1, 2, 3, 4, 8, 11, 15, 16]   # stable ids; KEEP is labelled Model 1-14 in this order
LABEL = {f'starter-exact-{n}': f'Model {i + 1}' for i, n in enumerate(KEEP)}
OLD_DEFAULT = {f'starter-exact-{n}': f'Model {n}' for n in KEEP if n < 17}   # names before the relabel
def relabeled(rec):   # what relabelStarters() makes of a stored record
  return {**rec, 'name': LABEL[rec['id']]} if rec.get('starter') is True and OLD_DEFAULT.get(rec.get('id')) == rec.get('name') else rec
REMOVED_IDS = [f'starter-exact-{n}' for n in REMOVED]
NEW_EXACT = [f'starter-exact-{n}' for n in KEEP if n >= 17]   # added after the relabel: Model 9 (exact-17), Model 10-14 (exact-18..22)
GEN_OUTFITS = [('base', 'Base', 'generated-1'), ('summer-denim', 'Summer denim', 'generated-1-summer-denim'), ('sundress', 'Sundress', 'generated-1-sundress'), ('linen-set', 'Linen set', 'generated-1-linen-set')]
GEN2_OUTFITS = [('base', 'Base', 'generated-2'), ('yoga-set', 'Yoga set', 'generated-2-yoga-set')]
GEN3_OUTFITS = [('base', 'Base', 'generated-3'), ('turtleneck', 'Turtleneck', 'generated-3-turtleneck'), ('slip-dress', 'Slip dress', 'generated-3-slip-dress'), ('tank-shorts', 'Tank & shorts', 'generated-3-tank-shorts')]
FILES = [f'exact-{n}' for n in KEEP] + ['photoreal-1'] + [o[2] for o in GEN_OUTFITS] + [o[2] for o in GEN2_OUTFITS] + [o[2] for o in GEN3_OUTFITS]
NEW = {f'{m}-{k}': sha((ROOT / f'assets/models/{m}-{k}.webp').read_bytes()) for m in FILES for k in K}
REVS = dict(re.findall(r"id: '(starter-[a-z]+-\d+)'.*?assetRev: '([0-9a-f]+)'", (ROOT / 'js/starters.js').read_text()))
EXACT = [f'starter-exact-{n}' for n in KEEP]
ALL_NEW = EXACT + ['starter-photoreal-1', 'starter-photoreal-2', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3']
LATER = [f'starter-exact-{n}' for n in KEEP if n >= 6]   # every kept exact starter after exact-5 (incl. new exact-17..22)
KNOWN_AFTER = sorted(set(ALL_NEW) | set(REMOVED_IDS))   # removed ids stay known, so they are never re-added
UI_STARTERS = [f'Model {i + 1}' for i in range(len(KEEP))]
assert sorted(REVS) == sorted(ALL_NEW), REVS
for n in REMOVED: assert not (ROOT / f'assets/models/exact-{n}-front.webp').exists()

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
def p2_ok(M):  # Photoreal 2 = the same model/images as Generated 3, its own starter record in the Photorealistic section
  g = M.get('starter-photoreal-2', {}); o = g.get('outfits') or []
  return (g.get('name') == 'Photoreal 2' and g.get('starter') is True and g.get('assetRev') == REVS['starter-photoreal-2'] == REVS['starter-generated-3'] and imgs_current(g, 'generated-3')
          and [[x.get('id'), x.get('name')] for x in o] == [[a, n] for a, n, _ in GEN3_OUTFITS] and all(imgs_current(x, f) for x, (_, _, f) in zip(o, GEN3_OUTFITS)))
def ui_names(pg, base):
  pg.goto(base + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(500); return pg.locator('.lib-card .nm').all_inner_texts()

servers = []
try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    def no_removed(M): return not any(k in M for k in REMOVED_IDS)
    def added_ok(M, ids): return all(M.get(s, {}).get('name') == LABEL[s] and M[s].get('starter') is True and imgs_current(M[s], s.replace('starter-', '')) and M[s].get('assetRev') == REVS[s] for s in ids)
    M1_SAMPLES = {'sample-look-model-1-front', 'sample-look-model-1-back', 'sample-look-model-1-sheet'}

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
    deploy(A); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(2500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('A_model1_removed_even_renamed', 'starter-exact-1' not in M and not any(m.get('name') == 'Ava (renamed)' for m in M.values()))
    pr = M.get('starter-photoreal-1', {})
    check('A_model2_is_photoreal1', pr.get('name') == 'Photoreal 1' and imgs_current(pr, 'photoreal-1') and pr.get('starter') is True)
    check('A_no_old_ids_left', not any(k.startswith('starter-model-') for k in M))
    check('A_user_model_untouched', M.get('user-model-x') == before['models']['user-model-x'])
    check('A_generated_look_on_model1_kept_detached', {**L['gen-look-1'], 'modelId': 0} == {**before['looks']['gen-look-1'], 'modelId': 0} and L['gen-look-1']['modelId'] is None)
    check('A_model1_sample_looks_removed', not (M1_SAMPLES & set(L)))
    check('A_sample_looks_m2_follow_photoreal', all(L[i]['modelId'] == 'starter-photoreal-1' for i in ('sample-look-model-2-front', 'sample-look-model-2-sheet')))
    check('A_deleted_sample_look_stays_deleted', 'sample-look-model-2-back' not in L and set(L) == set(before['looks']) - M1_SAMPLES)
    check('A_remaining_exact_added_once', added_ok(M, EXACT) and set(M) == {'starter-photoreal-1', 'starter-photoreal-2', 'user-model-x', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', *EXACT} and no_removed(M))
    check('A_generated1_with_4_outfits', gen_ok(M))
    R['A_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('A_known', sorted(R['A_known_list']) == KNOWN_AFTER)
    R['A_ui_names'] = names; check('A_ui_names', names == UI_STARTERS + ['Photoreal 1', 'Photoreal 2', 'Generated 1', 'Generated 2', 'Generated 3', 'My Model'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-upgrade.png'))
    pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500); check('A_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-exact-6']); pg.evaluate(IDB, ['models', 'del', 'starter-photoreal-1']); gone = pg.evaluate(SNAP)
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
    deploy(B); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(2500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('B_old_model5_deleted', 'starter-model-5' not in M and not any(m.get('note', '').startswith('Long wavy black hair, deep tan') and m.get('id') != 'starter-exact-5' for m in M.values()))
    check('B_look_on_old5_kept_detached', {**L['gen-on-5'], 'modelId': 0} == {**before['looks']['gen-on-5'], 'modelId': 0} and L['gen-on-5']['modelId'] is None)
    check('B_renumbered_models_then_removed', no_removed(M) and not any(m.get('name') == 'Platinum (mine)' or m.get('note') == 'note on 3' for m in M.values()))
    check('B_look_on_6_kept_detached', {**L['gen-on-6'], 'modelId': 0} == {**before['looks']['gen-on-6'], 'modelId': 0} and L['gen-on-6']['modelId'] is None)
    check('B_model2_is_photoreal1', M.get('starter-photoreal-1', {}).get('name') == 'Photoreal 1' and all(L[i]['modelId'] == 'starter-photoreal-1' for i in L if i.startswith('sample-look-model-2-')))
    e5 = M.get('starter-exact-5', {}); check('B_new_model5_added_once', e5.get('name') == 'Model 1' and imgs_current(e5, 'exact-5') and e5.get('assetRev') == REVS['starter-exact-5'])
    check('B_user_models_untouched', M.get('user-model-y') == before['models']['user-model-y'])
    check('B_remaining_6_14_added_once', added_ok(M, LATER))
    check('B_exact_set', set(M) == {*EXACT, 'starter-photoreal-1', 'starter-photoreal-2', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', 'user-model-y'})
    check('B_generated1_with_4_outfits', gen_ok(M))
    check('B_looks_kept_except_model1_samples', set(L) == set(before['looks']) - M1_SAMPLES)
    R['B_known_list'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('B_known', sorted(R['B_known_list']) == KNOWN_AFTER)
    R['B_ui_names'] = names
    check('B_ui', names == UI_STARTERS + ['Photoreal 1', 'Photoreal 2', 'Generated 1', 'Generated 2', 'Generated 3', 'Model 5'])   # the user's own 'Model 5' after the starters
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
    check('C_fresh_photoreal2_with_4_outfits', p2_ok(fresh['models']))
    check('C_fresh_only_photoreal_sample_looks', not (M1_SAMPLES & set(fresh['looks'])) and all(l.get('modelId') == 'starter-photoreal-1' for l in fresh['looks'].values() if l.get('sample')))
    check('C_fresh_known', sorted(pg.evaluate(IDB, ['kv', 'get', 'knownStarters'])) == KNOWN_AFTER)
    R['C_ui_names'] = pg.locator('.lib-card .nm').all_inner_texts()
    check('C_ui_names', R['C_ui_names'] == UI_STARTERS + ['Photoreal 1', 'Photoreal 2', 'Generated 1', 'Generated 2', 'Generated 3'])
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
    deploy(D); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('D_remaining_6_14_added_once', added_ok(M, LATER))
    check('D_exact_set', set(M) == {'starter-exact-5', 'starter-photoreal-1', 'user-model-z', 'user-model-w', 'starter-photoreal-2', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', *LATER} and no_removed(M))
    check('D_generated1_with_4_outfits', gen_ok(M))
    check('D_kept_records_untouched', all(M[k] == v for k, v in before['models'].items() if k not in REMOVED_IDS))
    R['D_ui_names'] = names
    check('D_ui_order', names == ['Wavy (mine)'] + UI_STARTERS[1:] + ['Photoreal 1', 'Photoreal 2', 'Generated 1', 'Generated 2', 'Generated 3', 'My Own', 'My Second'])
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
    deploy(E); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('E_generated1_added_once_with_4_outfits', gen_ok(M) and set(M) == (set(before['models']) - set(REMOVED_IDS)) | {'starter-photoreal-2', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', *NEW_EXACT} and added_ok(M, NEW_EXACT))
    check('E_removed_dropped_even_renamed_model15', no_removed(M) and not any(m.get('name') == 'Gold (mine)' for m in M.values()))
    check('E_kept_records_relabeled_only', all(M[k] == relabeled(v) for k, v in before['models'].items() if k not in REMOVED_IDS))
    R['E_ui_names'] = names
    check('E_ui_order', names == UI_STARTERS + ['Photoreal 1', 'Photoreal 2', 'Generated 1', 'Generated 2', 'Generated 3', 'Mine E'])
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
    deploy(F); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('F_generated2_added_once', gen2_ok(M))
    check('F_removed_dropped_once_even_renamed', no_removed(M) and not any(m.get('name') == 'Bun (mine)' for m in M.values()))
    check('F_model_set', set(M) == {*EXACT, 'starter-photoreal-1', 'starter-photoreal-2', 'starter-generated-1', 'starter-generated-2', 'starter-generated-3', 'user-model-f'} and added_ok(M, NEW_EXACT))
    check('F_kept_records_relabeled_only', all(M[k] == relabeled(v) for k, v in before['models'].items() if k not in REMOVED_IDS))
    check('F_user_renamed_starter_kept', M['starter-exact-9']['name'] == 'Silver (mine)' and M['starter-exact-9']['heightCm'] == 172 and M['starter-exact-10']['name'] == 'Model 5' and M['starter-exact-5']['name'] == 'Model 1')
    check('F_user_model_and_renamed_generated_kept', M['user-model-f'] == before['models']['user-model-f'] and M['starter-generated-1']['name'] == 'Chestnut (mine)')
    check('F_look_on_removed_8_kept_detached', {**L['gen-on-8'], 'modelId': 0} == {**before['looks']['gen-on-8'], 'modelId': 0} and L['gen-on-8']['modelId'] is None)
    check('F_look_on_kept_9_untouched', L['gen-on-9'] == before['looks']['gen-on-9'])
    check('F_looks_kept_except_model1_samples', set(L) == set(before['looks']) - M1_SAMPLES)
    R['F_ui_names'] = names
    check('F_ui_order', names == UI_STARTERS[:3] + ['Silver (mine)'] + UI_STARTERS[4:] + ['Photoreal 1', 'Photoreal 2', 'Chestnut (mine)', 'Generated 2', 'Generated 3', 'Mine F'])
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
    deploy(G); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('G_generated2_and_models_10_14_added_once', gen2_ok(M) and set(M) == set(before['models']) | {'starter-photoreal-2', 'starter-generated-2', 'starter-generated-3', *NEW_EXACT[1:]} and added_ok(M, NEW_EXACT[1:]))
    check('G_existing_records_untouched', all(M[k] == v for k, v in before['models'].items()))
    check('G_deleted_model6_stays_deleted', 'starter-exact-12' not in M)
    R['G_ui_names'] = names
    check('G_ui_order', names == UI_STARTERS[:2] + ['Auburn (mine)'] + UI_STARTERS[3:5] + UI_STARTERS[6:] + ['Photoreal 1', 'Photoreal 2', 'Chestnut (mine)', 'Generated 2', 'Generated 3', 'Mine G'])
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
    deploy(H); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('H_models_10_14_added_once', set(M) == set(before['models']) | set(NEW_EXACT[1:]) | {'starter-photoreal-2', 'starter-generated-3'} and added_ok(M, NEW_EXACT[1:]))
    check('H_existing_records_untouched', all(M[k] == v for k, v in before['models'].items()))
    R['H_ui_names'] = names
    check('H_ui_order', names == UI_STARTERS[:8] + ['Bob (mine)'] + UI_STARTERS[9:] + ['Photoreal 1', 'Photoreal 2', 'Generated 1', 'Generated 2', 'Generated 3', 'Model 10'])   # the user's own 'Model 10' stays after the starters
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
    deploy(I); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('I_generated3_and_photoreal2_added_once_with_4_outfits', gen3_ok(M) and p2_ok(M) and set(M) == set(before['models']) | {'starter-photoreal-2', 'starter-generated-3'})
    check('I_existing_records_untouched_incl_model2', all(M[k] == v for k, v in before['models'].items()) and M['starter-exact-6']['name'] == 'Pink (mine)')
    R['I_ui_names'] = names
    check('I_ui_order', names == UI_STARTERS[:1] + ['Pink (mine)'] + UI_STARTERS[2:] + ['Photoreal 1', 'Photoreal 2', 'Generated 1', 'Generated 2', 'Generated 3', 'Mine I'])
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
    b.close()
finally:
  for s in servers: s.terminate()
R['errors'] = errors; check('no_page_errors', not errors); R['PASS'] = ok
print(json.dumps(R, indent=1)); sys.exit(0 if ok else 1)
