/* assets/site.js
 * - Főoldal: friss elemzések listája (posts/index.json)
 * - Dátumkezelés robusztus (YYYY-MM-DD, YYYY. MM. DD., stb.)
 * - Lábléc év (#y) és aktív menü link jelölése
 */

const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function safe(text) {
  if (text == null) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* ── Dátum parsolás ───────────────────────────────────────────────────── */

function parseYMDtoUTC(s) {
  // Fogad: "2025-08-26", "2025. 08. 26.", "2025 08 26", sőt "2025-08-26-slug"
  const m = String(s).match(/(\d{4})[.\-\/\s]?(\d{2})[.\-\/\s]?(\d{2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d);
}

// Poszt időbélyeg (UTC milliszekundum) a rendezéshez
function stampForPost(p) {
  if (p.date) {
    const t1 = parseYMDtoUTC(p.date);
    if (t1 != null) return t1;
    const t2 = Date.parse(p.date);          // ha ISO volt
    if (!Number.isNaN(t2)) return t2;
  }
  if (p.slug) {
    const t3 = parseYMDtoUTC(p.slug);
    if (t3 != null) return t3;
  }
  return 0;
}

function prettyDateFromStamp(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('hu-HU', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  } catch (_) { return ''; }
}

/* ── Főoldal feed ─────────────────────────────────────────────────────── */

async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function renderFeed() {
  const listEl = $('#list');
  if (!listEl) return; // nem a főoldal

  listEl.classList.add('feed'); // térközökhöz (CSS)

  try {
    const posts = await fetchJSON('posts/index.json');

    // Legújabb → legrégebbi
    posts.sort((a, b) => {
      const tb = stampForPost(b), ta = stampForPost(a);
      if (tb !== ta) return tb - ta;
      return String(b.slug || '').localeCompare(String(a.slug || ''));
    });

    const html = posts.map(p => {
      const ts   = stampForPost(p);
      const when = prettyDateFromStamp(ts);
      const league = p.league || '';
      const sport  = p.sport  || 'Foci';
      const excerpt = p.excerpt || '';

      return `
        <article class="card">
          <h3><a href="posts/${safe(p.slug)}.html">${safe(p.title || p.slug)}</a></h3>
          <div class="meta">${safe(when)} • ${safe(league)}${sport ? ' / '+safe(sport) : ''}</div>
          <p>${safe(excerpt)}</p>
          <p><a class="more" href="posts/${safe(p.slug)}.html">Tovább →</a></p>
        </article>
      `;
    }).join('');

    listEl.innerHTML = html || `<p>Jelenleg még nincs megjeleníthető elemzés.</p>`;
  } catch (err) {
    console.error('Feed betöltési hiba:', err);
    listEl.innerHTML = `<p>Nem sikerült betölteni a listát.</p>`;
  }
}

/* ── UI apróságok ─────────────────────────────────────────────────────── */

function markActiveNav() {
  const path = location.pathname.replace(/\/+$/, '');
  const links = $$('#header .links a, header .links a, nav .links a, .links a');
  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    const resolved = new URL(href, location.origin).pathname.replace(/\/+$/, '');
    if (resolved === path) a.classList.add('active');
    else a.classList.remove('active');
  });
}

function setFooterYear() {
  const y = $('#y');
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
  setFooterYear();
  markActiveNav();
  renderFeed();
});
