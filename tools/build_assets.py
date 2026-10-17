"""Build bundled starter-model assets and app icons.
Splitting mirrors js/split.js: estimate background from the border, build a
column foreground profile, cut at the widest empty gap near the centre, then
crop each half to the figure's bounding box and pad onto a 2:3 portrait canvas.
"""
import sys, statistics
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = {
  'model-1': '/home/box/agent-data/agents/f0d5949a-ffc8-4126-a637-06b1fb6bca6a/attachments/8c6c5fb5d738cfe0fcef3666547aaeac36b387d05d54ada658d287f4b4cd2fa5.jpg',
  'model-2': '/home/box/agent-data/agents/f0d5949a-ffc8-4126-a637-06b1fb6bca6a/attachments/9414dd9d9a7bccaa100860b1174b7a138c6df7af86d5b857538ea469cb485bb4.jpg',
}
T = 38

def analyse(im):
  small = im.convert('RGB').copy(); small.thumbnail((512, 512))
  w, h = small.size; px = small.load()
  border = [px[x, 0] for x in range(w)] + [px[x, h-1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w-1, y] for y in range(h)]
  bg = tuple(int(statistics.median(c[i] for c in border)) for i in range(3))
  fg = lambda p: abs(p[0]-bg[0]) + abs(p[1]-bg[1]) + abs(p[2]-bg[2]) > T
  cols = [sum(1 for y in range(h) if fg(px[x, y])) for x in range(w)]
  lo, hi = int(w*.3), int(w*.7); limit = max(1, int(h*.004))
  best = (0, None); run = None
  for x in range(lo, hi+1):
    if cols[x] <= limit:
      run = x if run is None else run
      if x - run + 1 > best[0]: best = (x - run + 1, (run + x)//2)
    else: run = None
  split = best[1] if best[1] is not None else min(range(lo, hi), key=lambda x: cols[x])
  return bg, split / w, small, fg

def bbox(small, fg, x0, x1):
  w, h = small.size; px = small.load()
  xs, ys = [], []
  for y in range(h):
    for x in range(x0, x1):
      if fg(px[x, y]): xs.append(x); ys.append(y)
  return min(xs), min(ys), max(xs), max(ys)

def crop_half(im, small, fg, bg, x0, x1):
  s = im.width / small.width
  l, t, r, b = bbox(small, fg, x0, x1)
  l, t, r, b = l*s, t*s, (r+1)*s, (b+1)*s
  bw, bh = r-l, b-t; pad = bh*.04
  H = bh + 2*pad; W = max(H*2/3, bw + 2*pad); H = max(H, W*1.5)
  cx, cy = (l+r)/2, (t+b)/2
  out = Image.new('RGB', (round(W), round(H)), bg)
  box = (round(cx-W/2), round(cy-H/2), round(cx+W/2), round(cy+H/2))
  region = im.crop(box)  # PIL fills out-of-bounds with black; repaint
  canvas = Image.new('RGB', region.size, bg)
  hx0, hx1 = x0*s, x1*s  # never let the neighbouring figure bleed in
  ix0, iy0 = max(0, box[0], round(hx0)), max(0, box[1]); ix1, iy1 = min(im.width, box[2], round(hx1)), min(im.height, box[3])
  canvas.paste(im.crop((ix0, iy0, ix1, iy1)), (ix0-box[0], iy0-box[1]))
  out = canvas
  if out.height > 1536: out = out.resize((round(out.width*1536/out.height), 1536), Image.LANCZOS)
  return out

def models():
  d = ROOT/'assets/models'
  for mid, src in SRC.items():
    im = Image.open(src).convert('RGB')
    bg, frac, small, fg = analyse(im)
    sx = round(frac*small.width)
    print(mid, 'bg', bg, 'split', round(frac, 3))
    im.save(d/f'{mid}-sheet.webp', quality=86, method=6)
    crop_half(im, small, fg, bg, 0, sx).save(d/f'{mid}-front.webp', quality=88, method=6)
    crop_half(im, small, fg, bg, sx, small.width).save(d/f'{mid}-back.webp', quality=88, method=6)
    t = crop_half(im, small, fg, bg, 0, sx); t.thumbnail((360, 540)); t.save(d/f'{mid}-thumb.webp', quality=82, method=6)

def icons():
  font = ImageFont.truetype('/tmp/BodoniModa.ttf', 10)
  for size, name, maskable in [(512,'icon-512.png',False),(192,'icon-192.png',False),(512,'maskable-512.png',True),(180,'apple-touch-icon.png',True),(64,'favicon-64.png',False)]:
    S = size*4
    img = Image.new('RGB', (S, S), (20, 17, 15))
    # soft vignette glow
    glow = Image.new('L', (S, S), 0); g = ImageDraw.Draw(glow)
    g.ellipse((S*.1, S*.05, S*.9, S*.85), fill=90); glow = glow.filter(ImageFilter.GaussianBlur(S*.12))
    img.paste(Image.new('RGB', (S, S), (122, 48, 44)), (0, 0), glow)
    if not maskable:
      m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, S-1, S-1), radius=S*.225, fill=255)
      bgc = Image.new('RGBA', (S, S), (0,0,0,0)); bgc.paste(img, (0,0), m); img = bgc
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype('/tmp/BodoniModa.ttf', int(S*(.52 if maskable else .62)))
    try: f.set_variation_by_axes([96, 500])
    except Exception: pass
    bb = d.textbbox((0, 0), 'A', font=f)
    x = (S-(bb[2]-bb[0]))/2 - bb[0]; y = (S-(bb[3]-bb[1]))/2 - bb[1] - S*.02
    d.text((x, y), 'A', font=f, fill=(246, 239, 230))
    lw = S*.2; d.line((S/2-lw/2, y+bb[3]+S*.06, S/2+lw/2, y+bb[3]+S*.06), fill=(232, 165, 152), width=max(2, int(S*.008)))
    img = img.resize((size, size), Image.LANCZOS)
    img.save(ROOT/'icons'/name)

if __name__ == '__main__':
  models(); icons()
