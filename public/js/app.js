const $ = s => document.querySelector(s);
const S = { cur: 'usd', coins: [], sel: 'bitcoin', days: 7, sort: 'market_cap_rank', dir: 1, q: '', prev: {}, chart: null };
const SYM = { usd: '$', eur: '€', gbp: '£', pkr: '₨', inr: '₹' };
const K = { h: 'price_change_percentage_1h_in_currency', d: 'price_change_percentage_24h_in_currency', w: 'price_change_percentage_7d_in_currency' };
const compact = n => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
const money = n => n == null ? '-' : SYM[S.cur] + (n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toLocaleString('en-US', { maximumSignificantDigits: 4 }));
const big = n => n == null ? '-' : SYM[S.cur] + compact(n);
const pct = n => n == null ? '<span class="text-mute">-</span>' : `<span class="${n >= 0 ? 'text-up' : 'text-down'}">${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(2)}%</span>`;
const err = m => { const e = $('#err'); e.textContent = m; e.classList.toggle('hidden', !m); };
const api = async p => {
  const r = await fetch(p);
  if (!r.ok) throw new Error(r.status === 429 ? 'Rate limit reached. Prices will refresh shortly.' : `Could not load data (${r.status}).`);
  return r.json();
};
const spark = (a, up) => {
  if (!a || !a.length) return '';
  const mn = Math.min(...a), r = Math.max(...a) - mn || 1, s = a.filter((_, i) => i % 4 === 0);
  const pts = s.map((v, i) => `${(i / (s.length - 1) * 100).toFixed(1)},${(30 - (v - mn) / r * 28).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 100 32" class="w-28 h-8"><polyline points="${pts}" fill="none" stroke="${up ? '#2EC4A0' : '#F0616D'}" stroke-width="1.6"/></svg>`;
};

function renderTable() {
  const q = S.q.toLowerCase();
  const rows = S.coins.filter(c => c.name.toLowerCase().includes(q) || c.symbol.includes(q))
    .sort((a, b) => ((a[S.sort] ?? -Infinity) - (b[S.sort] ?? -Infinity)) * S.dir);
  $('#rows').innerHTML = rows.length ? rows.map(c => {
    const p = S.prev[c.id], f = p != null && p !== c.current_price ? (c.current_price > p ? 'flash-up' : 'flash-down') : '';
    return `<tr data-id="${c.id}" class="border-t border-line cursor-pointer hover:bg-line/40 ${c.id === S.sel ? 'bg-line/60' : ''}">
      <td class="py-3 pl-4 text-mute">${c.market_cap_rank}</td>
      <td><div class="flex items-center gap-2"><img src="${c.image}" class="w-6 h-6" alt=""><b>${c.name}</b><span class="text-mute uppercase text-xs">${c.symbol}</span></div></td>
      <td class="text-right font-semibold ${f}">${money(c.current_price)}</td>
      <td class="text-right hidden sm:table-cell">${pct(c[K.h])}</td>
      <td class="text-right">${pct(c[K.d])}</td>
      <td class="text-right hidden md:table-cell">${pct(c[K.w])}</td>
      <td class="text-right hidden lg:table-cell">${big(c.market_cap)}</td>
      <td class="text-right hidden lg:table-cell">${big(c.total_volume)}</td>
      <td class="pr-4 hidden md:table-cell">${spark(c.sparkline_in_7d?.price, (c[K.w] ?? 0) >= 0)}</td></tr>`;
  }).join('') : '<tr><td colspan="9" class="p-8 text-center text-mute">No coins match your search.</td></tr>';
}

function renderDetail() {
  const c = S.coins.find(x => x.id === S.sel); if (!c) return;
  $('#cname').innerHTML = `<img src="${c.image}" class="w-9 h-9" alt=""><div><div class="font-extrabold text-lg">${c.name}</div><div class="text-mute text-xs uppercase">${c.symbol}</div></div>`;
  $('#cprice').textContent = money(c.current_price);
  $('#cchg').innerHTML = pct(c[K.d]) + ' <span class="text-mute">24h</span>';
  const st = [['Market cap rank', '#' + c.market_cap_rank], ['Market cap', big(c.market_cap)], ['24h volume', big(c.total_volume)],
    ['24h high', money(c.high_24h)], ['24h low', money(c.low_24h)],
    ['Circulating supply', compact(c.circulating_supply) + ' ' + c.symbol.toUpperCase()],
    ['All-time high', money(c.ath)], ['From all-time high', pct(c.ath_change_percentage)]];
  $('#stats').innerHTML = st.map(([a, b]) => `<div class="flex justify-between py-2.5 border-b border-line last:border-0"><dt class="text-mute">${a}</dt><dd class="font-semibold">${b}</dd></div>`).join('');
}

async function loadChart() {
  try {
    const d = await api(`/api/chart?id=${S.sel}&cur=${S.cur}&days=${S.days}`);
    const fmt = S.days <= 1 ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' };
    const labels = d.prices.map(p => new Date(p[0]).toLocaleString('en', fmt));
    const data = d.prices.map(p => p[1]);
    const col = data[data.length - 1] >= data[0] ? '#2EC4A0' : '#F0616D';
    const ctx = $('#chart').getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
    const ds = { data, borderColor: col, backgroundColor: g, fill: true, pointRadius: 0, borderWidth: 2, tension: .25 };
    if (S.chart) { S.chart.data.labels = labels; S.chart.data.datasets = [ds]; S.chart.update('none'); }
    else S.chart = new Chart(ctx, { type: 'line', data: { labels, datasets: [ds] }, options: {
      maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: i => money(i.parsed.y) } } },
      scales: { x: { ticks: { maxTicksLimit: 6, color: '#8FA3BF' }, grid: { display: false } },
                y: { position: 'right', ticks: { color: '#8FA3BF', callback: v => money(v) }, grid: { color: '#243652' } } } } });
  } catch (e) { err(e.message); }
}

async function loadMarket() {
  try {
    const [m, g] = await Promise.all([api('/api/markets?cur=' + S.cur), api('/api/global')]);
    S.coins.forEach(c => S.prev[c.id] = c.current_price);
    S.coins = m; err('');
    const x = g.data;
    $('#g1').textContent = big(x.total_market_cap[S.cur]);
    $('#g2').textContent = big(x.total_volume[S.cur]);
    $('#g3').textContent = x.market_cap_percentage.btc.toFixed(1) + '%';
    $('#g4').textContent = x.active_cryptocurrencies.toLocaleString('en-US');
    renderTable(); renderDetail();
  } catch (e) { err(e.message); }
}

const setRange = () => document.querySelectorAll('#ranges button').forEach(b => b.classList.toggle('on', +b.dataset.d === S.days));
$('#q').oninput = e => { S.q = e.target.value; renderTable(); };
$('#cur').onchange = async e => { S.cur = e.target.value; S.prev = {}; await loadMarket(); loadChart(); };
$('#ranges').onclick = e => { if (!e.target.dataset.d) return; S.days = +e.target.dataset.d; setRange(); loadChart(); };
document.querySelector('thead').onclick = e => {
  const k = e.target.dataset.sort; if (!k) return;
  S.dir = S.sort === k ? -S.dir : (k === 'market_cap_rank' ? 1 : -1); S.sort = k; renderTable();
};
$('#rows').onclick = e => {
  const tr = e.target.closest('tr[data-id]'); if (!tr) return;
  S.sel = tr.dataset.id; renderTable(); renderDetail(); loadChart();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

setRange();
loadMarket().then(loadChart);
setInterval(() => { loadMarket(); loadChart(); }, 30000);
