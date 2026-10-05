# Coinpulse - crypto tracker

1. Install Node.js 18 or newer.
2. Open a terminal in this folder and run: `node server.js`
3. Visit http://localhost:3000

The API key lives in `.env` and is only read by `server.js`; the browser never sees it.
Set `API_BASE_URL` (and `API_KEY_HEADER` if needed) to use your key with its provider.
With `API_BASE_URL` empty, the site uses CoinGecko's free public API.
