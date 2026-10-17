// Provider registry + request builders + runners.
// Request bodies were checked against the fal model pages (fal.ai/models/<id>/llms.txt)
// and the Gemini image-generation docs (Interactions API) on 2026-10-17.

export const PROVIDERS = {
  fal: { label: 'fal.ai', keyName: 'fal', signup: 'https://fal.ai/dashboard/keys', billing: 'https://fal.ai/dashboard/billing' },
  gemini: { label: 'Google Gemini API', keyName: 'gemini', signup: 'https://aistudio.google.com/apikey', billing: 'https://aistudio.google.com/usage' },
};

const SAFETY6 = v => String(Math.min(6, Math.max(1, Number(v) || 4)));
const SAFETY5 = v => String(Math.min(5, Math.max(1, Number(v) || 4)));

function seedreamSize(aspect, res, { min4k = false } = {}) {
  const sq = aspect === '1:1';
  if (min4k) { // v4.5: total pixels between 2560*1440 and 4096*4096
    if (res === '4K') return sq ? { width: 4096, height: 4096 } : { width: 3072, height: 4096 };
    return sq ? { width: 2048, height: 2048 } : { width: 1920, height: 2560 };
  }
  // v5 pro: total pixels between 1024*1024 and 2048*2048
  if (res === '1K') return sq ? { width: 1024, height: 1024 } : { width: 1024, height: 1366 };
  return sq ? { width: 2048, height: 2048 } : { width: 1536, height: 2048 };
}

export const MODELS = [
  {
    id: 'fal-ai/nano-banana-pro/edit', provider: 'fal', label: 'Nano Banana Pro edit', vendor: 'Google · Gemini 3 Pro Image via fal',
    blurb: 'Best identity lock + garment fidelity. Recommended.', maxImages: 8, views: 'all', usesPrompt: true, resolutions: ['1K', '2K', '4K'],
    build: c => ({ prompt: c.prompt, image_urls: c.images, num_images: c.numImages, aspect_ratio: c.aspect, resolution: c.resolution, output_format: 'png', safety_tolerance: SAFETY6(c.safety), limit_generations: true, ...(c.seed != null ? { seed: c.seed } : {}) }),
  },
  {
    id: 'fal-ai/nano-banana-2/edit', provider: 'fal', label: 'Nano Banana 2 edit', vendor: 'Google · Gemini 3.1 Flash Image via fal',
    blurb: 'Faster and cheaper, very good consistency.', maxImages: 8, views: 'all', usesPrompt: true, resolutions: ['1K', '2K', '4K'],
    build: c => ({ prompt: c.prompt, image_urls: c.images, num_images: c.numImages, aspect_ratio: c.aspect, resolution: c.resolution, output_format: 'png', safety_tolerance: SAFETY6(c.safety), limit_generations: true, ...(c.seed != null ? { seed: c.seed } : {}) }),
  },
  {
    id: 'bytedance/seedream/v5/pro/edit', provider: 'fal', label: 'Seedream 5.0 Pro edit', vendor: 'ByteDance via fal',
    blurb: 'Strong photoreal skin and multi-reference edits (up to 10 images).', maxImages: 10, views: 'all', usesPrompt: true, resolutions: ['1K', '2K'],
    build: c => ({ prompt: c.prompt, image_urls: c.images, num_images: c.numImages, image_size: seedreamSize(c.aspect, c.resolution), output_format: 'png', enhance_prompt_mode: 'standard', enable_safety_checker: true }),
  },
  {
    id: 'fal-ai/bytedance/seedream/v4.5/edit', provider: 'fal', label: 'Seedream 4.5 edit', vendor: 'ByteDance via fal',
    blurb: 'High-res (2K–4K) multi-reference editing.', maxImages: 10, views: 'all', usesPrompt: true, resolutions: ['2K', '4K'],
    build: c => ({ prompt: c.prompt, image_urls: c.images, num_images: c.numImages, max_images: 1, image_size: seedreamSize(c.aspect, c.resolution, { min4k: true }), enable_safety_checker: true, ...(c.seed != null ? { seed: c.seed } : {}) }),
  },
  {
    id: 'fal-ai/flux-2-pro/edit', provider: 'fal', label: 'FLUX.2 [pro] edit', vendor: 'Black Forest Labs via fal',
    blurb: 'Photoreal multi-reference editing; one image per call.', maxImages: 8, views: 'all', usesPrompt: true, resolutions: ['auto'], single: true,
    build: c => ({ prompt: c.prompt, image_urls: c.images, image_size: c.aspect === '1:1' ? 'square_hd' : 'portrait_4_3', output_format: 'png', safety_tolerance: SAFETY5(c.safety), enable_safety_checker: true, ...(c.seed != null ? { seed: c.seed } : {}) }),
  },
  {
    id: 'fal-ai/fashn/tryon/v1.6', provider: 'fal', label: 'FASHN Try-On v1.6', vendor: 'FASHN via fal',
    blurb: 'Dedicated try-on: 1 garment photo onto the front view (864×1296). Ignores text/realism prompt.', maxImages: 2, views: ['front'], usesPrompt: false, needsGarment: true, resolutions: ['auto'],
    build: c => ({ model_image: c.modelImage, garment_image: c.garmentImages[0], category: 'auto', mode: 'quality', garment_photo_type: 'auto', moderation_level: 'permissive', num_samples: c.numImages, output_format: 'png', ...(c.seed != null ? { seed: c.seed } : {}) }),
  },
  {
    id: 'gemini-3-pro-image', provider: 'gemini', label: 'Gemini 3 Pro Image (direct)', vendor: 'Google AI Studio key',
    blurb: 'Nano Banana Pro straight from Google. One image per call.', maxImages: 8, views: 'all', usesPrompt: true, resolutions: ['1K', '2K', '4K'], single: true,
    build: c => geminiBody('gemini-3-pro-image', c),
  },
  {
    id: 'gemini-nano-banana-2.1', provider: 'gemini', label: 'Nano Banana 2.1 (direct)', vendor: 'Google AI Studio key',
    blurb: 'Google\'s current fast image model. One image per call.', maxImages: 8, views: 'all', usesPrompt: true, resolutions: ['1K', '2K', '4K'], single: true,
    build: c => geminiBody('gemini-nano-banana-2.1', c),
  },
];

