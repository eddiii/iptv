const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function probeStream(url, opts = {}) {
  const {
    timeoutMs = 8000,
    userAgent = DEFAULT_UA,
    referrer = '',
  } = opts;

  if (!url) return { alive: false, reason: 'no-url' };
  if (url.startsWith('rtmp://') || url.startsWith('rtsp://')) {
    return { alive: false, reason: 'unsupported-protocol' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { 'User-Agent': userAgent };
    if (referrer) headers['Referer'] = referrer;

    const res = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      try { await res.body?.cancel?.(); } catch {}
      return { alive: false, reason: 'http-' + res.status, finalUrl: res.url };
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const looksHls = url.includes('.m3u8') || ct.includes('mpegurl');

    if (looksHls) {
      const reader = res.body.getReader();
      const { value } = await reader.read();
      try { await reader.cancel(); } catch {}
      const head = new TextDecoder().decode(value || new Uint8Array());
      if (!head.includes('#EXTM3U')) {
        return { alive: false, reason: 'no-extm3u', finalUrl: res.url };
      }
    } else {
      try { await res.body?.cancel?.(); } catch {}
    }

    return { alive: true, finalUrl: res.url };
  } catch (e) {
    return {
      alive: false,
      reason: e.name === 'AbortError' ? 'timeout' : (e.cause?.code || e.message || 'error'),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeAll(items, opts = {}) {
  const { concurrency = 10, onProgress, probeOpts } = opts;
  const results = new Array(items.length);
  let nextIdx = 0;
  let done = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      const item = items[idx];
      const r = await probeStream(item.url, probeOpts);
      results[idx] = { ...item, ...r };
      done++;
      onProgress?.(done, items.length, results[idx]);
    }
  });

  await Promise.all(workers);
  return results;
}
