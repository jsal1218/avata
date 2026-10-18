"""360 spin e2e (iPhone-sized, 390x844, touch): build from photos (shuffled upload, numbered names), auto-align check,
drag changes frame, crossfade with a sparse set, zoom to 5x with hi-res frame, reorder/rename, persistence after reload,
video turnaround, delete with confirm. Exact pixels only; no network beyond the site itself.
Usage: python3 tools/e2e_spin.py [base_url]   (base must also serve ../model-gallery/ for the gallery models)"""
import json, sys, pathlib, random, subprocess, tempfile
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8766/avata/'
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT / 'screenshots'; OUT.mkdir(exist_ok=True)
SRC = pathlib.Path('/workspace/shared/model-gallery/assets/exact-1/base/hi')
TMP = pathlib.Path(tempfile.mkdtemp(prefix='spin-'))
random.seed(7)
ANG = ['000', '045', '090', '135', '180', '225', '270', '315']

# Simulate hand-held photos: the same exact frames, re-shot at different distances / positions on a bigger canvas.
photos = []
for i, a in enumerate(ANG):
  im = Image.open(SRC / f'{a}.webp').convert('RGB')
  s = random.uniform(0.55, 1.0); W, H = 1800, 2400
  im2 = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
  cv = Image.new('RGB', (W, H), (255, 255, 255))
  cv.paste(im2, (random.randint(0, W - im2.width), random.randint(0, H - im2.height)))
  p = TMP / f'IMG_{i + 1:04d}.jpg'; cv.save(p, quality=92); photos.append(str(p))
upload = photos[:]; random.shuffle(upload)                      # picked out of order; names are numbered
sparse = []
for a, n in (('000', 'front'), ('090', 'side'), ('180', 'back')):
  p = TMP / f'{n}.jpg'; Image.open(SRC / f'{a}.webp').convert('RGB').save(p, quality=92); sparse.append(str(p))
video = TMP / 'turnaround.webm'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '2', '-pattern_type', 'glob', '-i', str(SRC / '*.webp'),
                '-vf', 'scale=600:1024,fps=24', '-c:v', 'libvpx', '-b:v', '2M', '-pix_fmt', 'yuv420p', str(video)], check=True)

R, errors, foreign = {}, [], set(); origin = urlparse(BASE).netloc
def shot(pg, name): pg.wait_for_timeout(300); pg.screenshot(path=str(OUT / f'spin-{name}.png'))
def st(pg, expr): return pg.evaluate(f"(() => {{ const S = document.querySelector('#spView').__spin; return {expr}; }})()")
def auto_off(pg): pg.evaluate("document.querySelector('.sv-auto').click(); scrollTo(0, 0)")  # JS click: no auto-scroll
def wait_built(pg, n): pg.wait_for_function(f"document.querySelector('#spView')?.__spin?.frames.length === {n} && document.querySelector('.sv-busy').hidden", timeout=60000)

ALIGN_JS = """async () => {
  const { detectSubject } = await import('./js/spin-core.js');
  const S = document.querySelector('#spView').__spin, out = [];
  for (const f of S.frames) {
    const im = new Image(); im.src = f.lo; await im.decode();
    const w = 180, h = 300, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    const d = detectSubject(x.getImageData(0, 0, w, h).data, w, h);
    out.push({ nat: [im.naturalWidth, im.naturalHeight], height: (d.box.b - d.box.t) / h, feet: d.box.b / h, cx: d.box.cx / w });
  }
  return out; }"""
SIG_JS = """async (urls) => {
  const sig = async (u) => { const im = new Image(); im.src = u; await im.decode();
    const c = document.createElement('canvas'); c.width = 24; c.height = 40; const x = c.getContext('2d');
    // crop the subject area (central band) so canvas padding doesn't dominate
    x.drawImage(im, 0, 0, 24, 40); const d = x.getImageData(0, 0, 24, 40).data; const g = [];
    for (let i = 0; i < d.length; i += 4) g.push((d[i] + d[i + 1] + d[i + 2]) / 3); return g; };
  const S = document.querySelector('#spView').__spin;
  const mine = []; for (const f of S.frames) mine.push(await sig(f.lo));
  const ref = []; for (const u of urls) ref.push(await sig(u));
  return mine.map(m => { let b = -1, bd = 1e18; ref.forEach((r, j) => { let s = 0; for (let k = 0; k < r.length; k++) s += (r[k] - m[k]) ** 2; if (s < bd) { bd = s; b = j; } }); return b; }); }"""

