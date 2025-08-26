// Közös formázók és apró helper függvények – a stats/index/post oldalakon használjuk.

(function(){
  const yEl = document.getElementById('y');
  if (yEl) yEl.textContent = new Date().getFullYear();
})();

window.__fmt = {
  // 2025. 08. 25.
  date(d) {
    const y=d.getFullYear();
    const m=('0'+(d.getMonth()+1)).slice(-2);
    const dd=('0'+d.getDate()).slice(-2);
    return `${y}. ${m}. ${dd}.`;
  },
  // 1 000 → Ft
  money(n) {
    const s = (Math.round(Number(n))||0).toLocaleString('hu-HU');
    return s;
  },
  line(x) {
    const n = Number(x);
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  },
  market(p) {
    if (p.market === 'h2h') return '1x2';
    if (p.market === 'totals') return `o/u ${this.line(p.line)}`;
    if (p.market === 'asian_handicap') return `AH ${this.line(p.line)}`;
    return p.market || '';
  },
  // NEW → Newcastle stb. (admin alias-nak is jó)
  alias(code) {
    const map = {
      ARS:'Arsenal', CHE:'Chelsea', NEW:'Newcastle', LIV:'Liverpool',
      MCI:'Manchester City', MUN:'Manchester United', TOT:'Tottenham',
      WHU:'West Ham', WOL:'Wolves', AVL:'Aston Villa', BHA:'Brighton',
      LEE:'Leeds', CRY:'Crystal Palace', FUL:'Fulham', BRE:'Brentford'
    };
    return map[(code||'').toUpperCase()] || code;
  }
};
/* ===== Odds-szinkron a posts oldalon a /data/picks.json alapján ===== */
(function oddsSyncFromPicks(){
  const cards = document.querySelectorAll('.pick-card[data-event-id]');
  if (!cards.length) return;

  // poszt oldali market normalizálás
  const normalizeWant = (m) => {
    m = (m || '').toLowerCase().trim();
    if (['asian_0','dnb','ah0','ah-0','ah 0'].includes(m)) return 'ah_0';
    return m;
  };

  // picks.json market normalizálás
  const normalizePick = (p) => {
    // p.market, p.line -> rövid kulcs
    let mk = (p.market || '').toLowerCase().trim();
    const ln = (typeof p.line === 'number' ? p.line : parseFloat(p.line));

    // pénzvonal / 1x2
    if (mk === 'moneyline' || mk === 'h2h') mk = 'h2h';

    // totals (összgól) -> totals_2.5
    if (mk === 'totals' && isFinite(ln)) mk = `totals_${ln}`;

    // asian handicap -> ah_0, ah_-0.25 stb. (nekünk most 0.0 kell)
    if (mk === 'asian_handicap' || mk === 'asian handicap') {
      if (isFinite(ln) && Math.abs(ln) < 1e-9) mk = 'ah_0';
      else mk = `ah_${ln}`;
    }

    return mk;
  };

  fetch('/data/picks.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(rows => {
      cards.forEach(card => {
        const ev  = (card.dataset.eventId || '').trim();
        const sel = (card.dataset.selection || '').toLowerCase().trim();
        const wantM = normalizeWant(card.dataset.market || '');

        const row = rows.find(p => {
          const pEv  = (p.eventId || '').trim();
          const pSel = (p.selection || '').toLowerCase().trim();
          const pMk  = normalizePick(p);
          return pEv === ev && pSel === sel && pMk === wantM;
        });

        const out = card.querySelector('.odds-value');
        if (row && out) {
          const val = isFinite(row.odds) ? Number(row.odds).toFixed(2) : (row.odds || '');
          out.textContent = val;
        }
      });
    })
    .catch(console.warn);
})();
