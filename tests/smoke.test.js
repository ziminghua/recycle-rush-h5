import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('ships as a self-contained playable page', () => {
  assert.ok(html.length > 100_000);
  assert.match(html, /Recycle Rush/);
  assert.match(html, /factory_boost/);
  assert.match(html, /calculateOfflineReward/);
  assert.match(html, /certifyCurrentFactory/);
  assert.match(html, /data:image\/svg\+xml;base64/);
  assert.doesNotMatch(html, /src="\.\/src\/main\.js"/);
});
