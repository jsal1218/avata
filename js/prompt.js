// Avata prompt engine. Pure functions (no DOM) so it can be unit-tested in Node.

export const FABRICS = {
  auto: { label: 'Match photo', text: '' },
  cotton: { label: 'Cotton', text: 'matte cotton with a soft dry hand, visible fine weave, natural creasing at elbows and waist, slightly crisp folds' },
  denim: { label: 'Denim', text: 'rigid indigo-dyed denim twill with visible diagonal weave, contrast topstitching, rivets, slight fading on high points, structured folds and stacking at the hem' },
  silk: { label: 'Silk', text: 'fluid silk charmeuse that drapes close to the body, liquid folds, soft specular highlights that roll across the surface, delicate rippling where it moves' },
  satin: { label: 'Satin', text: 'high-sheen satin with crisp bright highlights and deep shadow bands in the folds, smooth reflective surface, subtle pull lines at stress points' },
  leather: { label: 'Leather', text: 'genuine leather with fine grain texture, semi-matte sheen, thick stiff creases at the joints, clean edge finishing and visible stitching' },
  knit: { label: 'Knit', text: 'knitted yarn with visible stitch structure and ribbing, soft stretch that hugs the body, gentle fuzz on the surface, relaxed rolling folds' },
  linen: { label: 'Linen', text: 'breathable linen with slub texture and irregular weave, natural rumpled wrinkles, matte finish, airy loose drape' },
  chiffon: { label: 'Sheer chiffon', text: 'sheer lightweight chiffon, semi-transparent layered fabric with soft diffused edges, floaty movement, delicate gathers and fine rolled hems' },
  wool: { label: 'Wool / tailoring', text: 'fine wool suiting with a dense matte surface, sharp pressed creases, structured shoulders and clean tailored lines' },
  velvet: { label: 'Velvet', text: 'plush velvet pile that shifts tone with the light, rich deep shadows, soft rounded folds' },
  jersey: { label: 'Jersey', text: 'stretch cotton jersey that clings softly, smooth surface, gentle horizontal tension wrinkles where it stretches' },
  sequin: { label: 'Sequin', text: 'densely sequined fabric with individual sequins catching the light as tiny sharp highlights, heavy drape' },
  lace: { label: 'Lace', text: 'intricate lace with a clearly defined floral pattern, scalloped edges and skin subtly visible through the openwork' },
  nylon: { label: 'Nylon / technical', text: 'smooth technical nylon with a slight sheen, crisp puffy volume, welded seams and taut panels' },
};

export const FITS = {
  auto: { label: 'As designed', text: '' },
  fitted: { label: 'Fitted', text: 'fitted, following the body closely without straining' },
  bodycon: { label: 'Bodycon', text: 'body-hugging second-skin fit with realistic stretch tension' },
  regular: { label: 'Regular', text: 'regular fit with a little ease through the body' },
  relaxed: { label: 'Relaxed', text: 'relaxed fit with soft volume and natural drape away from the body' },
  oversized: { label: 'Oversized', text: 'intentionally oversized silhouette: dropped shoulders, extra length and generous volume' },
  tailored: { label: 'Tailored', text: 'sharply tailored with clean structured lines' },
  cropped: { label: 'Cropped', text: 'cropped length that shows the midriff or ankle as designed' },
};

export const FOOTWEAR = {
  barefoot: 'barefoot, natural feet',
  sneakers: 'clean minimal white leather sneakers',
  heels: 'pointed-toe stiletto pumps',
  sandals: 'strappy heeled sandals',
  boots: 'knee-high leather boots',
  ankle: 'sleek ankle boots',
  loafers: 'polished leather loafers',
  flats: 'ballet flats',
  match: 'footwear that best complements the outfit',
};