export const UPSCALERS = [
  { id: 'fal-ai/seedvr/upscale/image', label: 'SeedVR2 2× (faithful)', build: url => ({ image_url: url, upscale_mode: 'factor', upscale_factor: 2, noise_scale: 0.1, output_format: 'png' }) },
  { id: 'fal-ai/topaz/upscale/image', label: 'Topaz High Fidelity 2×', build: url => ({ image_url: url, model: 'High Fidelity V2', upscale_factor: 2, output_format: 'png', face_enhancement: false }) },
  { id: 'fal-ai/topaz/upscale/image#face', endpoint: 'fal-ai/topaz/upscale/image', label: 'Topaz 2× + gentle face/skin detail', build: url => ({ image_url: url, model: 'Standard V2', upscale_factor: 2, output_format: 'png', face_enhancement: true, face_enhancement_creativity: 0, face_enhancement_strength: 0.35 }) },
  { id: 'refine', label: 'Skin-detail refine (edit pass, uses your edit model)', refine: true },
];

export const REFINE_PROMPT = 'Refine this exact photograph without changing anything about the person, pose, outfit, colours, framing or background. Only enhance realism: add natural skin micro-texture (visible pores, fine vellus hair, subtle natural imperfections), remove any waxy or airbrushed look, sharpen fabric weave, seams and stitching, and correct any malformed fingers or toes. Keep the face identical.';

export function getModel(id) { return MODELS.find(m => m.id === id) || MODELS[0]; }

function splitDataUrl(u) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(u || '');
  if (!m) throw new Error('Expected a base64 data URL for Gemini input');
  return { mime_type: m[1], data: m[2] };
}
function geminiBody(model, c) {
  const rf = { type: 'image', aspect_ratio: c.aspect };
  if (c.resolution && c.resolution !== 'auto') rf.image_size = c.resolution;
  return {
    model,
    input: [{ type: 'text', text: c.prompt }, ...c.images.map(u => ({ type: 'image', ...splitDataUrl(u) }))],
    response_format: rf,
  };
}

