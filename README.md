# edtv

Personal IPTV playlist — curated free streams (News, Documentary, Music, Movies, Kids, Sports, German channels, Middle East and more) that work outside paywalls and major geo-fences.

## Use it

Paste this URL into any IPTV player (TiviMate, IPTV Smarters, VLC, Smart IPTV, OTT Navigator, …):

```
https://cdn.jsdelivr.net/gh/eddiii/iptv/edtv.m3u
```

Or the GitHub raw URL:

```
https://raw.githubusercontent.com/eddiii/iptv/main/edtv.m3u
```

## Files

| File | Purpose |
|---|---|
| `edtv.m3u` | The curated playlist — this is the one you link to |
| `onstv.m3u` | Original untouched source playlist (kept for reference) |
| `build-curated.js` | Rebuilds `edtv.m3u` from `onstv.m3u` with overrides + filters |
| `src/cli.js` | Probes streams and auto-fixes dead URLs via the iptv-org public index |

## Regenerate `edtv.m3u`

```bash
node build-curated.js
```

The script applies:
- `URL_OVERRIDES` — replaces dead/YouTube URLs with direct HLS streams (Kan 11, Makan 33, Channel 14, France 24 Arabic, Euronews Deutsch, …)
- `EXCLUDE_TVG_ID` — drops channels not in English / Arabic / Hebrew / German
- Group reshuffling — moves news-only channels into the `News` group, splits documentaries, etc.
- Strips the Ⓨ "YouTube" marker from channel names

## Probe what's working

```bash
node src/cli.js --src edtv.m3u --check-only --status status.json
```

Writes `status.json` with per-channel alive/dead state. Useful before pushing updates.

## Notes

- Geo matters: streams marked dead from one IP may work from another. Results are location-specific.
- Re-run `node build-curated.js` after editing `onstv.m3u` or the overrides.
- All stream URLs are public — this playlist redistributes nothing it doesn't have the right to.
