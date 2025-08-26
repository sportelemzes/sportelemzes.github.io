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
