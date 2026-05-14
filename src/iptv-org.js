import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

const STREAMS_URL = 'https://iptv-org.github.io/api/streams.json';
const ONE_DAY = 24 * 60 * 60 * 1000;

export async function loadStreamsIndex(opts = {}) {
  const { cachePath = '.cache/streams.json', forceRefresh = false } = opts;

  let needsFetch = forceRefresh;
  if (!needsFetch) {
    try {
      const s = await stat(cachePath);
      if (Date.now() - s.mtimeMs > ONE_DAY) needsFetch = true;
    } catch {
      needsFetch = true;
    }
  }

  if (needsFetch) {
    const res = await fetch(STREAMS_URL);
    if (!res.ok) throw new Error('iptv-org fetch failed: ' + res.status);
    const text = await res.text();
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, text);
  }

  const data = JSON.parse(await readFile(cachePath, 'utf8'));
  const byChannel = new Map();
  for (const s of data) {
    if (!s.channel) continue;
    if (!byChannel.has(s.channel)) byChannel.set(s.channel, []);
    byChannel.get(s.channel).push(s);
  }
  return byChannel;
}

export function pickReplacements(byChannel, tvgId) {
  if (!tvgId) return [];
  const list = byChannel.get(tvgId);
  if (!list || list.length === 0) return [];
  const https = list.filter(s => s.url?.startsWith('https://'));
  const ordered = https.length ? [...https, ...list.filter(s => !https.includes(s))] : list;
  return ordered.map(s => ({
    url: s.url,
    referrer: s.http_referrer || '',
    userAgent: s.user_agent || '',
  }));
}
