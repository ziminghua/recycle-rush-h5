import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const loader = await readFile('index.html', 'utf8');
const payloadNames = Array.from({ length: 20 }, (_, index) => `part-${String(index).padStart(2, '0')}.txt`);
const encoded = (await Promise.all(payloadNames.map((name) => readFile(`payload/${name}`, 'utf8')))).join('');
const source = Buffer.from(encoded, 'base64').toString('utf8');
const profiles = {
  basic: { channel: 'crazygames-basic', adsMode: 'disabled', useCrazyGamesData: true },
  full: { channel: 'crazygames-full', adsMode: 'auto', useCrazyGamesData: true },
  standalone: { channel: 'standalone', adsMode: 'disabled', useCrazyGamesData: false },
};

for (const [mode, profile] of Object.entries(profiles)) {
  const dir = `dist/${mode}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(`${dir}/payload`, { recursive: true });
  let html = source.replace(/window\.__RR_BUILD__=\{[^;]+\};/, `window.__RR_BUILD__=${JSON.stringify(profile)};`);
  if (mode === 'standalone') {
    html = html.replace(/\s*<script src="https:\/\/sdk\.crazygames\.com\/crazygames-sdk-v3\.js"><\/script>/, '');
  }
  const outputEncoded = Buffer.from(html, 'utf8').toString('base64');
  const chunkSize = Math.ceil(outputEncoded.length / payloadNames.length);
  for (let index = 0; index < payloadNames.length; index += 1) {
    await writeFile(`${dir}/payload/${payloadNames[index]}`, outputEncoded.slice(index * chunkSize, (index + 1) * chunkSize));
  }
  await writeFile(`${dir}/index.html`, loader);
  await writeFile(`${dir}/build.json`, JSON.stringify({ mode, profile }, null, 2));
}

console.log('Built CrazyGames Basic, Full, and Standalone releases.');
