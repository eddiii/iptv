#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseM3u, writeM3u } from './parse.js';
import { probeAll, probeStream } from './probe.js';
import { loadStreamsIndex, pickReplacements } from './iptv-org.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const argVal = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

const SRC = argVal('--src') || 'onstv.m3u';
const DST = argVal('--out') || 'onstv.fixed.m3u';
const STATUS = argVal('--status') || 'status.json';
const checkOnly = flag('--check-only');
const forceRefresh = flag('--refresh');
const limit = parseInt(argVal('--limit') || '0', 10);
const groupFilter = argVal('--group');

(async () => {
  console.log('Reading ' + SRC);
  const { header, channels: all } = await parseM3u(SRC);
  let channels = all;
  if (groupFilter) channels = channels.filter(c => c.group === groupFilter);
  if (limit > 0) channels = channels.slice(0, limit);
  console.log('Channels: ' + channels.length + (channels.length !== all.length ? ' (filtered from ' + all.length + ')' : ''));

  console.log('Probing (concurrency 10)...');
  const probed = await probeAll(
    channels.map((ch, i) => ({ i, url: ch.url, name: ch.name, group: ch.group })),
    {
      onProgress: (d, t, r) => {
        const tag = r.alive ? 'OK' : 'FAIL(' + r.reason + ')';
        process.stdout.write('\r  ' + d + '/' + t + '  ' + tag.padEnd(20) + '  ' + r.name.slice(0, 40).padEnd(40));
      },
    }
  );
  process.stdout.write('\n');

  const dead = probed.filter(p => !p.alive);
  console.log('Alive: ' + (probed.length - dead.length) + '   Dead: ' + dead.length);

  let fixed = 0, stillBroken = 0, noMatch = 0;
  const fixLog = [];

  if (!checkOnly && dead.length > 0) {
    console.log('Loading iptv-org streams index...');
    const index = await loadStreamsIndex({ forceRefresh });
    console.log('Index has ' + index.size + ' channels');

    console.log('Looking up replacements for ' + dead.length + ' dead streams...');
    let n = 0;
    for (const d of dead) {
      n++;
      const ch = channels[d.i];
      const candidates = pickReplacements(index, ch.tvgId);
      process.stdout.write('\r  ' + n + '/' + dead.length + '  ' + (ch.name || ch.tvgId).slice(0, 50).padEnd(50));

      if (candidates.length === 0) {
        noMatch++;
        fixLog.push({ name: ch.name, tvgId: ch.tvgId, status: 'no-iptv-org-match', oldUrl: ch.url });
        continue;
      }

      let applied = false;
      for (const cand of candidates) {
        const r = await probeStream(cand.url, { referrer: cand.referrer, userAgent: cand.userAgent || undefined });
        if (r.alive) {
          ch.url = cand.url;
          probed[d.i].alive = true;
          probed[d.i].fixed = true;
          probed[d.i].newUrl = cand.url;
          fixed++;
          applied = true;
          fixLog.push({ name: ch.name, tvgId: ch.tvgId, status: 'fixed', oldUrl: d.url, newUrl: cand.url });
          break;
        }
      }
      if (!applied) {
        stillBroken++;
        fixLog.push({ name: ch.name, tvgId: ch.tvgId, status: 'all-candidates-dead', oldUrl: ch.url, candidates: candidates.map(c => c.url) });
      }
    }
    process.stdout.write('\n');
    console.log('Fixed: ' + fixed + '   No match in iptv-org: ' + noMatch + '   All candidates dead: ' + stillBroken);
  }

  const status = channels.map((ch, i) => ({
    name: ch.name,
    tvgId: ch.tvgId,
    group: ch.group,
    url: ch.url,
    alive: !!probed[i].alive,
    fixed: !!probed[i].fixed,
    reason: probed[i].reason || null,
    finalUrl: probed[i].finalUrl || null,
  }));

  await writeFile(STATUS, JSON.stringify({ generatedAt: new Date().toISOString(), channels: status, fixLog }, null, 2));
  console.log('Wrote ' + STATUS);

  if (!checkOnly) {
    if (groupFilter || limit > 0) {
      // Don't overwrite the full m3u with a partial run
      const partialDst = DST.replace(/\.m3u$/, '.partial.m3u');
      await writeM3u(partialDst, header, channels);
      console.log('Wrote ' + partialDst + ' (partial run — full file not touched)');
    } else {
      await writeM3u(DST, header, channels);
      console.log('Wrote ' + DST);
    }
  }

  console.log('\nReport:');
  const byStatus = (k) => status.filter(s => k(s));
  console.log('  alive (no change): ' + byStatus(s => s.alive && !s.fixed).length);
  console.log('  fixed via iptv-org: ' + byStatus(s => s.fixed).length);
  console.log('  still broken: ' + byStatus(s => !s.alive).length);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
