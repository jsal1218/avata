// node --test tests/  — verifies request shapes against the documented schemas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, MODELS, runFal, runGemini, parseGeminiImages, friendlyError } from '../js/providers.js';
import { buildPrompt, bodySpecText, cmToFtIn, ftInToCm } from '../js/prompt.js';
import { STARTERS } from '../js/starters.js';

const img = 'data:image/jpeg;base64,AAAA';
const ctx = { prompt: 'p', images: [img, img, img], aspect: '3:4', resolution: '2K', numImages: 2, safety: 4, modelImage: img, garmentImages: [img] };

test('height conversion', () => {
  assert.deepEqual(cmToFtIn(160), { ft: 5, inch: 3 });
  assert.equal(ftInToCm(5, 3), 160);
});

test('starter models carry height, body type, size, measurements', () => {
  for (const s of STARTERS) { assert.equal(s.heightCm, 160); assert.ok(s.bodyType && s.size && s.measurements.bust); }
  const t = bodySpecText(STARTERS.find(s => s.id === 'starter-exact-6')); // exact-6 (Model 3 since the 2026-10-22 reorder)
  assert.equal(STARTERS[0].id, 'starter-exact-26');   // Model 1 since exact-12 was removed (later 2026-10-22)
  assert.match(t, /5 ft 3 in \/ 160 cm/); assert.match(t, /petite/); assert.match(t, /curvy/); assert.match(t, /bust 40 in \(102 cm\)/); assert.match(t, /inseam 28 in \(71 cm\)/); assert.match(t, /12–14 \/ L/);
});

