"""Starter sync e2e (Playwright, real service workers). Usage: python3 tools/e2e_starters.py

A) Legacy upgrade: install the release before Model 1's assets changed (only Models 1+2, old SW with its cache-first image
   cache), make user edits, deploy the current tree, relaunch. Model 1 → starter-exact-1 with refreshed images and the
   user's rename/notes kept; Model 2 → starter-photoreal-1 ("Photoreal 1") with its sample looks following her; the exact
   Models 2-5 are added once with current images; user model / generated look / edited and deleted sample looks are kept.
   Relaunch is idempotent; deleting a starter sticks.
B) Renumber upgrade: install the previous release (Models 1-6, old ids), make edits (rename Model 6, note on Model 3, delete
   Model 4, looks on Model 5 and Model 6), deploy the current tree, relaunch. Old Model 5 is deleted (her generated look kept,
   detached), Model 6 → Model 4 (starter-exact-4) with the user's name kept, Model 3 → Model 2, deleted Model 4 stays
   deleted, the new Model 5 (starter-exact-5) is added once, no starter-model-* ids remain, nothing duplicated.
C) Fresh install gets Model 1-15 then Photoreal 1, all recorded as known.
D) Model 1-5 release (8d138e9, new ids): user model, rename Model 5, delete Model 3, deploy the current tree. Models 6-15 are
   added once (current images), deleted Model 3 stays deleted, the Models tab lists starters in canonical order
   (Model 1..15, Photoreal 1, Generated 1) with the user model after them (no record rewritten for that), relaunch is idempotent.
E) Model 1-15 release (7781450): user model + rename Model 15, deploy the current tree. Generated 1 arrives once as ONE model
   with all 4 outfits (Base, Summer denim, Sundress, Linen set; current images), listed after Photoreal 1; her model page shows
   the outfit chips and switching shows that outfit's front/back; deleting her sticks. (Every scenario also checks Generated 1.)"""
import hashlib, json, pathlib, re, shutil, socket, subprocess, sys, tempfile, time, io, tarfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
def site(ref):
  d = pathlib.Path(tempfile.mkdtemp(prefix='avata-starters-')) / 'site'; d.mkdir()
  tarfile.open(fileobj=io.BytesIO(subprocess.run(['git', 'archive', ref], cwd=ROOT, capture_output=True, check=True).stdout)).extractall(d, **({'filter': 'data'} if hasattr(tarfile, 'data_filter') else {}))
  return d
