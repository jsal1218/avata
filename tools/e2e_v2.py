"""v2 headless smoke test (390x844): lookbook, showcase, catalog, import, backup round-trip. No paid APIs."""
import json, sys, pathlib, zipfile, subprocess
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
ROOT = pathlib.Path(__file__).resolve().parent.parent; OUT = ROOT / 'screenshots'
SHEET = '/home/box/agent-data/agents/f0d5949a-ffc8-4126-a637-06b1fb6bca6a/attachments/8c6c5fb5d738cfe0fcef3666547aaeac36b387d05d54ada658d287f4b4cd2fa5.jpg'
M1F = str(ROOT / 'assets/models/model-1-front.webp'); M1B = str(ROOT / 'assets/models/model-1-back.webp')
errors, foreign, R = [], set(), {}
from urllib.parse import urlparse
origin = urlparse(BASE).netloc
def shot(pg, name): pg.wait_for_timeout(350); pg.screenshot(path=str(OUT / f'v2-{name}.png'))
with sync_playwright() as p:
  b = p.chromium.launch()
  def ctx_new(scheme='light'):
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme=scheme, accept_downloads=True)
    c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/').rsplit('/', 1)[0] if 'github.io' in BASE else BASE.rstrip('/'))
    pg = c.new_page()
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('request', lambda r: (urlparse(r.url).netloc not in (origin, '') and not r.url.startswith(('data:', 'blob:'))) and foreign.add(urlparse(r.url).netloc))
    return c, pg
  c, pg = ctx_new()
  pg.goto(BASE); pg.wait_for_selector('.look img'); pg.wait_for_timeout(800)
  R['looks_on_load'] = pg.locator('.look').count(); R['collections'] = pg.locator('.coll').count()
  shot(pg, '01-lookbook')
  # showcase
  pg.click('.coll'); pg.wait_for_selector('.show-title'); shot(pg, '02-showcase-cover')
  pg.evaluate("document.querySelector('#track').scrollTo({left: document.querySelector('#track').clientWidth})"); pg.wait_for_timeout(500)
  shot(pg, '03-showcase-slide')
  R['showcase_text'] = pg.inner_text('.slide:nth-child(2) .slide-cap')
  pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
  # filters sheet
  pg.click('#lFilt'); pg.wait_for_selector('#fApply'); shot(pg, '04-filters'); pg.select_option('#fV', 'back'); pg.click('#fApply'); pg.wait_for_timeout(300)
  R['filtered_back'] = pg.locator('.look').count(); pg.click('[data-clear="view"]'); pg.wait_for_timeout(200)
  # styles
  pg.goto(BASE + '#/styles'); pg.wait_for_selector('.srow'); shot(pg, '05-styles')
  R['styles'] = pg.locator('.srow').count()
  pg.click('.srow >> nth=0'); pg.wait_for_selector('.kv.big'); shot(pg, '06-style-detail')
  pg.evaluate("document.querySelector('.masonry')?.scrollIntoView({block:'start'}); scrollBy(0,-90)"); shot(pg, '07-style-mockups')
  # new style
  pg.goto(BASE + '#/style-edit/new'); pg.wait_for_selector('#sf')
  pg.fill('[name=sku]', 'AV-2701'); pg.fill('[name=name]', 'Bias Satin Slip Dress'); pg.fill('[name=collection]', 'Resort 27'); pg.fill('[name=season]', 'SS27')
  pg.select_option('[name=category]', 'Dresses'); pg.click('.chip[data-g=status][data-v=Sampling]')
  for z in ['XS', 'S', 'M', 'L']: pg.click(f'.chip[data-g=size][data-v="{z}"]')
  pg.fill('[name=fabric]', 'Satin'); pg.fill('[name=composition]', '100% polyester satin'); pg.fill('[name=colorways]', 'Espresso, Ivory')
  pg.set_input_files('#phf', str(ROOT / 'assets/samples/sketch-set.svg')); pg.wait_for_selector('#ph .tile img')
  pg.fill('[name=supplier]', 'Line 3'); pg.fill('[name=cost]', '18.40'); pg.fill('[name=price]', '79'); pg.fill('[name=tags]', 'hero, buyer-pick')
  pg.evaluate("scrollTo(0,0)"); shot(pg, '08-style-new')
  pg.click('#sf button[type=submit]'); pg.wait_for_selector('.kv.big'); R['new_style_title'] = pg.inner_text('h1.display')
  # bulk import mockups linked to it
  pg.click('a[href^="#/import-looks?style="]'); pg.wait_for_selector('#lpick')
  pg.set_input_files('#lf', [M1F, M1B]); pg.wait_for_selector('.imp >> nth=1'); pg.select_option('#lm', 'starter-model-1')
  pg.wait_for_timeout(300); shot(pg, '09-import-mockups')
  R['import_views'] = [pg.input_value(f'.imp:nth-child({i}) select') for i in (1, 2)]
  pg.click('#lsave'); pg.wait_for_selector('.kv.big'); pg.wait_for_timeout(300)
  R['new_style_looks'] = pg.locator('.look').count()
  pg.click('.look >> nth=0'); pg.wait_for_selector('.viewer'); shot(pg, '10-look-viewer')
  pg.click('#cmpSeg [data-v=side]'); shot(pg, '11-look-compare')
  pg.keyboard.press('Escape')
  # models + prompt builder
  pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card'); shot(pg, '12-models')
  pg.goto(BASE + '#/model/starter-model-2'); pg.wait_for_selector('#mName'); shot(pg, '13-model-detail')
  pg.goto(BASE + '#/styles'); pg.wait_for_selector('.srow'); pg.click('text=Bias Satin Slip Dress'); pg.wait_for_selector('.kv.big')
  pg.click('a[href^="#/studio?style="]'); pg.wait_for_selector('#copyP'); pg.wait_for_timeout(500)
  R['studio_has_generate'] = pg.locator('#go').count(); R['bills_text'] = 'bills' in pg.inner_text('#view').lower()
  R['studio_outfit'] = pg.input_value('#outfitText'); R['studio_garments'] = pg.locator('#tiles .tile img').count()
  shot(pg, '14-prompt-builder')
  pg.click('#copyP'); pg.wait_for_timeout(300)
  try: R['clipboard_head'] = pg.evaluate("navigator.clipboard.readText()")[:160]
  except Exception as e: R['clipboard_head'] = 'n/a ' + str(e)[:60]
  pg.click('#pp'); pg.wait_for_selector('#pTxt'); shot(pg, '15-prompt-sheet'); pg.keyboard.press('Escape')
  # settings + backup
  pg.goto(BASE + '#/settings'); pg.wait_for_selector('#expZip'); pg.wait_for_timeout(500); shot(pg, '16-settings')
  R['advanced_open'] = pg.evaluate("document.querySelector('#adv').open"); R['key_inputs_visible'] = pg.locator('#k-fal').count()
  pg.click('#adv summary'); pg.evaluate("document.querySelector('#adv').scrollIntoView()"); shot(pg, '17-settings-advanced')
  with pg.expect_download() as d: pg.click('#expZip')
  zp = '/tmp/avata-backup.zip'; d.value.save_as(zp)
  z = zipfile.ZipFile(zp); lib = json.loads(z.read('library.json'))
  R['zip'] = {'entries': len(z.namelist()), 'testzip': z.testzip(), 'models': len(lib['models']), 'styles': len(lib['styles']), 'looks': len(lib['looks']), 'size_mb': round(pathlib.Path(zp).stat().st_size / 1e6, 2)}
  with pg.expect_download() as d: pg.click('#csv')
  cp = '/tmp/avata-styles.csv'; d.value.save_as(cp); R['csv_head'] = open(cp, encoding='utf-8-sig').read().splitlines()[:2]
  with pg.expect_download() as d: pg.click('#expJson')
  jp = '/tmp/avata-backup.json'; d.value.save_as(jp); R['json_mb'] = round(pathlib.Path(jp).stat().st_size / 1e6, 2)
  c.close()
  # restore into a brand-new device (fresh context)
  c, pg = ctx_new('dark')
  pg.goto(BASE + '#/settings'); pg.wait_for_selector('#impF', state='attached')
  pg.set_input_files('#impF', zp); pg.wait_for_selector('#mReplace'); pg.once('dialog', lambda dl: dl.accept()); pg.click('#mReplace'); pg.wait_for_timeout(1200)
  R['restored'] = pg.inner_text('#store')
  pg.goto(BASE + '#/looks'); pg.wait_for_selector('.look img'); pg.wait_for_timeout(600); shot(pg, '18-lookbook-dark-restored')
  R['restored_looks'] = pg.locator('.look').count()
  pg.goto(BASE + '#/styles'); pg.wait_for_selector('.srow'); shot(pg, '19-styles-dark')
  R['sw'] = pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)")
  c.close(); b.close()
R['errors'] = errors; R['foreign_hosts'] = sorted(foreign)
print(json.dumps(R, indent=1))
