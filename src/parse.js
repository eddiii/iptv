import { readFile, writeFile } from 'node:fs/promises';

export async function parseM3u(path) {
  const text = await readFile(path, 'utf8');
  const lines = text.split(/\r?\n/);
  const header = lines[0]?.startsWith('#EXTM3U') ? lines[0] : '#EXTM3U';
  const channels = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('#EXTINF:')) continue;

    const extras = [];
    let url = '';
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      const t = next.trim();
      if (!t) continue;
      if (t.startsWith('#')) { extras.push(next); continue; }
      url = t;
      break;
    }

    channels.push({
      extinf: line,
      extras,
      url,
      tvgId: attr(line, 'tvg-id'),
      tvgName: attr(line, 'tvg-name'),
      group: attr(line, 'group-title'),
      name: line.split(',').slice(1).join(',').trim(),
    });
  }
  return { header, channels };
}

function attr(extinf, name) {
  const m = extinf.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : '';
}

export async function writeM3u(path, header, channels) {
  const out = [header];
  for (const ch of channels) {
    out.push(ch.extinf);
    for (const e of ch.extras || []) out.push(e);
    out.push(ch.url);
  }
  await writeFile(path, out.join('\n') + '\n');
}
