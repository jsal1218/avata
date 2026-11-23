import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEASURES, STORAGE_KEY, defaultState, normalizeState, saveState, loadState,
  toExportJson, fromImportJson, warnValue, splitHeight, joinHeight,
  emptyProfile, activeProfile, profileSummary,
} from '../js/measure.js';

test('the form covers every requested body measurement', () => {
  const ids = MEASURES.map(m => m.id);
  assert.deepEqual(ids, [
    'height', 'weight', 'neck', 'shoulder', 'chest', 'waist', 'highHip', 'hip',
    'sleeve', 'arm', 'bicep', 'wrist', 'torso', 'back', 'frontRise', 'backRise',
    'inseam', 'outseam', 'thigh', 'knee', 'calf', 'ankle',
  ]);
  for (const m of MEASURES) {
    assert.ok(m.how && m.how.length > 40, m.id);
    assert.ok(['front', 'side', 'back'].includes(m.view), m.id);
  }
});

test('default state is a profile named Jordan', () => {
  const st = defaultState();
  assert.equal(st.profiles.length, 1);
  assert.equal(st.profiles[0].name, 'Jordan');
  assert.equal(activeProfile(st).name, 'Jordan');
  assert.equal(profileSummary(st).filled, 0);
});

test('height feet/inches convert to total inches and back', () => {
  assert.equal(joinHeight(5, 6), 66);
  assert.deepEqual(splitHeight(66), { ft: 5, inch: 6 });
  assert.equal(joinHeight('', ''), '');
  assert.equal(joinHeight(5, 0), 60);
});

test('gentle warnings for obviously wrong values; empty is fine', () => {
  assert.equal(warnValue('waist', ''), '');
  assert.equal(warnValue('waist', null), '');
  assert.match(warnValue('waist', 3), /low/);
  assert.match(warnValue('waist', 80), /high/);
  assert.equal(warnValue('waist', 30), '');
  assert.match(warnValue('height', 20), /low/);
  assert.match(warnValue('weight', 12), /low/);
  assert.match(warnValue('neck', 'nope'), /number/);
});

test('export / import JSON round trip, stored under the avata-measure key', () => {
  const mem = { getItem() { return this.v ?? null; }, setItem(_, v) { this.v = v; }, removeItem() { this.v = null; } };
  const st = defaultState();
  st.profiles[0].values = { height: 66, waist: 31, inseam: 28 };
  st.profiles[0].garments = [{ type: 'favorite jeans', waistWidth: 16, inseam: 28 }];
  saveState(st, mem);
  assert.ok(mem.v.includes('Jordan'));
  const loaded = loadState(mem);
  assert.equal(loaded.profiles[0].values.waist, 31);
  const json = toExportJson(loaded);
  const parsed = JSON.parse(json);
  assert.equal(parsed.app, 'avata-measure');
  assert.equal(parsed.format, 1);
  const back = fromImportJson(json);
  assert.equal(back.profiles[0].name, 'Jordan');
  assert.equal(back.profiles[0].values.height, 66);
  assert.equal(back.profiles[0].garments[0].type, 'favorite jeans');
});

test('import rejects unrelated JSON and caps garments at 3', () => {
  assert.throws(() => fromImportJson('{"app":"something-else","foo":1}'), /not a measurement profile/);
  const st = normalizeState({
    profiles: [{ name: 'Alex', garments: [{}, {}, {}, {}, {}] }],
  });
  assert.equal(st.profiles[0].name, 'Alex');
  assert.equal(st.profiles[0].garments.length, 3);
});

test('default profile name is used when a name is blank', () => {
  const p = emptyProfile('');
  // emptyProfile uses the argument as given; normalize restores Jordan
  const st = normalizeState({ profiles: [{ id: 'x', name: '   ', values: {} }] });
  assert.equal(st.profiles[0].name, 'Jordan');
  assert.equal(p.name, '');
});
