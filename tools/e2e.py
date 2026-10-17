"""Headless smoke test + mobile screenshots (390x844). Provider calls are MOCKED via route interception."""
import json, sys, base64, pathlib
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'screenshots'
SHEET = '/home/box/agent-data/agents/f0d5949a-ffc8-4126-a637-06b1fb6bca6a/attachments/9414dd9d9a7bccaa100860b1174b7a138c6df7af86d5b857538ea469cb485bb4.jpg'
MOCK_IMG = (pathlib.Path(__file__).resolve().parent.parent / 'assets/models/model-2-front.webp').read_bytes()
errors, sent = [], []
def mock(route):
  u = route.request.url; m = route.request.method
  if m == 'OPTIONS': return route.fulfill(status=200, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
  H = {'access-control-allow-origin': '*', 'content-type': 'application/json'}
  if m == 'POST':
    sent.append({'url': u, 'body': json.loads(route.request.post_data)})
    return route.fulfill(status=200, headers=H, body=json.dumps({'request_id': 'mock1', 'status_url': 'https://queue.fal.run/fal-ai/nano-banana-pro/requests/mock1/status', 'response_url': 'https://queue.fal.run/fal-ai/nano-banana-pro/requests/mock1', 'cancel_url': 'https://queue.fal.run/x/cancel', 'queue_position': 0}))
  if u.split('?')[0].endswith('/status'):
    return route.fulfill(status=200, headers=H, body=json.dumps({'status': 'COMPLETED'}))
  return route.fulfill(status=200, headers=H, body=json.dumps({'images': [{'url': 'https://v3.fal.media/files/mock/out.webp', 'width': 768, 'height': 1152, 'content_type': 'image/webp'}]}))
with sync_playwright() as p:
  b = p.chromium.launch()
  for scheme in ['light', 'dark']:
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme=scheme)
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://queue.fal.run/**', mock)
    pg.route('https://v3.fal.media/**', lambda r: r.fulfill(status=200, headers={'access-control-allow-origin': '*', 'content-type': 'image/webp'}, body=MOCK_IMG))
    pg.goto(BASE + '#/studio'); pg.wait_for_selector('.card-model img'); pg.wait_for_timeout(700)
    sfx = '' if scheme == 'light' else '-dark'
    pg.screenshot(path=str(OUT / f'01-studio{sfx}.png'))
    if scheme == 'dark':
      ctx.close(); continue
    pg.evaluate("window.scrollTo(0, document.querySelector('#s2').closest('section').offsetTop - 70)"); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / '02a-studio-outfit.png'))
    pg.evaluate("window.scrollTo(0, document.querySelector('#realismBox').offsetTop - 70)"); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / '02b-studio-realism.png'))
    pg.evaluate("window.scrollTo(0, 0)")
    # Error state: no key
    pg.fill('#outfitText', 'Oversized cream cable-knit sweater tucked into high-waisted straight-leg dark denim')
    pg.click('#go'); pg.wait_for_selector('.err'); pg.locator('#job').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / '03-error-no-key.png'))
    # prompt preview
    pg.click('#pp'); pg.wait_for_selector('pre.prompt'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / '04-prompt-preview.png'))
    prompt_text = pg.inner_text('#pTxt'); pg.click('[data-close]')
    # models
    pg.goto(BASE + '#/models'); pg.wait_for_selector('.lib-card img'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / '05-models.png'))
    pg.click('.lib-card'); pg.wait_for_selector('#mName'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / '06-model-detail.png'))
    pg.locator('#saveM').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    pg.screenshot(path=str(OUT / '07-model-profile.png'))
    # import
    pg.goto(BASE + '#/import'); pg.set_input_files('#sFile', SHEET); pg.wait_for_selector('#work:not([hidden])'); pg.wait_for_function("document.querySelector('#cB').naturalWidth>0"); pg.wait_for_timeout(500)
    detect = pg.inner_text('#detect'); split = pg.input_value('#splitR')
    pg.screenshot(path=str(OUT / '08-import.png'))
    pg.fill('#iName', 'Imported test'); pg.click('#saveI'); pg.wait_for_selector('#mName'); imported = pg.input_value('#mName')
    # settings + key
    pg.goto(BASE + '#/settings'); pg.wait_for_selector('#k-fal'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / '09-settings.png'))
    pg.fill('#k-fal', 'mock-id:mock-secret'); pg.dispatch_event('#k-fal', 'change'); pg.wait_for_timeout(300)
    # mocked generation end-to-end
    pg.goto(BASE + '#/studio'); pg.wait_for_selector('.card-model')
    pg.click('.card-model[data-id="starter-model-2"]')
    pg.set_input_files('#gFile', SHEET)  # any image works as a garment for the flow test
    pg.click('#go'); pg.wait_for_selector('.viewer', timeout=20000); pg.wait_for_timeout(600)
    pg.screenshot(path=str(OUT / '10-viewer-mock.png'))
    pg.click('#cmpSeg [data-v=side]'); pg.wait_for_timeout(400); pg.screenshot(path=str(OUT / '11-compare-side.png'))
    pg.click('#cmpSeg [data-v=wipe]'); pg.wait_for_timeout(400); pg.screenshot(path=str(OUT / '12-compare-wipe.png'))
    pg.click('#vFav'); pg.wait_for_timeout(200); pg.click('[data-close]')
    pg.goto(BASE + '#/gallery'); pg.wait_for_selector('.shot img'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / '13-gallery-mock.png'))
    sw = pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)")
    ctx.close()
  b.close()
body = sent[0]['body'] if sent else {}
print(json.dumps({'errors': errors, 'detect': detect, 'split': split, 'imported': imported, 'sw': sw, 'sent_url': sent[0]['url'] if sent else None,
  'body_keys': sorted(body.keys()), 'n_images': len(body.get('image_urls', [])), 'img_prefix': [u[:23] for u in body.get('image_urls', [])], 'aspect': body.get('aspect_ratio'), 'res': body.get('resolution')}, indent=1))
print('--- PROMPT (preview, model 1, no garments) ---'); print(prompt_text)