export const LIGHTING = {
  studio: { label: 'White seamless', text: 'shot in a professional photo studio on a seamless pure white background (#FFFFFF), large overhead softbox key plus fill, soft natural contact shadow under the feet, even exposure, no colour cast' },
  ecom: { label: 'Softbox e-commerce', text: 'clean e-commerce catalogue lighting: two large softboxes at 45 degrees, light grey seamless backdrop, crisp true-to-life colours, gentle shadows, garment detail clearly readable' },
  golden: { label: 'Golden hour', text: 'outdoors at golden hour, warm low sun as a rim light from behind, soft bounce fill on the face, gentle lens bloom, natural urban street background softly out of focus' },
  editorial: { label: 'Editorial', text: 'high-fashion editorial lighting: hard beauty-dish key with sculpted shadows, subtle grain, tasteful dramatic contrast, neutral warm-grey paper backdrop, Vogue-style art direction' },
  overcast: { label: 'Overcast daylight', text: 'soft overcast daylight outdoors, diffuse shadowless light, true colour rendition, minimal architectural background' },
  flash: { label: 'Direct flash', text: 'on-camera direct flash street-style look, crisp specular highlights, slightly darker background falloff, candid fashion-week energy' },
};

export const CAMERAS = {
  ecom85: { label: '85mm catalogue', text: 'full-frame camera, 85mm lens at f/8, eye-level, no distortion, tack-sharp from head to toe' },
  portrait105: { label: '105mm tele', text: 'full-frame camera, 105mm telephoto lens at f/5.6, compressed flattering perspective, sharp subject with smooth falloff' },
  editorial50: { label: '50mm editorial', text: 'full-frame camera, 50mm lens at f/4, natural perspective, slight depth of field' },
  medium: { label: 'Medium format', text: 'medium-format digital camera (Hasselblad-style), 80mm lens at f/8, extremely fine detail, smooth tonal gradation' },
  film: { label: '35mm film', text: '35mm film camera, Kodak Portra 400 colour rendition, fine natural grain, gentle highlight roll-off' },
};

export const VIEWS = {
  front: { label: 'Front', aspect: '3:4', text: 'Full-body FRONT view, head to toe, model facing the camera, standing in the same neutral relaxed pose as the reference (arms resting by the sides), entire body including both feet fully in frame with a little margin above the head and below the feet, centred.' },
  back: { label: 'Back', aspect: '3:4', text: 'Full-body BACK view, head to toe, model facing directly away from the camera, same neutral standing pose, back of the hair matching the back-view reference exactly, entire body including both feet in frame, centred. Show how the garments look from behind (back seams, closures, back pockets, straps).' },
  three: { label: '3/4', aspect: '3:4', text: 'Full-body THREE-QUARTER view, head to toe, model rotated about 45 degrees to her left with face turned slightly toward the camera, natural relaxed stance with weight on one leg, entire body including both feet in frame.' },
  sheet: { label: 'Front + back sheet', aspect: '1:1', text: 'A single square reference sheet on a pure white seamless background showing the SAME model twice side by side at identical scale and vertical alignment: FRONT view on the left half, BACK view on the right half, both full body head to toe in the same neutral standing pose, exactly matching the layout and framing of the provided reference sheet.' },
};

export const REALISM = {
  skin: {
    label: 'Natural skin',
    levels: [
      '',
      'Natural, realistic skin with visible pores and fine texture, subtle natural variation in tone; avoid airbrushing.',
      'Hyper-real natural skin: visible pores, fine vellus hair, subtle natural imperfections (tiny moles, faint freckles, slight redness around the nose and knuckles, natural creases at joints), realistic subsurface scattering and natural specular sheen on high points. Absolutely no plastic, waxy, airbrushed, over-smoothed or beauty-filtered skin, no CGI look.',
    ],
  },
  fabric: {
    label: 'Fabric physics',
    levels: [
      '',
      'Realistic fabric drape and folds that respond to gravity and the body underneath.',
      'True-to-life fabric physics: correct weight and drape for the material, gravity-driven folds, tension and pull lines where fabric stretches over the bust, hips and seat, compression wrinkles at the waist and joints, visible seams, stitching, hems, darts and closures, accurate material sheen and thickness, garment edges casting tiny realistic shadows on the skin.',
    ],
  },
  anatomy: {
    label: 'Anatomy',
    levels: [
      '',
      'Anatomically correct body, hands and feet.',
      'Anatomically correct: each hand has five naturally proportioned fingers with real knuckles and nails, relaxed natural hand pose; each foot has five toes with natural arches; correct joint articulation, realistic weight distribution and balance, natural neck and shoulder line, no extra or fused limbs or digits.',
    ],
  },
};

