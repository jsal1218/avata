import test from 'node:test';
import assert from 'node:assert/strict';
import { orderFiles, evenAngles, bracket, blendWeight, videoTimes, detectSubject, placement, hiCanvasHeight, movingMedian, LAYOUT } from '../js/spin-core.js';

test('orderFiles: numbered names sort naturally, otherwise upload order', () => {
  const f = n => ({ name: n });
  assert.deepEqual(orderFiles([f('shot10.jpg'), f('shot2.jpg'), f('shot1.jpg')]).files.map(x => x.name), ['shot1.jpg', 'shot2.jpg', 'shot10.jpg']);
  assert.equal(orderFiles([f('b10.jpg'), f('a2.jpg')]).by, 'name');
  const same = [f('image.jpg'), f('image.jpg'), f('image.jpg')]; // iOS picker often names everything "image"
  assert.equal(orderFiles(same).by, 'upload');
  assert.deepEqual(orderFiles([f('front.jpg'), f('side.jpg'), f('back.jpg')]).files.map(x => x.name), ['front.jpg', 'side.jpg', 'back.jpg']);
});

test('angles, bracket and crossfade weights', () => {
  assert.deepEqual(evenAngles(4), [0, 90, 180, 270]);
  const b = bracket([0, 90, 180, 270], 135);
  assert.equal(b.i, 1); assert.equal(b.j, 2); assert.equal(b.t, 0.5); assert.equal(b.gap, 90);
  assert.equal(bracket([0, 90, 180, 270], 300).j, 0); // wraps around
  // sparse set: holds near real frames, dissolves through the middle
  assert.equal(blendWeight(0.1, 90), 0); assert.equal(blendWeight(0.9, 90), 1); assert.equal(blendWeight(0.5, 90), 0.5);
  assert.ok(blendWeight(0.35, 90) > 0 && blendWeight(0.35, 90) < 0.5);
  // dense set (video): nearest frame, no blending
  assert.equal(blendWeight(0.4, 15), 0); assert.equal(blendWeight(0.6, 15), 1);
});

test('videoTimes: evenly spaced, skips the repeated end', () => {
  const t = videoTimes(6);
  assert.equal(t.length, 24); assert.ok(t[0] < 0.1); assert.ok(t.at(-1) < 6);
  assert.ok(Math.abs((t[2] - t[1]) - 0.25) < 1e-6);
  assert.equal(videoTimes(2).length, 12); assert.equal(videoTimes(60).length, 36);
  assert.deepEqual(videoTimes(NaN), []);
});

function synth(w, h, bg, box, fg = [40, 30, 30]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4, inside = x >= box.l && x < box.r && y >= box.t && y < box.b;
    const c = inside ? fg : bg.map(v => v + ((x * 7 + y * 13) % 5) - 2); // mild noise
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
  }
  return d;
}

test('detectSubject finds the subject box against a plain background', () => {
  const w = 120, h = 200, box = { l: 40, t: 20, r: 80, b: 180 };
  const r = detectSubject(synth(w, h, [235, 232, 228], box), w, h);
  assert.equal(r.method, 'background');
  assert.deepEqual([r.box.l, r.box.t, r.box.r, r.box.b], [40, 20, 80, 180]);
  assert.ok(Math.abs(r.box.cx - 60) <= 1);
  assert.ok(Math.abs(r.bg[0] - 235) <= 2);
  // a few stray specks don't move the box
  const d = synth(w, h, [255, 255, 255], box); for (const [x, y] of [[5, 100], [110, 30]]) { const k = (y * w + x) * 4; d[k] = d[k + 1] = d[k + 2] = 0; }
  const r2 = detectSubject(d, w, h);
  assert.deepEqual([r2.box.l, r2.box.t, r2.box.r, r2.box.b], [40, 20, 80, 180]);
});

test('placement puts every subject at the same height and feet line', () => {
  const cw = 600, ch = 1000;
  for (const box of [{ l: 10, t: 50, r: 90, b: 450, cx: 50 }, { l: 300, t: 400, r: 700, b: 2400, cx: 500 }]) {
    const p = placement(box, cw, ch);
    assert.ok(Math.abs((box.b - box.t) * p.s - LAYOUT.subject * ch) < 1e-6);
    assert.ok(Math.abs(box.b * p.s + p.dy - LAYOUT.feet * ch) < 1e-6);
    assert.ok(Math.abs(box.cx * p.s + p.dx - cw / 2) < 1e-6);
  }
  assert.equal(hiCanvasHeight([2000, 2100, 1900]), 2380);
  assert.equal(hiCanvasHeight([400]), 1200); assert.equal(hiCanvasHeight([9000]), 3000);
  assert.deepEqual(movingMedian([1, 9, 1, 1, 1], 3), [1, 1, 1, 1, 1]);
});
