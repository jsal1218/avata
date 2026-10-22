import test from 'node:test';
import assert from 'node:assert/strict';
import { orderOutfits, outfitNames } from '../js/outfit-drag.js';
const O = ids => ids.map(id => ({ id, name: id }));
const ids = l => l.map(o => o.id);

test('no saved order = shipped order (Base first)', () => {
  assert.deepEqual(ids(orderOutfits(O(['base', 'a', 'b']), null)), ['base', 'a', 'b']);
  assert.deepEqual(ids(orderOutfits(O(['base', 'a', 'b']), [])), ['base', 'a', 'b']);
});
test('saved order wins; outfits added later go at the end in shipped order; removed ids and duplicates drop', () => {
  assert.deepEqual(ids(orderOutfits(O(['base', 'a', 'b', 'c']), ['c', 'base', 'a', 'b'])), ['c', 'base', 'a', 'b']);
  assert.deepEqual(ids(orderOutfits(O(['base', 'a', 'b', 'new1', 'new2']), ['b', 'base', 'a'])), ['b', 'base', 'a', 'new1', 'new2']);
  assert.deepEqual(ids(orderOutfits(O(['base', 'b']), ['b', 'gone', 'b', 'base', 'a'])), ['b', 'base']);
});
test('an outfit shipped without a name gets the next Outfit N after her highest; given names are kept', () => {
  const n = outfitNames([{ id: 'base', name: 'Base' }, { id: 'a', name: 'Outfit 1' }, { id: 'b', name: 'Outfit 12' }, { id: 'c', name: 'Red coat' }, { id: 'x' }, { id: 'y', name: ' ' }]);
  assert.deepEqual([...n.values()], ['Base', 'Outfit 1', 'Outfit 12', 'Red coat', 'Outfit 13', 'Outfit 14']);
  assert.equal(outfitNames([{ id: 'base' }]).get('base'), 'Base');
});
test('both copies of the drag code are the same', async () => {
  const { readFileSync } = await import('node:fs');
  const core = s => s.slice(s.indexOf('// Drag to reorder'), s.indexOf('\n}\n', s.indexOf('function sortableCards')));
  const a = readFileSync(new URL('../js/outfit-drag.js', import.meta.url), 'utf8'), g = '/workspace/model-gallery-site/js/outfit-drag.js';
  const { existsSync } = await import('node:fs'); if (!existsSync(g)) return;
  assert.equal(core(a), core(readFileSync(g, 'utf8')));
});