export function cmToFtIn(cm) {
  const inches = cm / 2.54; let ft = Math.floor(inches / 12); let inch = Math.round(inches - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return { ft, inch };
}
export function ftInToCm(ft, inch) { return Math.round((Number(ft) * 12 + Number(inch || 0)) * 2.54); }
export function formatHeight(cm) {
  if (!cm) return '';
  const { ft, inch } = cmToFtIn(cm);
  return `${ft}′${inch}″ · ${Math.round(cm)} cm`;
}
export function frameWord(cm) {
  if (!cm) return '';
  if (cm < 163) return 'petite';
  if (cm < 172) return 'average-height';
  return 'tall';
}

const MEAS_LABELS = { bust: 'bust', waist: 'waist', hips: 'hips', inseam: 'inseam' };
export function measurementsText(m = {}, unit = 'in') {
  const parts = Object.keys(MEAS_LABELS).filter(k => Number(m[k]) > 0).map(k => {
    const v = Number(m[k]);
    const cm = unit === 'cm' ? v : v * 2.54; const inch = unit === 'cm' ? v / 2.54 : v;
    return `${MEAS_LABELS[k]} ${Math.round(inch * 10) / 10} in (${Math.round(cm)} cm)`;
  });
  return parts.length ? parts.join(', ') : '';
}

export function bodySpecText(model = {}) {
  const out = [];
  if (model.heightCm) {
    const { ft, inch } = cmToFtIn(model.heightCm);
    const frame = frameWord(model.heightCm);
    out.push(`Height: the model is ${ft} ft ${inch} in / ${Math.round(model.heightCm)} cm tall. Keep her exact height and body proportions (leg length, torso length, head-to-body ratio) from the reference. Garment lengths, hems, inseams, rises and sleeve lengths must fall exactly where they would on a ${Math.round(model.heightCm)} cm ${frame} frame — e.g. a maxi or full-length garment sits lower and may pool slightly, a midi falls lower on the calf, and sleeves and trouser legs may read slightly long, as they really would on her.`);
  }
  if (model.bodyType || model.size) out.push(`Body type: ${[model.bodyType, model.size ? `wears US size ${model.size}` : ''].filter(Boolean).join(', ')}. Garments should fit as that size realistically fits this body.`);
  const mt = measurementsText(model.measurements, model.measureUnit);
  if (mt) out.push(`Body measurements: ${mt}. Keep this exact figure; garments must fit these measurements realistically (correct ease, tension and pull at bust, waist and hips) without reshaping, slimming or enhancing her body.`);
  return out.join(' ');
}

/**
 * Build the generation prompt.
 * refs: describes the order of images passed to the model, e.g.
 *   [{role:'front'},{role:'back'},{role:'garment', note:'flat lay'}] or [{role:'sheet'}, ...]
 */
export function buildPrompt(o) {
  const {
    model = {}, refs = [], view = 'front', outfitText = '', fabric = 'auto', fit = 'auto', color = '',
    footwear = 'barefoot', footwearText = '', accessories = [], accessoriesText = '', keepJewelry = false,
    lighting = 'studio', camera = 'ecom85', realism = { skin: 2, fabric: 2, anatomy: 2 }, extra = '',
  } = o;
  const L = [];
  const idx = role => refs.map((r, i) => (r.role === role ? i + 1 : 0)).filter(Boolean);
  const front = idx('front'), back = idx('back'), sheet = idx('sheet'), garments = idx('garment');
  const list = n => n.length === 1 ? `image ${n[0]}` : `images ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;

  // 1) Input map so multi-reference models know what each image is.
  const map = [];
  if (sheet.length) map.push(`${list(sheet)} is the model's identity reference sheet (front view on the left, back view on the right)`);
  if (front.length) map.push(`${list(front)} is the model's identity reference, front view`);
  if (back.length) map.push(`${list(back)} is the same model, back view`);
  if (garments.length) map.push(`${list(garments)} ${garments.length > 1 ? 'are' : 'is'} the garment reference${garments.length > 1 ? 's' : ''} to dress her in (product, flat-lay or on-hanger photos; use only the clothing, ignore any background, hanger, mannequin or other person)`);
  if (map.length) L.push(`Reference images: ${map.join('; ')}.`);

  // 2) Task + identity lock.
  L.push('Create a single photorealistic fashion photograph of EXACTLY the same woman shown in the identity reference, now wearing the new outfit described below.');
  L.push('Identity lock: preserve her face and facial features, eye colour, eyebrows, lips, hairstyle, hair colour, hair length and texture, skin tone and undertone, body shape, curves and proportions, height ratio, hands and feet exactly as in the reference. Do not slim, reshape, beautify, de-age or change her ethnicity or body type. She must be instantly recognisable as the same person.');
  const body = bodySpecText(model);
  if (body) L.push(body);
  L.push(`Wardrobe: completely replace the plain grey crop tank top and grey shorts from the reference with the new outfit — no trace of the grey reference clothing may remain.${keepJewelry ? ' Keep any jewellery she wears in the reference.' : ' Remove any jewellery or bracelets from the reference unless the outfit calls for them.'}`);

  // 3) Outfit.
  const outfit = [];
  if (garments.length) outfit.push(`Dress her in the garments from ${list(garments)}, reproducing them faithfully: exact colour and shade, print and pattern scale, logos and graphics in the same position, neckline, collar, sleeve style, hem length, closures, buttons, zips, hardware, pockets and trims.`);
  if (outfitText.trim()) outfit.push(`Outfit: ${outfitText.trim().replace(/\.?$/, '.')}`);
  if (color.trim()) outfit.push(`Colour: ${color.trim()}.`);
  if (FABRICS[fabric]?.text) outfit.push(`Material: ${FABRICS[fabric].text}.`);
  if (FITS[fit]?.text) outfit.push(`Fit: ${FITS[fit].text}.`);
  const foot = footwear === 'custom' ? footwearText.trim() : FOOTWEAR[footwear];
  if (foot) outfit.push(`Footwear: ${foot}.`);
  const acc = [...accessories, accessoriesText.trim()].filter(Boolean);
  if (acc.length) outfit.push(`Accessories: ${acc.join(', ')}.`);
  if (!outfit.length) outfit.push('Outfit: a modern, well-styled everyday outfit.');
  L.push(outfit.join(' '));

  // 4) View / framing.
  L.push(`Framing: ${VIEWS[view]?.text || VIEWS.front.text}`);

  // 5) Photography.
  L.push(`Lighting & set: ${(LIGHTING[lighting] || LIGHTING.studio).text}.`);
  L.push(`Camera: ${(CAMERAS[camera] || CAMERAS.ecom85).text}.`);

  // 6) Realism.
  const r = [];
  for (const k of ['skin', 'fabric', 'anatomy']) { const t = REALISM[k].levels[realism?.[k] ?? 2]; if (t) r.push(t); }
  if (r.length) L.push(`Realism: ${r.join(' ')}`);
  if (extra.trim()) L.push(`Additional direction: ${extra.trim()}`);
  L.push('Avoid: plastic or CGI skin, cartoon or illustration style, distorted or extra fingers and toes, warped garment patterns, melted logos, garbled text, mismatched face, changed body shape, cropped feet or head, watermarks, text overlays.');
  return L.join('\n\n');
}