with sync_playwright() as p:
  b = p.chromium.launch()
  c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                    user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
  pg = c.new_page()
  pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
  pg.on('pageerror', lambda e: errors.append(str(e)))
  pg.on('request', lambda r: (urlparse(r.url).netloc not in (origin, '') and not r.url.startswith(('data:', 'blob:'))) and foreign.add(urlparse(r.url).netloc))
  pg.goto(BASE + '#/spin'); pg.wait_for_selector('#spNew')
  pg.wait_for_function("document.querySelectorAll('.sp-item').length >= 1", timeout=15000); pg.wait_for_timeout(1200)
  R['tab_present'] = pg.locator('#tabs a[data-tab=spin]').count() == 1
  R['gallery_models'] = pg.locator('.sp-item').count()
  R['version'] = pg.evaluate("import('./js/app.js').then(m => m.VERSION)")
  shot(pg, '01-gallery-model')

  # ---- every gallery model (manifest) is listed, loads its 8 frames and spins on drag; switcher scrolls on a phone ----
  gids = pg.evaluate("[...document.querySelectorAll('.sp-item')].map(b => b.dataset.id).filter(id => id.startsWith('gallery:'))")
  R['gallery_ids'] = gids; R['gallery_all'] = gids == [f'gallery:exact-{n}' for n in range(1, 16)] + ['gallery:photoreal-1']
  # main row = Model 1-15 (exact reference), separate Photorealistic row = Photoreal 1 (old Model 2)
  R['rows'] = pg.evaluate("""[...['#spSwitch', '#spPhotoRow']].map(q => [...document.querySelectorAll(q + ' .sp-item')].filter(b => b.dataset.id.startsWith('gallery:')).map(b => [b.querySelector('b').textContent.trim(), b.querySelector('small').textContent]))""")
  R['photo_heading'] = pg.evaluate("[document.querySelector('.sp-photo-h')?.textContent, !document.querySelector('#spPhoto').hidden]")
  R['lineup_ok'] = ([r[0] for r in R['rows'][0]] == [f'Model {n}' for n in range(1, 16)] and [r[1] for r in R['rows'][0]] == ['Strawberry blonde', 'Long black hair', 'Dark-brown hair', 'Platinum blonde', 'Wavy black hair',
                    'Pink hair', 'Wavy auburn hair', 'Long dark-brown hair', 'Silver-platinum hair', 'Curly black hair',
                    'Auburn low bun', 'Black high bun', 'Wavy black braids', 'Curly high puff', 'Braided updo']
                    and R['rows'][1] == [['Photoreal 1', 'Dark curls']] and R['photo_heading'] == ['Photorealistic', True])
  spun, bad = {}, []
  for gid in gids:
    pg.click(f'.sp-item[data-id="{gid}"]')
    pg.wait_for_function(f"(() => {{ const S = document.querySelector('#spView').__spin; return S && S.frames.length === 8 && S.frames[0].lo.includes('/{gid[8:]}/') && document.querySelector('.sv-busy').hidden; }})()", timeout=30000)
    pg.wait_for_timeout(400); auto_off(pg) if st(pg, 'S.auto') else None; pg.wait_for_timeout(700)
    vb = pg.locator('.sv').bounding_box(); y = vb['y'] + vb['height'] * 0.5
    a0 = st(pg, 'S.angle'); f0 = int(pg.get_attribute('.sv', 'data-frame'))
    pg.mouse.move(vb['x'] + 320, y); pg.mouse.down()
    for i in range(12): pg.mouse.move(vb['x'] + 320 - i * 12, y); pg.wait_for_timeout(16)
    pg.mouse.up(); pg.wait_for_timeout(1200)
    f1 = int(pg.get_attribute('.sv', 'data-frame')); a1 = st(pg, 'S.angle')
    sel = pg.evaluate("document.querySelector('.sp-item[aria-selected=true]')?.dataset.id")
    inview = pg.evaluate(f"""(() => {{ const b = document.querySelector('.sp-item[data-id="{gid}"]').getBoundingClientRect(), x = document.querySelector('#spSwitch').getBoundingClientRect(); return b.left >= x.left - 1 && b.right <= x.right + 1; }})()""")
    img_ok = pg.evaluate("(() => { const a = document.querySelector('.sv-a'); return a.complete && a.naturalWidth === 600 && a.naturalHeight === 1024; })()")
    spun[gid] = {'frames': st(pg, 'S.frames.length'), 'frame': [f0, f1], 'angle': [round(a0), round(a1)], 'selected': sel == gid, 'in_view': inview, 'img': img_ok}
    if not (f0 != f1 and sel == gid and inview and img_ok): bad.append(gid)
  R['gallery_spins'] = spun; R['gallery_all_spin'] = not bad and len(gids) == 16
  R['switcher'] = pg.evaluate("(() => { const x = document.querySelector('#spSwitch'); return { scrolls: x.scrollWidth > x.clientWidth, rows: new Set([...x.children].map(b => Math.round(b.getBoundingClientRect().top))).size, h: Math.round(x.getBoundingClientRect().height), fade: x.className, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()")
  R['switcher_ok'] = R['switcher']['scrolls'] and R['switcher']['rows'] == 1 and R['switcher']['pageOverflow'] <= 0 and R['switcher']['h'] < 120
  # with 15 gallery models: fades at both scroll ends, and the last model (Model 15) was scrolled into view when picked
  R['switcher_ends'] = pg.evaluate("""async () => { const x = document.querySelector('#spSwitch'); x.scrollTo({left: 0}); await new Promise(r => setTimeout(r, 300)); const a = x.className;
    x.scrollTo({left: x.scrollWidth}); await new Promise(r => setTimeout(r, 300)); const b = x.className; return [a.includes('fade-r') && !a.includes('fade-l'), b.includes('fade-l') && !b.includes('fade-r')]; }""")
  R['switcher_ends_ok'] = R['switcher_ends'] == [True, True] and spun.get('gallery:exact-15', {}).get('in_view') is True
  # showcase screenshot: Model 6 selected, switcher scrolled to the new models (6-15)
  pg.evaluate("document.querySelector('.sp-item[data-id=\"gallery:exact-6\"]').click()"); pg.wait_for_timeout(1500); auto_off(pg) if st(pg, 'S.auto') else None
  pg.evaluate("document.querySelector('#spSwitch').scrollTo({left: document.querySelector('.sp-item[data-id=\"gallery:exact-5\"]').offsetLeft - 16})"); pg.wait_for_timeout(900)
  shot(pg, '00-new-models')
  # old deep links (#/spin/gallery:model-N) map to the renumbered models
  R['old_links'] = {}
  for old, want in (('model-6', 'exact-4'), ('model-2', 'photoreal-1'), ('model-3', 'exact-2'), ('model-1', 'exact-1')):
    pg.goto(BASE + f'#/spin/gallery:{old}'); pg.reload(); pg.wait_for_selector('.sp-item[aria-selected=true]'); pg.wait_for_timeout(1200)
    got = pg.evaluate("[document.querySelector('.sp-item[aria-selected=true]')?.dataset.id, location.hash, document.querySelector('#spView').__spin?.frames[0]?.lo || '']")
    R['old_links'][old] = got[0] if got[0] == f'gallery:{want}' and got[1] == f'#/spin/gallery%3A{want}' and f'/{want}/' in got[2] else got
  R['old_links_ok'] = R['old_links'] == {'model-6': 'gallery:exact-4', 'model-2': 'gallery:photoreal-1', 'model-3': 'gallery:exact-2', 'model-1': 'gallery:exact-1'}
  auto_off(pg) if st(pg, 'S.auto') else None
  pg.click('.sp-item[data-id="gallery:exact-1"]'); pg.wait_for_timeout(800); auto_off(pg) if st(pg, 'S.auto') else None; pg.wait_for_timeout(400)

  # ---- build from 8 photos picked out of order ----
  pg.set_input_files('#spFile', upload); pg.wait_for_timeout(250); shot(pg, '02-building')
  wait_built(pg, 8); pg.wait_for_timeout(600)
  R['user_spins_after_build'] = pg.locator('.sp-item').count() - R['gallery_models']
  R['auto_rotate_after_build'] = st(pg, 'S.auto')
  ref_urls = [f'../model-gallery/assets/exact-1/base/lo/{a}.webp' for a in ANG]
  R['order_matches_filenames'] = pg.evaluate(SIG_JS, ref_urls)
  al = pg.evaluate(ALIGN_JS)
  R['align'] = {k: [round(min(x[k] for x in al), 3), round(max(x[k] for x in al), 3)] for k in ('height', 'feet', 'cx')}
  R['align_ok'] = all(abs(x['height'] - 0.84) < 0.03 and abs(x['feet'] - 0.95) < 0.02 and abs(x['cx'] - 0.5) < 0.04 for x in al)
  auto_off(pg); pg.wait_for_timeout(500)     # stop auto-rotate, snap to a frame
  shot(pg, '03-built-spin')

  # ---- drag changes frame ----
  vb = pg.locator('.sv').bounding_box(); y = vb['y'] + vb['height'] * 0.5
  f0 = int(pg.get_attribute('.sv', 'data-frame'))
  pg.mouse.move(vb['x'] + 320, y); pg.mouse.down()
  for i in range(12): pg.mouse.move(vb['x'] + 320 - i * 12, y); pg.wait_for_timeout(16)
  pg.mouse.up(); pg.wait_for_timeout(1200)
  f1 = int(pg.get_attribute('.sv', 'data-frame')); R['drag_frame'] = [f0, f1]; R['drag_changes_frame'] = f0 != f1

  # ---- zoom to 5x with hi-res originals ----
  pg.mouse.move(vb['x'] + vb['width'] / 2, vb['y'] + vb['height'] * 0.3)
  for _ in range(10): pg.mouse.wheel(0, -400); pg.wait_for_timeout(80)
  pg.wait_for_function("(() => { const S = document.querySelector('#spView').__spin; const a = document.querySelector('.sv-a'); return a.getAttribute('src') === S.frames[S.shown].hi && a.complete && a.naturalWidth > 0; })()", timeout=15000)
  pg.wait_for_timeout(300)
  R['zoom'] = float(pg.get_attribute('.sv', 'data-zoom')); R['hd_badge'] = pg.locator('.sv-hd').is_visible()
  R['zoom_img_natural'] = pg.evaluate("[document.querySelector('.sv-a').naturalWidth, document.querySelector('.sv-a').naturalHeight]")
  shot(pg, '04-zoom-5x')
  pg.locator('.sv-zoom button').click(); pg.wait_for_timeout(400); R['zoom_reset'] = float(pg.get_attribute('.sv', 'data-zoom'))
  # double-tap zoom
  pg.mouse.click(vb['x'] + 200, vb['y'] + 200); pg.wait_for_timeout(80); pg.mouse.click(vb['x'] + 200, vb['y'] + 200); pg.wait_for_timeout(400)
  R['double_tap_zoom'] = float(pg.get_attribute('.sv', 'data-zoom')); pg.locator('.sv-zoom button').click(); pg.wait_for_timeout(400)

  # ---- edit: reorder + rename ----
  pg.click('#spEdit summary'); pg.wait_for_selector('.sp-fr')
  pg.evaluate("document.querySelector('#spEdit').scrollIntoView({block:'start'}); scrollBy(0,-70)"); pg.wait_for_timeout(300)
  shot(pg, '05-edit-frames')
  before = pg.evaluate("document.querySelector('#spView').__spin.frames.map(f => f.lo)")
  a = pg.locator('.sp-fr').nth(2).bounding_box(); t = pg.locator('.sp-fr').nth(0).bounding_box()
  pg.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); pg.mouse.down()
  for i in range(1, 11): pg.mouse.move(a['x'] + a['width'] / 2 + (t['x'] - a['x']) * i / 10, a['y'] + a['height'] / 2); pg.wait_for_timeout(20)
  pg.mouse.up(); pg.wait_for_timeout(1200)
  R['reorder_toast'] = 'Order saved.' in pg.inner_text('#toasts')
  pg.click('#spRen'); pg.wait_for_selector('#rnI'); pg.fill('#rnI', 'Model 1 · photo spin'); pg.click('#rnF button[type=submit]'); pg.wait_for_timeout(600)
  R['renamed'] = pg.locator('.sp-item[aria-selected=true] b').inner_text()
  order_sig = pg.evaluate(SIG_JS, ref_urls); R['order_after_reorder'] = order_sig

  # ---- persists after reload ----
  pg.reload(); pg.wait_for_selector('#spNew'); wait_built(pg, 8); pg.wait_for_timeout(800)
  R['after_reload'] = {'name': pg.locator('.sp-item[aria-selected=true] b').inner_text(), 'frames': st(pg, 'S.frames.length'), 'order': pg.evaluate(SIG_JS, ref_urls),
                       'hash': pg.evaluate('location.hash')[:12]}
  R['persist_ok'] = R['after_reload']['name'] == 'Model 1 · photo spin' and R['after_reload']['order'] == order_sig
  shot(pg, '06-after-reload')

  # ---- sparse set (front/side/back): crossfade while dragging ----
  pg.set_input_files('#spFile', sparse); wait_built(pg, 3); pg.wait_for_timeout(300)
  auto_off(pg); pg.wait_for_timeout(700)
  vb = pg.locator('.sv').bounding_box(); y = vb['y'] + vb['height'] * 0.5
  start_angle = st(pg, 'S.angle'); dpp = 360 / max(320, vb['width'] * 1.15); px = round(60 / dpp)  # drag ~60° (half-way to the next photo)
  pg.mouse.move(vb['x'] + 340, y); pg.mouse.down()
  for i in range(1, 21): pg.mouse.move(vb['x'] + 340 - px * i / 20, y); pg.wait_for_timeout(16)
  pg.wait_for_timeout(120)
  R['sparse_mid_drag'] = {'angle': round(st(pg, 'S.angle')), 'imgB_opacity': round(float(pg.evaluate("getComputedStyle(document.querySelector('.sv-b')).opacity")), 2)}
  R['crossfade_ok'] = 0.05 < R['sparse_mid_drag']['imgB_opacity'] < 0.95
  shot(pg, '07-sparse-crossfade')
  pg.mouse.up(); pg.wait_for_timeout(900)

  # ---- turnaround video ----
  pg.set_input_files('#spFile', str(video)); wait_built(pg, 16); pg.wait_for_timeout(500)
  R['video_frames'] = st(pg, 'S.frames.length')
  vs = pg.evaluate(SIG_JS, ref_urls); R['video_frame_sig'] = vs
  shot(pg, '08-video-spin')

  # ---- delete with confirm ----
  n = pg.locator('.sp-item').count()
  pg.click('#spEdit summary') if not pg.evaluate("document.querySelector('#spEdit').open") else None
  pg.once('dialog', lambda d: d.dismiss()); pg.click('#spDel'); pg.wait_for_timeout(400)
  R['delete_cancel_keeps'] = pg.locator('.sp-item').count() == n
  pg.once('dialog', lambda d: (R.__setitem__('confirm_text', d.message), d.accept())); pg.click('#spDel'); pg.wait_for_timeout(800)
  R['delete_removes'] = pg.locator('.sp-item').count() == n - 1
  pg.reload(); pg.wait_for_selector('#spNew'); pg.wait_for_function("document.querySelectorAll('.sp-item').length >= 3", timeout=15000); pg.wait_for_timeout(800)
  R['items_after_delete_reload'] = pg.locator('.sp-item').count()
  pg.click('.sp-item >> nth=0'); wait_built(pg, 3); auto_off(pg); pg.wait_for_timeout(600)
  R['sw'] = pg.evaluate("navigator.serviceWorker.getRegistration().then(r => !!r)")
  c.close()

  # dark mode look
  c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme='dark')
  pg = c.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
  pg.goto(BASE + '#/spin'); pg.wait_for_selector('#spNew'); pg.set_input_files('#spFile', photos); wait_built(pg, 8)
  pg.wait_for_timeout(500); auto_off(pg); pg.wait_for_timeout(700); shot(pg, '09-dark')
  c.close(); b.close()

R['errors'] = errors; R['foreign_hosts'] = sorted(foreign)
KEYS = ['tab_present', 'gallery_all', 'lineup_ok', 'gallery_all_spin', 'switcher_ok', 'switcher_ends_ok', 'old_links_ok', 'align_ok', 'drag_changes_frame', 'hd_badge',
        'reorder_toast', 'persist_ok', 'crossfade_ok', 'delete_cancel_keeps', 'delete_removes', 'sw']
R['FAILED'] = [k for k in KEYS if R.get(k) is not True] + (['errors'] if errors else []) + (['foreign_hosts'] if foreign else [])
R['PASS'] = not R['FAILED']
print(json.dumps(R, indent=1)); sys.exit(0 if R['PASS'] else 1)
