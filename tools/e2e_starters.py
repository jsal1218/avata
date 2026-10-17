"""Starter re-sync e2e: install the PREVIOUS release (old Model 1 images, old service worker with its cache-first image
cache), make user edits, then deploy the current tree and relaunch. Checks that Model 1's images are refreshed to the
shipped files while the user's rename/notes, user-created model, generated look, edited sample look metadata and a deleted
sample look are left exactly as the user had them; then relaunches again to confirm it's idempotent.
Usage: python3 tools/e2e_starters.py [old_git_ref]   (default: the commit before Model 1's assets changed)"""
import hashlib, json, pathlib, shutil, socket, subprocess, sys, tempfile, time, io, tarfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OLD = sys.argv[1] if len(sys.argv) > 1 else 'e9c1066^'
TMP = pathlib.Path(tempfile.mkdtemp(prefix='avata-starters-')) / 'site'; TMP.mkdir()
tarfile.open(fileobj=io.BytesIO(subprocess.run(['git', 'archive', OLD], cwd=ROOT, capture_output=True, check=True).stdout)).extractall(TMP, **({'filter': 'data'} if hasattr(tarfile, 'data_filter') else {}))
def sha(b): return hashlib.sha256(b).hexdigest()
NEW = {f'{m}-{k}': sha((ROOT / f'assets/models/{m}-{k}.webp').read_bytes()) for m in ('model-1', 'model-2') for k in ('sheet', 'front', 'back', 'thumb')}
OLDH = {k: sha((TMP / f'assets/models/{k}.webp').read_bytes()) for k in NEW}
assert OLDH['model-1-front'] != NEW['model-1-front'], 'old ref must have different Model 1 images'
s = socket.socket(); s.bind(('127.0.0.1', 0)); PORT = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=TMP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
BASE = f'http://127.0.0.1:{PORT}/'

IDB = """async ([store, op, val]) => { const db = await new Promise((r, j) => { const q = indexedDB.open('avata'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const res = await new Promise((r, j) => { const t = db.transaction(store, op === 'get' || op === 'all' ? 'readonly' : 'readwrite'); const s = t.objectStore(store);
    const q = op === 'all' ? s.getAll() : op === 'get' ? s.get(val) : op === 'del' ? s.delete(val) : s.put(val); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  db.close(); return res; }"""
SNAP = """async () => { const db = await new Promise((r, j) => { const q = indexedDB.open('avata'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
  const all = st => new Promise(r => { const q = db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => r(q.result); });
  const h = async b => b instanceof Blob ? 'sha:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))].map(x => x.toString(16).padStart(2, '0')).join('') : b;
  const out = {}; for (const st of ['models', 'looks']) { out[st] = {}; for (const rec of await all(st)) { const o = {}; for (const [k, v] of Object.entries(rec)) o[k] = await h(v); out[st][rec.id] = o; } }
  db.close(); return out; }"""
R, errors, ok = {}, [], True
def check(name, cond):
  global ok; R[name] = bool(cond); ok &= bool(cond)
try:
  time.sleep(0.5)
  with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = c.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    # 1) old release installs and seeds
    pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_function("navigator.serviceWorker.controller"); pg.wait_for_timeout(800)
    m1 = pg.evaluate(IDB, ['models', 'get', 'starter-model-1'])
    # 2) user edits
    pg.evaluate("""async idb => { const f = eval(idb);
      const m = await f(['models', 'get', 'starter-model-1']); m.name = 'Ava (renamed)'; m.note = 'my own note'; m.heightCm = 171; await f(['models', 'put', m]);
      const front = (await f(['models', 'get', 'starter-model-2'])).front;
      await f(['models', 'put', { id: 'user-model-x', name: 'My Model', front, back: null, sheet: null, thumb: front, heightCm: 165, createdAt: Date.now(), starter: false }]);
      const m1 = await f(['models', 'get', 'starter-model-1']);
      await f(['looks', 'put', { id: 'gen-look-1', image: m1.front, thumb: m1.thumb, modelId: 'starter-model-1', styleIds: [], view: 'front', title: 'My render', tags: [], favorite: true, source: 'generated', createdAt: Date.now() }]);
      const sl = await f(['looks', 'get', 'sample-look-model-1-front']); sl.title = 'Edited sample'; sl.favorite = true; await f(['looks', 'put', sl]);
      await f(['looks', 'del', 'sample-look-model-2-back']); }""", IDB)
    before = pg.evaluate(SNAP)
    check('old_install_has_old_model1', before['models']['starter-model-1']['front'] == 'sha:' + OLDH['model-1-front'] and 'assetRev' not in before['models']['starter-model-1'])
    # 3) deploy the current tree over the old one, relaunch
    for f in ['index.html', 'sw.js', 'styles.css', 'manifest.webmanifest']: shutil.copy(ROOT / f, TMP / f)
    shutil.copytree(ROOT / 'js', TMP / 'js', dirs_exist_ok=True); shutil.copytree(ROOT / 'assets', TMP / 'assets', dirs_exist_ok=True)
    pg.reload(); pg.wait_for_selector('.look img'); pg.wait_for_timeout(2500)
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(500)
    after = pg.evaluate(SNAP); ma, mb = after['models']['starter-model-1'], before['models']['starter-model-1']
    for k in ('sheet', 'front', 'back', 'thumb'): check(f'model1_{k}_refreshed', ma[k] == 'sha:' + NEW[f'model-1-{k}'])
    check('model1_user_fields_kept', all(ma[k] == mb[k] for k in mb if k not in ('sheet', 'front', 'back', 'thumb')) and ma['name'] == 'Ava (renamed)' and ma['note'] == 'my own note')
    check('model2_images_current', all(after['models']['starter-model-2'][k] == 'sha:' + NEW[f'model-2-{k}'] for k in ('sheet', 'front', 'back', 'thumb')))
    check('user_model_untouched', after['models']['user-model-x'] == before['models']['user-model-x'])
    check('generated_look_untouched', after['looks']['gen-look-1'] == before['looks']['gen-look-1'])
    sa, sb = after['looks']['sample-look-model-1-front'], before['looks']['sample-look-model-1-front']
    check('sample_look_image_refreshed_meta_kept', sa['image'] == 'sha:' + NEW['model-1-front'] and sa['title'] == 'Edited sample' and sa['favorite'] is True and all(sa[k] == sb[k] for k in sb if k not in ('image', 'thumb')))
    check('deleted_sample_look_stays_deleted', 'sample-look-model-2-back' not in after['looks'])
    check('no_records_added_or_lost', set(after['models']) == set(before['models']) and set(after['looks']) == set(before['looks']))
    R['ui_names'] = pg.locator('.lib-card .nm').all_inner_texts()
    R['ui_model1_card_front'] = pg.evaluate("""async () => { const img = document.querySelector('.lib-card img'); const b = await (await fetch(img.src)).arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); }""") == NEW['model-1-front']
    check('ui_shows_new_model1', R['ui_model1_card_front'] and 'Ava (renamed)' in R['ui_names'])
    # 4) relaunch: idempotent (nothing changes)
    pg.reload(); pg.wait_for_selector('.lib-card'); pg.wait_for_timeout(1500)
    check('idempotent_second_launch', pg.evaluate(SNAP) == after)
    b.close()
finally:
  srv.terminate()
R['errors'] = errors; check('no_page_errors', not errors); R['PASS'] = ok
print(json.dumps(R, indent=1)); sys.exit(0 if ok else 1)
