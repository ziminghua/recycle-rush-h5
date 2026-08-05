import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const names = ['game-00.txt', 'game-01.txt', 'game-02.txt', 'game-03.txt'];
const encoded = (await Promise.all(names.map((name) => readFile(new URL(`../payload/${name}`, import.meta.url), 'utf8')))).join('');
const html = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');

test('payload reconstructs the complete playable game', () => {
  assert.ok(html.length > 100_000);
  assert.match(html, /Recycle Rush/);
  assert.match(html, /factory_boost/);
  assert.match(html, /calculateOfflineReward/);
  assert.match(html, /certifyCurrentFactory/);
  assert.match(html, /data:image\/svg\+xml;base64/);
  assert.doesNotMatch(html, /src="\.\/src\/main\.js"/);
});
