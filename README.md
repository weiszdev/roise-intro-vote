# Roise intro vote
Cloudflare Pages (advanced mode `_worker.js`) + D1 (binding `DB`, schema in schema.sql).
- `site/index.html` - the vote page
- `worker/worker_tpl.js` - worker source; `__HTML__` = index.html as a JS string, `__AUDIO__` = {filename: base64 mp3}
- Endpoints: `POST /api/vote`, `GET /api/results`, `GET /results`
- Secrets (Pages env): `RESULTS_KEY` (private results link), `IP_SALT`
