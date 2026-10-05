// Tiny dependency-free server: serves /public and proxies /api/* so the API key stays on the server.
const http = require('http'), fs = require('fs'), path = require('path');
try {
  for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}
const { API_KEY, API_BASE_URL, API_KEY_HEADER = 'x-api-key', PORT = 3000 } = process.env;
const BASE = (API_BASE_URL || 'https://api.coingecko.com/api/v3').replace(/\/$/, '');
const headers = { accept: 'application/json' };
if (API_BASE_URL && API_KEY) headers[API_KEY_HEADER] = API_KEY;

const e = encodeURIComponent, cache = new Map();
const routes = {
  '/api/markets': q => `/coins/markets?vs_currency=${e(q.get('cur') || 'usd')}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=1h,24h,7d`,
  '/api/chart': q => `/coins/${e(q.get('id') || 'bitcoin')}/market_chart?vs_currency=${e(q.get('cur') || 'usd')}&days=${e(q.get('days') || 7)}`,
  '/api/global': () => '/global'
};
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const send = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(b); };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (routes[u.pathname]) {
    const target = BASE + routes[u.pathname](u.searchParams), hit = cache.get(target);
    if (hit && Date.now() - hit.t < 30000) return send(res, 200, hit.b);
    try {
      const r = await fetch(target, { headers }), b = await r.text();
      if (r.ok) cache.set(target, { t: Date.now(), b });
      return send(res, r.status, b);
    } catch { return send(res, 502, '{"error":"Upstream unavailable"}'); }
  }
  const root = path.join(__dirname, 'public');
  const f = path.join(root, u.pathname === '/' ? 'index.html' : path.normalize(u.pathname));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Coinpulse running at http://localhost:${PORT}`));