/** Pure: turn app state into a request description. */
export function buildRequest(modelId, ctx) {
  const m = getModel(modelId);
  const images = (ctx.images || []).slice(0, m.maxImages);
  const c = { numImages: 1, resolution: '2K', aspect: '3:4', safety: 4, ...ctx, images };
  if (m.single) c.numImages = 1;
  if (!m.resolutions.includes(c.resolution)) c.resolution = m.resolutions.includes('2K') ? '2K' : m.resolutions[0];
  if (m.provider === 'fal') return { provider: 'fal', url: `https://queue.fal.run/${m.id}`, endpoint: m.id, body: m.build(c), dropped: (ctx.images || []).length - images.length };
  return { provider: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/interactions', endpoint: m.id, body: m.build(c), dropped: (ctx.images || []).length - images.length };
}

export class ProviderError extends Error {
  constructor(message, { status, hint, raw } = {}) { super(message); this.status = status; this.hint = hint; this.raw = raw; }
}

function detailText(j) {
  if (!j) return '';
  const d = j.detail ?? j.error ?? j.message ?? (Array.isArray(j) ? j[0]?.error : null);
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(x => (x.loc ? `${x.loc.filter(p => p !== 'body').join('.')}: ` : '') + (x.msg || JSON.stringify(x))).join('; ');
  if (d && typeof d === 'object') return d.message || JSON.stringify(d);
  return '';
}

export function friendlyError(provider, status, j) {
  const P = PROVIDERS[provider];
  const d = detailText(j);
  if (status === 401 || (provider === 'gemini' && /API key not valid|API_KEY_INVALID/i.test(d)))
    return new ProviderError(`${P.label} rejected your API key.`, { status, hint: `Check the key in Settings (create one at ${P.signup}).`, raw: d });
  if (status === 402 || status === 403)
    return new ProviderError(`${P.label} refused the request${d ? `: ${d}` : ''}.`, { status, hint: `Usually means no credit/billing or the key lacks access. Billing: ${P.billing}`, raw: d });
  if (status === 404) return new ProviderError(`Model endpoint not found on ${P.label}${d ? `: ${d}` : ''}.`, { status, hint: 'The model may have been renamed or retired — pick another model in Settings.', raw: d });
  if (status === 413) return new ProviderError('Images too large for the provider.', { status, hint: 'Use fewer or smaller garment photos.', raw: d });
  if (status === 422 || status === 400) return new ProviderError(`The provider rejected the request${d ? `: ${d}` : ''}.`, { status, hint: /safety|nsfw|moderat|content/i.test(d) ? 'Blocked by the provider\'s content filter — adjust the outfit or lower strictness in Settings.' : 'Try another model, fewer images or a shorter prompt.', raw: d });
  if (status === 429) return new ProviderError(`${P.label} rate limit or quota reached.`, { status, hint: 'Wait a minute, or check your plan/quota.', raw: d });
  return new ProviderError(`${P.label} error ${status || ''}${d ? `: ${d}` : ''}`.trim(), { status, hint: 'Temporary server problem — try again shortly.', raw: d });
}

async function readJson(res) { const t = await res.text(); try { return JSON.parse(t); } catch { return { detail: t.slice(0, 300) }; } }
const sleep = (ms, signal) => new Promise((r, rej) => { const t = setTimeout(r, ms); signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Cancelled', 'AbortError')); }, { once: true }); });

async function guardedFetch(fetchImpl, url, init, provider) {
  try { return await fetchImpl(url, init); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ProviderError(`Couldn't reach ${PROVIDERS[provider].label}.`, { hint: 'Check your connection (or a content blocker) and try again.', raw: String(e) });
  }
}

/** fal queue API: submit → poll status_url → fetch response_url. */
export async function runFal({ endpoint, body, key, onStatus = () => {}, signal, fetchImpl = fetch, pollMs = 1500, timeoutMs = 8 * 60e3 }) {
  if (!key) throw new ProviderError('No fal.ai key yet.', { hint: `Add it in Settings → fal.ai key (${PROVIDERS.fal.signup}).` });
  const auth = { Authorization: `Key ${key}` };
  const sub = await guardedFetch(fetchImpl, `https://queue.fal.run/${endpoint}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }, 'fal');
  const sj = await readJson(sub);
  if (!sub.ok) throw friendlyError('fal', sub.status, sj);
  const { status_url, response_url, cancel_url, request_id } = sj;
  if (!status_url || !response_url) throw new ProviderError('Unexpected fal response (no status_url).', { raw: JSON.stringify(sj).slice(0, 300) });
  onStatus({ phase: 'queued', position: sj.queue_position, requestId: request_id });
  const onAbort = () => { if (cancel_url) fetchImpl(cancel_url, { method: 'PUT', headers: auth }).catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  const t0 = Date.now();
  try {
    for (;;) {
      await sleep(pollMs, signal);
      if (Date.now() - t0 > timeoutMs) throw new ProviderError('Timed out waiting for fal.', { hint: 'The job may still finish on fal; check your fal dashboard.' });
      const st = await guardedFetch(fetchImpl, `${status_url}${status_url.includes('?') ? '&' : '?'}logs=1`, { headers: auth, signal }, 'fal');
      const s = await readJson(st);
      if (!st.ok && st.status !== 202) throw friendlyError('fal', st.status, s);
      if (s.status === 'IN_QUEUE') onStatus({ phase: 'queued', position: s.queue_position, requestId: request_id });
      else if (s.status === 'IN_PROGRESS') onStatus({ phase: 'running', log: s.logs?.length ? s.logs[s.logs.length - 1].message : '', requestId: request_id });
      else if (s.status === 'COMPLETED') {
        if (s.error) throw new ProviderError(`fal job failed: ${s.error}`, { hint: /safety|nsfw|content/i.test(s.error) ? 'Content filter — adjust outfit or strictness.' : 'Try again or switch model.', raw: s.error });
        break;
      }
    }
    const rr = await guardedFetch(fetchImpl, response_url, { headers: auth, signal }, 'fal');
    const rj = await readJson(rr);
    if (!rr.ok) throw friendlyError('fal', rr.status, rj);
    return rj;
  } finally { signal?.removeEventListener('abort', onAbort); }
}

export function parseFalImages(j) {
  if (Array.isArray(j?.images)) return j.images.map(i => ({ url: i.url, width: i.width, height: i.height, contentType: i.content_type }));
  if (j?.image?.url) return [{ url: j.image.url, width: j.image.width, height: j.image.height, contentType: j.image.content_type }];
  return [];
}

export async function runGemini({ body, key, onStatus = () => {}, signal, fetchImpl = fetch }) {
  if (!key) throw new ProviderError('No Gemini API key yet.', { hint: `Add it in Settings → Gemini key (${PROVIDERS.gemini.signup}).` });
  onStatus({ phase: 'running' });
  const res = await guardedFetch(fetchImpl, 'https://generativelanguage.googleapis.com/v1beta/interactions', { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }, 'gemini');
  const j = await readJson(res);
  if (!res.ok) throw friendlyError('gemini', res.status, j);
  const imgs = parseGeminiImages(j);
  if (!imgs.length) {
    const text = geminiText(j);
    throw new ProviderError('Gemini returned no image.', { hint: text ? `Model said: “${text.slice(0, 220)}”` : 'Possibly blocked by safety filters — try rephrasing.', raw: JSON.stringify(j).slice(0, 400) });
  }
  return imgs;
}

export function parseGeminiImages(j) {
  const out = [];
  for (const step of j?.steps || []) if (step.type === 'model_output') for (const b of step.content || []) if (b.type === 'image' && b.data) out.push({ dataUrl: `data:${b.mime_type || 'image/png'};base64,${b.data}` });
  for (const b of j?.outputs || []) if (b.type === 'image' && b.data) out.push({ dataUrl: `data:${b.mime_type || 'image/png'};base64,${b.data}` });
  for (const cand of j?.candidates || []) for (const p of cand.content?.parts || []) { const d = p.inlineData || p.inline_data; if (d?.data) out.push({ dataUrl: `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}` }); }
  return out;
}
function geminiText(j) {
  const t = [];
  for (const step of j?.steps || []) for (const b of step.content || []) if (b.type === 'text') t.push(b.text);
  for (const cand of j?.candidates || []) for (const p of cand.content?.parts || []) if (p.text) t.push(p.text);
  return t.join(' ').trim();
}
