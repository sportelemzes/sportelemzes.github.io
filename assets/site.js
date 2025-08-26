/* =========================
   Közös apróságok (évszám, aktív menü)
   ========================= */

// lábléc évszám
(function () {
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();
})();

// aktív menü (hero-nav .links > a)
(function () {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('.hero-nav .links a').forEach(a => {
    const href = (a.getAttribute('href') || '').replace(/\/+$/, '') || '/';
    if (href === path) a.classList.add('active');
  });
})();

/* =========================
   STATISZTIKA – Tippek tábla
   ========================= */

// rövid -> teljes név (bővíthető)
const TEAM = {
  NEW: 'Newcastle',
  LIV: 'Liverpool',
  ARS: 'Arsenal',
  CHE: 'Chelsea',
  MCI: 'Man City',
  MUN: 'Man United',
  TOT: 'Tottenham',
  WHU: 'West Ham',
  BHA: 'Brighton',
  AVL: 'Aston Villa',
  // ide bátran vegyél fel csapatokat, ligákat
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function eventNameFromId(id) {
  // "NEW-LIV" → "Newcastle – Liverpool"
  const [h, a] = (id || '').split('-');
  const home = TEAM[h] || h || '';
  const away = TEAM[a] || a || '';
  return `${home} – ${away}`.trim();
}

function marketLabel(p) {
  // AH: "AH 0.0", totals: "o/u 2.5", h2h → AH 0.0 (DNB)
  if (p.market === 'asian_handicap' || p.market === 'ah') {
    return `AH ${Number(p.line).toFixed(1)}`;
  }
  if (p.market === 'totals') {
    return `o/u ${Number(p.line).toFixed(1)}`;
  }
  if (p.market === 'h2h') {
    return 'AH 0.0';
  }
  return p.market;
}

function selectionLabel(p) {
  if (p.market === 'totals') {
    return p.selection === 'over' ? 'over' : 'under';
  }
  if (p.selection === 'home') return 'home';
  if (p.selection === 'away') return 'away';
  if (p.selection === 'draw') return 'draw';
  return p.selection;
}

function statusLabel(p) {
  if (p.status === 'won')  return 'befejezett • nyert';
  if (p.status === 'lost') return 'befejezett • vesztett';
  if (p.status === 'push') return 'befejezett • void';
  return 'open';
}

function profitOf(p) {
  // nagyon egyszerűsített elszámolás
  if (p.status === 'won')  return (Number(p.odds) - 1) * Number(p.stake);
  if (p.status === 'lost') return -Number(p.stake);
  if (p.status === 'push') return 0;
  return 0;
}

function money(n) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n).toLocaleString('hu-HU')} Ft`;
}

async function buildStats() {
  const tbody = document.querySelector('#tips tbody');
  if (!tbody) return; // nem a statisztika oldalon vagyunk

  let picks = [];
  try {
    const r = await fetch('/data/picks.json', { cache: 'no-store' });
    picks = await r.json();
  } catch (e) {
    console.error('Nem sikerült betölteni a /data/picks.json fájlt', e);
  }

  tbody.innerHTML = '';

  picks.forEach(p => {
    const tr = document.createElement('tr');

    const profit = profitOf(p);
    const profitCell =
      p.status === 'open'
        ? '—'
        : `<span class="${profit > 0 ? 'win' : (profit < 0 ? 'lost' : 'void')}">${money(profit)}</span>`;

    tr.innerHTML = `
      <td>${fmtDate(p.commence_time)}</td>
      <td>${eventNameFromId(p.eventId)}</td>
      <td>${marketLabel(p)}</td>
      <td>${selectionLabel(p)}</td>
      <td>${Number(p.odds).toFixed(2)}</td>
      <td>${Number(p.stake).toLocaleString('hu-HU')}</td>
      <td>${statusLabel(p)}</td>
      <td>${profitCell}</td>
    `;

    tbody.appendChild(tr);
  });
}

// betöltéskor építse fel a statisztika táblát (ha jelen van a DOM-on)
document.addEventListener('DOMContentLoaded', () => {
  buildStats().catch(console.error);
});
