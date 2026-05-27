---
hub:
  id: iptv
  name: IPTV
  tag: media
  color: '#4a6fa5'
  devCmd: node build-curated.js
---

# IPTV

Personal IPTV channel curator. Reads `.m3u` source files, filters by a curated allow-list, and writes a cleaned `edtv.m3u` for use in IPTV players.

## Stack

- Plain Node.js (no framework, no build step)
- Single entry: `build-curated.js`

## Run

```bash
node build-curated.js
```

## Audience

Personal use only. Not deployed publicly — stream URLs in source contain third-party session tokens.
