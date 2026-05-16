# IPTV (edtv) Infrastructure

_Last audited: 2026-05-16_

## Hosting

- **Platform:** GitHub (raw file + jsDelivr CDN) — not a deployed app
- **Production URL:** https://cdn.jsdelivr.net/gh/eddiii/iptv/edtv.m3u (CDN) · https://raw.githubusercontent.com/eddiii/iptv/main/edtv.m3u (origin)
- **Project ID:** n/a — repo is `github.com/eddiii/iptv`
- **Auto-deploy:** any `git push` to `main` updates the file at both URLs (jsDelivr caches and refreshes)
- **Preview URLs:** none
- **Scheduled refresh:** `.github/workflows/refresh-weekly.yml` — Sunday 04:00 UTC, runs `npm run refresh` + `node build-curated.js`, commits if anything changed

## Backend

- **Database:** none
- **Auth:** none
- **Storage:** none (output `edtv.m3u` is committed back to the repo)
- **Email / SMTP:** none
- **Third-party APIs:** upstream M3U source feeds (fetched by `src/cli.js` to rebuild the curated playlist)

## Domain

- **Primary:** none — consumed via jsDelivr / raw.githubusercontent.com URLs
- **Subdomains:** n/a
- **DNS registrar:** n/a
- **SSL:** automatic (jsDelivr / GitHub)
- **Email routing:** n/a

## Build

- **Framework:** plain Node (no bundler)
- **Build command:** `npm run refresh` (rebuilds `edtv.m3u` from `onstv.m3u` with overrides/filters)
- **Output directory:** repo root (`edtv.m3u` committed)
- **Node version:** `>=18` (per `engines` in package.json)
- **Install command:** `npm install`

## Deploy

- **How to deploy:**
  - `npm run refresh` locally → regenerates `edtv.m3u`
  - `git add edtv.m3u && git commit && git push` → jsDelivr serves the new file (cache TTL up to ~12h, or purge via jsdelivr URL)
- **Rollback:** `git revert` the offending commit and push
- **Required before deploy:** `npm run check` (validation only — no automated tests)

## Environment

No env vars. No `.env.example`.

## Monitoring & alerts

- **Error tracking:** none
- **Analytics:** none (jsDelivr exposes per-package stats publicly)
- **Uptime:** none configured (jsDelivr + GitHub uptime is depended on)
- **Logs:** none

## Known issues / TODOs

- This is a script + curated data file, not an app — no deployed UI
- Source M3U feeds can break upstream; `curated-status.json` tracks last check result
- `build-curated.js` reads from `onstv.m3u` (the static checked-in source), not `onstv.fixed.m3u`. The weekly cron probes streams and updates `.fixed.m3u`, but `edtv.m3u` only changes when `onstv.m3u` itself is edited or when URL overrides in `build-curated.js` change. To make the cron also keep `edtv.m3u` fresh, point `build-curated.js` at `onstv.fixed.m3u` instead.