test('prompt maps images and locks identity', () => {
  const p = buildPrompt({ model: STARTERS[1], refs: [{ role: 'front' }, { role: 'back' }, { role: 'garment' }, { role: 'garment' }], outfitText: 'red satin slip dress', fabric: 'satin', view: 'back' });
  assert.match(p, /image 1 is the model's identity reference, front view/);
  assert.match(p, /image 2 is the same model, back view/);
  assert.match(p, /images 3 and 4 are the garment references/);
  assert.match(p, /Identity lock/); assert.match(p, /BACK view/); assert.match(p, /160 cm/); assert.match(p, /satin/i);
});

test('nano banana pro/2 body matches fal schema', () => {
  for (const id of ['fal-ai/nano-banana-pro/edit', 'fal-ai/nano-banana-2/edit']) {
    const r = buildRequest(id, ctx);
    assert.equal(r.url, `https://queue.fal.run/${id}`);
    assert.deepEqual(Object.keys(r.body).sort(), ['aspect_ratio', 'image_urls', 'limit_generations', 'num_images', 'output_format', 'prompt', 'resolution', 'safety_tolerance'].sort());
    assert.equal(r.body.aspect_ratio, '3:4'); assert.equal(r.body.resolution, '2K'); assert.equal(r.body.safety_tolerance, '4'); assert.equal(r.body.num_images, 2);
  }
});

test('seedream sizes respect documented pixel bounds', () => {
  for (const res of ['1K', '2K']) for (const aspect of ['3:4', '1:1']) {
    const { width, height } = buildRequest('bytedance/seedream/v5/pro/edit', { ...ctx, resolution: res, aspect }).body.image_size;
    assert.ok(width * height >= 1024 * 1024 && width * height <= 2048 * 2048, `${width}x${height}`);
  }
  for (const res of ['2K', '4K']) for (const aspect of ['3:4', '1:1']) {
    const { width, height } = buildRequest('fal-ai/bytedance/seedream/v4.5/edit', { ...ctx, resolution: res, aspect }).body.image_size;
    assert.ok(width * height >= 2560 * 1440 && width * height <= 4096 * 4096, `${width}x${height}`);
  }
  assert.equal(buildRequest('fal-ai/bytedance/seedream/v4.5/edit', { ...ctx, resolution: '1K' }).body.image_size.width, 1920);
});

test('flux 2 pro + fashn bodies', () => {
  const f = buildRequest('fal-ai/flux-2-pro/edit', ctx).body;
  assert.equal(f.image_size, 'portrait_4_3'); assert.equal(f.safety_tolerance, '4'); assert.ok(!('num_images' in f));
  const t = buildRequest('fal-ai/fashn/tryon/v1.6', ctx).body;
  assert.equal(t.model_image, img); assert.equal(t.garment_image, img); assert.equal(t.category, 'auto'); assert.equal(t.num_samples, 2);
});

test('gemini interactions body', () => {
  const r = buildRequest('gemini-3-pro-image', ctx);
  assert.equal(r.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(r.body.model, 'gemini-3-pro-image');
  assert.deepEqual(r.body.input[0], { type: 'text', text: 'p' });
  assert.deepEqual(r.body.input[1], { type: 'image', mime_type: 'image/jpeg', data: 'AAAA' });
  assert.deepEqual(r.body.response_format, { type: 'image', aspect_ratio: '3:4', image_size: '2K' });
});

test('image caps applied', () => {
  for (const m of MODELS.filter(m => m.usesPrompt)) {
    const r = buildRequest(m.id, { ...ctx, images: Array(14).fill(img) });
    const n = (r.body.image_urls || r.body.input.filter(x => x.type === 'image')).length;
    assert.equal(n, m.maxImages);
  }
});

function fakeFetch(script) { const calls = []; const f = async (url, init = {}) => { calls.push({ url, init }); const s = script.shift(); return { ok: s.status < 300, status: s.status, text: async () => JSON.stringify(s.body) }; }; f.calls = calls; return f; }

test('fal queue flow uses status_url/response_url', async () => {
  const f = fakeFetch([
    { status: 200, body: { request_id: 'r1', status_url: 'https://queue.fal.run/fal-ai/x/requests/r1/status', response_url: 'https://queue.fal.run/fal-ai/x/requests/r1', cancel_url: 'c', queue_position: 0 } },
    { status: 202, body: { status: 'IN_QUEUE', queue_position: 0 } },
    { status: 200, body: { status: 'IN_PROGRESS', logs: [{ message: 'step' }] } },
    { status: 200, body: { status: 'COMPLETED' } },
    { status: 200, body: { images: [{ url: 'https://v3.fal.media/x.png' }] } },
  ]);
  const out = await runFal({ endpoint: 'fal-ai/x/edit', body: { a: 1 }, key: 'k', fetchImpl: f, pollMs: 1 });
  assert.equal(out.images[0].url, 'https://v3.fal.media/x.png');
  assert.equal(f.calls[0].url, 'https://queue.fal.run/fal-ai/x/edit');
  assert.equal(f.calls[0].init.headers.Authorization, 'Key k');
  assert.equal(f.calls[1].url, 'https://queue.fal.run/fal-ai/x/requests/r1/status?logs=1');
  assert.equal(f.calls[4].url, 'https://queue.fal.run/fal-ai/x/requests/r1');
});

test('fal errors are friendly', async () => {
  await assert.rejects(runFal({ endpoint: 'e', body: {}, key: 'bad', fetchImpl: fakeFetch([{ status: 401, body: { detail: 'invalid key credentials' } }]) }), /rejected your API key/);
  await assert.rejects(runFal({ endpoint: 'e', body: {}, key: '' }), /No fal.ai key/);
  const e = friendlyError('fal', 422, { detail: [{ loc: ['body', 'image_urls'], msg: 'field required' }] });
  assert.match(e.message, /image_urls: field required/);
});

test('gemini response parsing + errors', async () => {
  const j = { steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: 'ok' }, { type: 'image', mime_type: 'image/png', data: 'QQ==' }] }] };
  assert.equal(parseGeminiImages(j)[0].dataUrl, 'data:image/png;base64,QQ==');
  await assert.rejects(runGemini({ body: {}, key: 'bad', fetchImpl: fakeFetch([{ status: 400, body: [{ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } }] }]) }), /rejected your API key/);
  await assert.rejects(runGemini({ body: {}, key: 'k', fetchImpl: fakeFetch([{ status: 200, body: { steps: [{ type: 'model_output', content: [{ type: 'text', text: 'I cannot' }] }] } }]) }), /no image/);
});
