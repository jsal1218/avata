"""Auto-update e2e: serve a temp copy of the site, then "deploy" new versions (bump VERSION in sw.js + js/app.js) and check
that the new service worker takes control and the page reloads itself only when it's safe:
 1 idle + visible -> reloads at once      2 modal open -> toast, no reload; reloads after background -> foreground
 3 page hidden -> reloads at once         4 long task (360 build etc.) -> waits, even across background/foreground
 5 same-version controller -> no reload      6 unfixable mismatch -> a single reload, no loop
Usage: python3 tools/e2e_update.py"""
import json, pathlib, re, shutil, subprocess, sys, tempfile, time, socket
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
TMP = pathlib.Path(tempfile.mkdtemp(prefix='avata-upd-')) / 'site'
shutil.copytree(ROOT, TMP, ignore=shutil.ignore_patterns('.git', 'screenshots', 'node_modules', '__pycache__'))
s = socket.socket(); s.bind(('127.0.0.1', 0)); PORT = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=TMP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
BASE = f'http://127.0.0.1:{PORT}/'
cur = re.search(r"const VERSION = '([^']*)'", (TMP / 'sw.js').read_text()).group(1)
def deploy(v):
  global cur
  for f in ('sw.js', 'js/app.js'):
    p = TMP / f; p.write_text(p.read_text().replace(f"'{cur}'", f"'{v}'"))
  cur = v
R, errors = {}, []
VIS = """h => { window.__h = h; for (const k of ['hidden', 'visibilityState']) Object.defineProperty(document, k, { configurable: true, get: () => k === 'hidden' ? window.__h : (window.__h ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange')); }"""
try:
  time.sleep(0.5)
  with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = c.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.goto(BASE); pg.wait_for_function('navigator.serviceWorker.controller && window.__avataUpdate', timeout=20000)
    mark = lambda: pg.evaluate('window.__mark = Math.random()')
    marked = lambda m: pg.evaluate('window.__mark') == m
    ver = lambda: pg.evaluate('window.__avataUpdate?.VERSION')
    def wait_ver(v, tries=8):  # re-poll like the 60 s timer would (an update() during an in-flight check can be a no-op)
      for i in range(tries):
        try: pg.wait_for_function(f"window.__avataUpdate?.VERSION === '{v}' && navigator.serviceWorker.controller", timeout=2500); return
        except Exception:
          if i == tries - 1: raise
          try: pg.evaluate('window.__avataUpdate?.check()')
          except Exception: pass
    R['start_version'] = ver()

    # 1 idle + visible
    m = mark(); deploy('test-v2'); pg.evaluate('__avataUpdate.check()'); wait_ver('test-v2')
    R['1_idle_reloaded'] = not marked(m) and ver() == 'test-v2'

    # 2 modal open -> toast, then background/foreground applies it
    pg.wait_for_timeout(500); pg.evaluate("import('./js/ui.js').then(u => u.openSheet('<div class=modal><h2 class=h>Open sheet</h2><p>Update waits while this is open.</p></div>', 'half'))"); m = mark()
    deploy('test-v3'); pg.evaluate('__avataUpdate.check()')
    pg.wait_for_selector('#updToast', timeout=15000); pg.wait_for_timeout(1500)
    R['2_modal_toast_no_reload'] = marked(m) and ver() == 'test-v2' and pg.evaluate('__avataUpdate.pending()')
    pg.screenshot(path=str(ROOT / 'screenshots' / 'update-toast.png'))
    pg.evaluate("document.querySelector('#sheet').close()")
    pg.evaluate(VIS, True); pg.wait_for_timeout(300); R['2_still_waiting_while_hidden'] = marked(m)
    pg.evaluate(VIS, False); wait_ver('test-v3'); R['2_reloaded_on_foreground'] = ver() == 'test-v3'

    # 3 hidden -> reload at once
    pg.wait_for_timeout(500); m = mark(); pg.evaluate(VIS, True)
    deploy('test-v4'); pg.evaluate('__avataUpdate.check()'); wait_ver('test-v4')
    R['3_hidden_reloaded'] = not marked(m)

    # 4 long task in progress: wait even across a background/foreground cycle
    pg.wait_for_timeout(500); pg.evaluate("import('./js/ui.js').then(u => { window.__done = u.holdWork('spin-build'); })"); m = mark()
    deploy('test-v5'); pg.evaluate('__avataUpdate.check()'); pg.wait_for_selector('#updToast', timeout=15000)
    pg.evaluate(VIS, True); pg.wait_for_timeout(200); pg.evaluate(VIS, False); pg.wait_for_timeout(1500)
    R['4_busy_no_reload'] = marked(m) and ver() == 'test-v4'
    pg.evaluate('window.__done()'); pg.evaluate(VIS, True); pg.wait_for_timeout(200); pg.evaluate(VIS, False); wait_ver('test-v5')
    R['4_reloaded_after_task'] = True

    # 5 a new worker with the version this page already runs -> no reload (checks the loop guard path)
    pg.wait_for_timeout(500); m = mark()
    sw = TMP / 'sw.js'; sw.write_text(sw.read_text() + '\n// same version, different bytes\n')
    pg.evaluate('__avataUpdate.check()'); pg.wait_for_timeout(4000)
    R['5_same_version_no_reload'] = marked(m)
    # 6 sw.js changes but the page's own files don't (version mismatch that a reload can't fix) -> one reload, then settles
    pg.wait_for_timeout(500); navs = []; pg.on('framenavigated', lambda f: f == pg.main_frame and navs.append(f.url))
    sw.write_text(sw.read_text().replace("'test-v5'", "'test-v6'")); pg.evaluate('__avataUpdate.check()'); pg.wait_for_timeout(5000)
    pg.evaluate('__avataUpdate.check()'); pg.wait_for_timeout(3000)
    R['6_no_reload_loop'] = len(navs) == 1
    sw.write_text(sw.read_text().replace("'test-v6'", "'test-v5'"))
    R['network_first_fresh_js'] = 'test-v5' in pg.evaluate("fetch('js/app.js').then(r => r.text())")
    R['errors'] = errors
    b.close()
finally:
  srv.terminate(); shutil.rmtree(TMP.parent, ignore_errors=True)
print(json.dumps(R, indent=1))
ok = all(v for k, v in R.items() if k[0].isdigit() or k.startswith('network')) and not errors
print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
