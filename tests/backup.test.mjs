import test from 'node:test';
import assert from 'node:assert/strict';
import { makeZip, readZip, crc32, stylesCsv } from '../js/backup.js';

test('crc32 known value', () => { assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926); });

test('zip round trip', async () => {
  const files = [{ name: 'library.json', data: new TextEncoder().encode('{"app":"avata"}') }, { name: 'images/a.webp', data: new Uint8Array([1, 2, 3, 250]) }];
  const z = makeZip(files);
  const m = await readZip(z);
  assert.equal(new TextDecoder().decode(m.get('library.json')), '{"app":"avata"}');
  assert.deepEqual([...m.get('images/a.webp')], [1, 2, 3, 250]);
});

test('zip readable by system unzip', async t => {
  const { execSync } = await import('node:child_process'); const fs = await import('node:fs');
  try { execSync('which unzip', { stdio: 'ignore' }); } catch { t.skip('no unzip'); return; }
  const z = makeZip([{ name: 'hello.txt', data: new TextEncoder().encode('hi there') }]);
  fs.writeFileSync('/tmp/avata-test.zip', Buffer.from(await z.arrayBuffer()));
  assert.match(execSync('unzip -p /tmp/avata-test.zip hello.txt').toString(), /hi there/);
  assert.match(execSync('unzip -t /tmp/avata-test.zip').toString(), /No errors/);
});

test('csv escaping + formula guard', () => {
  const csv = stylesCsv([{ id: 's', sku: 'AV-1', name: 'Dress, "silk"', colorways: ['Ivory', 'Black'], sizes: ['S'], notes: '=HYPERLINK("x")', cost: 12.5, tags: [] }], [{ styleIds: ['s'] }]);
  const line = csv.split('\r\n')[1];
  assert.match(line, /^AV-1,"Dress, ""silk"""/);
  assert.match(line, /"Ivory; Black"/);
  assert.match(line, /"'=HYPERLINK\(""x""\)"/);
  assert.match(line, /,12\.5,/);
  assert.match(line, /,1,/); // mockup count
});
