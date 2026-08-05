import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const source = await readFile('index.html', 'utf8');
const profiles = {
  basic: { channel: 'crazygames-basic', adsMode: 'disabled', useCrazyGamesData: true },
  full: { channel: 'crazygames-full', adsMode: 'auto', useCrazyGamesData: true },
  standalone: { channel: 'standalone', adsMode: 'disabled', useCrazyGamesData: false },
};

for (const [mode, profile] of Object.entries(profiles)) {
  const dir = `dist/${mode}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  let html = source.replace(/window\.__RR_BUILD__=\{[^;]+\};/, `window.__RR_BUILD__=${JSON.stringify(profile)};`);
  if (mode === 'standalone') {
    html = html.replace(/\s*<script src="https:\/\/sdk\.crazygames\.com\/crazygames-sdk-v3\.js"><\/script>/, '');
  }
  await writeFile(`${dir}/index.html`, html);
  await writeFile(`${dir}/build.json`, JSON.stringify({ mode, profile }, null, 2));
}

console.log('Built CrazyGames Basic, Full, and Standalone releases.');