def sha(b): return hashlib.sha256(b).hexdigest()
K = ('sheet', 'front', 'back', 'thumb')
GEN_OUTFITS = [('base', 'Base', 'generated-1'), ('summer-denim', 'Summer denim', 'generated-1-summer-denim'), ('sundress', 'Sundress', 'generated-1-sundress'), ('linen-set', 'Linen set', 'generated-1-linen-set')]
FILES = [f'exact-{n}' for n in range(1, 16)] + ['photoreal-1'] + [o[2] for o in GEN_OUTFITS]
NEW = {f'{m}-{k}': sha((ROOT / f'assets/models/{m}-{k}.webp').read_bytes()) for m in FILES for k in K}
REVS = dict(re.findall(r"id: '(starter-[a-z]+-\d+)'.*?assetRev: '([0-9a-f]+)'", (ROOT / 'js/starters.js').read_text()))
ALL_NEW = [f'starter-exact-{n}' for n in range(1, 16)] + ['starter-photoreal-1', 'starter-generated-1']
M6_10 = [f'starter-exact-{n}' for n in range(6, 16)]   # Models 6-15
assert sorted(REVS) == sorted(ALL_NEW), REVS

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
def ui_names(pg, base):
  pg.goto(base + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(500); return pg.locator('.lib-card .nm').all_inner_texts()

servers = []
try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------------- A) legacy (Models 1+2 only) ----------------
    A = site('e9c1066^'); srv, BASE = serve(A); servers.append(srv); time.sleep(0.5)
    OLDH = {k: sha((A / f'assets/models/{k}.webp').read_bytes()) for k in ('model-1-front',)}
    assert OLDH['model-1-front'] != NEW['exact-1-front']
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
    mb = before['models']['starter-model-1']; ma = M.get('starter-exact-1', {})
    check('A_model1_renumbered_images_refreshed', imgs_current(ma, 'exact-1'))
    check('A_model1_user_fields_kept', ma.get('name') == 'Ava (renamed)' and ma.get('note') == 'my own note' and ma.get('heightCm') == 171 and ma.get('createdAt') == mb['createdAt'])
    pr = M.get('starter-photoreal-1', {})
    check('A_model2_is_photoreal1', pr.get('name') == 'Photoreal 1' and imgs_current(pr, 'photoreal-1') and pr.get('starter') is True)
    check('A_no_old_ids_left', not any(k.startswith('starter-model-') for k in M))
    check('A_user_model_untouched', M.get('user-model-x') == before['models']['user-model-x'])
    check('A_generated_look_follows_model1', {**L['gen-look-1'], 'modelId': 0} == {**before['looks']['gen-look-1'], 'modelId': 0} and L['gen-look-1']['modelId'] == 'starter-exact-1')
    sa = L['sample-look-model-1-front']
    check('A_sample_look_m1_refreshed_meta_kept', sa['image'] == 'sha:' + NEW['exact-1-front'] and sa['title'] == 'Edited sample' and sa['favorite'] is True and sa['modelId'] == 'starter-exact-1')
    check('A_sample_looks_m2_follow_photoreal', all(L[i]['modelId'] == 'starter-photoreal-1' for i in ('sample-look-model-2-front', 'sample-look-model-2-sheet')))
    check('A_deleted_sample_look_stays_deleted', 'sample-look-model-2-back' not in L and set(L) == set(before['looks']))
    added = [f'starter-exact-{n}' for n in range(2, 16)]
    check('A_exact_2_15_added_once', all(imgs_current(M.get(s, {}), s.replace('starter-', '')) and M[s].get('assetRev') == REVS[s] for s in added)
          and set(M) == {'starter-exact-1', 'starter-photoreal-1', 'user-model-x', 'starter-generated-1', *added})
    check('A_generated1_with_4_outfits', gen_ok(M))
    R['A_known'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('A_known', sorted(R['A_known']) == sorted(ALL_NEW))
    R['A_ui_names'] = names; check('A_ui_names', names == ['Ava (renamed)'] + [f'Model {n}' for n in range(2, 16)] + ['Photoreal 1', 'Generated 1', 'My Model'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-upgrade.png'))
    pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500); check('A_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-exact-3']); pg.evaluate(IDB, ['models', 'del', 'starter-photoreal-1']); gone = pg.evaluate(SNAP)
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
    before = pg.evaluate(SNAP); R['B_known_before'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters'])
    check('B_old_install_has_old_ids', {'starter-model-1', 'starter-model-2', 'starter-model-3', 'starter-model-5', 'starter-model-6'} <= set(before['models']))
    deploy(B); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(2500)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M, L = after['models'], after['looks']
    check('B_old_model5_deleted', 'starter-model-5' not in M and not any(m.get('note', '').startswith('Long wavy black hair, deep tan') and m.get('id') != 'starter-exact-5' for m in M.values()))
    check('B_look_on_old5_kept_detached', {**L['gen-on-5'], 'modelId': 0} == {**before['looks']['gen-on-5'], 'modelId': 0} and L['gen-on-5']['modelId'] is None)
    e4, b6 = M.get('starter-exact-4', {}), before['models']['starter-model-6']
    check('B_model6_is_exact4_user_edits_kept', e4.get('name') == 'Platinum (mine)' and e4.get('heightCm') == 175 and all(e4.get(k) == v for k, v in b6.items() if k not in ('id', 'createdAt')))
    check('B_look_on_6_follows', L['gen-on-6']['modelId'] == 'starter-exact-4' and {**L['gen-on-6'], 'modelId': 0} == {**before['looks']['gen-on-6'], 'modelId': 0})
    e2 = M.get('starter-exact-2', {}); check('B_model3_is_model2', e2.get('name') == 'Model 2' and e2.get('note') == 'note on 3')
    check('B_deleted_model4_stays_deleted', 'starter-exact-3' not in M)
    check('B_model2_is_photoreal1', M.get('starter-photoreal-1', {}).get('name') == 'Photoreal 1' and all(L[i]['modelId'] == 'starter-photoreal-1' for i in L if i.startswith('sample-look-model-2-')))
    e5 = M.get('starter-exact-5', {}); check('B_new_model5_added_once', e5.get('name') == 'Model 5' and imgs_current(e5, 'exact-5') and e5.get('assetRev') == REVS['starter-exact-5'])
    check('B_user_models_untouched', M.get('user-model-y') == before['models']['user-model-y'])
    check('B_models_6_15_added_once', all(M.get(s, {}).get('name') == f'Model {s.split("-")[-1]}' and imgs_current(M[s], s.replace('starter-', '')) and M[s].get('assetRev') == REVS[s] for s in M6_10))
    check('B_exact_set', set(M) == {'starter-exact-1', 'starter-exact-2', 'starter-exact-4', 'starter-exact-5', *M6_10, 'starter-photoreal-1', 'starter-generated-1', 'user-model-y'})
    check('B_generated1_with_4_outfits', gen_ok(M))
    check('B_looks_kept', set(L) == set(before['looks']))
    R['B_known'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('B_known', sorted(R['B_known']) == sorted(ALL_NEW))
    R['B_ui_names'] = names
    # canonical order: starters Model 1, 2, (3 deleted), 4 = 'Platinum (mine)', 5..15, Photoreal 1; then the user's own 'Model 5'
    check('B_ui', names == ['Model 1', 'Model 2', 'Platinum (mine)'] + [f'Model {n}' for n in range(5, 16)] + ['Photoreal 1', 'Generated 1', 'Model 5'])
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
    check('C_fresh_known', sorted(pg.evaluate(IDB, ['kv', 'get', 'knownStarters'])) == sorted(ALL_NEW))
    R['C_ui_names'] = pg.locator('.lib-card .nm').all_inner_texts()
    check('C_ui_names', R['C_ui_names'] == [f'Model {n}' for n in range(1, 16)] + ['Photoreal 1', 'Generated 1'])
    pg.screenshot(path=str(ROOT / 'screenshots/starters-fresh.png'), full_page=True)
    c.close()

    # ---------------- D) Model 1-5 release (new ids) → Models 6-15 added once, canonical order ----------------
    D = site('8d138e9'); srv, BASE = serve(D); servers.append(srv); time.sleep(0.5)
    c, pg = ctx(b)
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(1500)
    pg.goto(BASE + '#/models'); pg.wait_for_function("document.querySelectorAll('.lib-card').length >= 6"); pg.wait_for_timeout(500)
    pg.evaluate("""async idb => { const f = eval(idb);
      const m5 = await f(['models', 'get', 'starter-exact-5']); m5.name = 'Wavy (mine)'; m5.heightCm = 168; await f(['models', 'put', m5]);
      await f(['models', 'del', 'starter-exact-3']);
      await f(['models', 'put', { id: 'user-model-z', name: 'My Own', front: m5.front, back: null, sheet: null, thumb: m5.thumb, heightCm: 160, createdAt: Date.now(), starter: false }]);
      await f(['models', 'put', { id: 'user-model-w', name: 'My Second', front: m5.front, back: null, sheet: null, thumb: m5.thumb, heightCm: 160, createdAt: Date.now() + 5, starter: false }]); }""", IDB)
    before = pg.evaluate(SNAP); R['D_known_before'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters'])
    check('D_old_install_is_model1_5', set(before['models']) == {'starter-exact-1', 'starter-exact-2', 'starter-exact-4', 'starter-exact-5', 'starter-photoreal-1', 'user-model-z', 'user-model-w'})
    deploy(D); pg.goto(BASE); pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(3000)
    names = ui_names(pg, BASE); after = pg.evaluate(SNAP); M = after['models']
    check('D_models_6_15_added_once', all(M.get(s, {}).get('name') == f'Model {s.split("-")[-1]}' and imgs_current(M[s], s.replace('starter-', '')) and M[s].get('assetRev') == REVS[s] for s in M6_10))
    check('D_exact_set', set(M) == set(before['models']) | set(M6_10) | {'starter-generated-1'})
    check('D_generated1_with_4_outfits', gen_ok(M))
    check('D_existing_records_untouched', all(M[k] == v for k, v in before['models'].items()))
    check('D_deleted_model3_stays_deleted', 'starter-exact-3' not in M)
    R['D_ui_names'] = names
    check('D_ui_order', names == ['Model 1', 'Model 2', 'Model 4', 'Wavy (mine)'] + [f'Model {n}' for n in range(6, 16)] + ['Photoreal 1', 'Generated 1', 'My Own', 'My Second'])
    R['D_known'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('D_known', sorted(R['D_known']) == sorted(ALL_NEW))
    pg.screenshot(path=str(ROOT / 'screenshots/starters-after-m6-15.png'), full_page=True)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('D_idempotent', pg.evaluate(SNAP) == after and ui_names(pg, BASE) == names)
    c.close()

    # ---------------- E) Model 1-15 release → Generated 1 (one model, 4 outfits) added once ----------------
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
    check('E_generated1_added_once_with_4_outfits', gen_ok(M) and set(M) == set(before['models']) | {'starter-generated-1'})
    check('E_existing_records_untouched', all(M[k] == v for k, v in before['models'].items()))
    R['E_ui_names'] = names
    check('E_ui_order', names == [f'Model {n}' for n in range(1, 15)] + ['Gold (mine)', 'Photoreal 1', 'Generated 1', 'Mine E'])
    pg.goto(BASE + '#/model/starter-generated-1'); pg.wait_for_selector('#mOutfits'); pg.wait_for_timeout(600)
    R['E_detail_chips'] = pg.locator('#mOutfits .oc').all_inner_texts()
    f0 = pg.evaluate("document.getElementById('mFront').src"); pg.click('#mOutfits .oc[data-i="2"]'); pg.wait_for_timeout(400)
    sel = pg.evaluate("""async () => { const sha = async u => { const b = await (await fetch(u)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); };
      return [await sha(document.getElementById('mFront').src), await sha(document.getElementById('mBack').src), document.querySelector('#mOutfits .oc[aria-checked=true]').textContent.trim()]; }""")
    check('E_detail_outfit_switch', [c.strip() for c in R['E_detail_chips']] == ['Base', 'Summer denim', 'Sundress', 'Linen set'] and sel == [NEW['generated-1-sundress-front'], NEW['generated-1-sundress-back'], 'Sundress'])
    pg.click('#mOutfits .oc[data-i="2"]'); pg.wait_for_timeout(300); pg.screenshot(path=str(ROOT / 'screenshots/starters-generated-1-detail.png'))
    R['E_known'] = pg.evaluate(IDB, ['kv', 'get', 'knownStarters']); check('E_known', sorted(R['E_known']) == sorted(ALL_NEW))
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(800)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('E_idempotent', pg.evaluate(SNAP) == after)
    pg.evaluate(IDB, ['models', 'del', 'starter-generated-1']); gone = pg.evaluate(SNAP)
    for _ in range(2): pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('E_deleted_generated_stays_deleted', pg.evaluate(SNAP) == gone and 'starter-generated-1' not in gone['models'])
    c.close()
    b.close()
finally:
  for s in servers: s.terminate()
R['errors'] = errors; check('no_page_errors', not errors); R['PASS'] = ok
print(json.dumps(R, indent=1)); sys.exit(0 if ok else 1)
