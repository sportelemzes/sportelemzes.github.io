/* assets/site.js
 * - Főoldal: friss elemzések listája
 * - Lábléc évszám (#y)
 * - Menü aktív link jelölése
 */

// Kicsi segédek
const $ = sel => document.querySelector(sel);
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

async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

// dátum kinyerése (post.date vagy slug eleje: YYYY-MM-DD)
function toDateFromPost(p) {
  try {
    if (p.date) return new Date(p.date);
    if (p.slug) {
      const parts = p.slug.split('-').slice(0, 3); // ["2025","08","26",...]
      if (parts.length === 3) {
        return new Date(parts.join('-'));
      }
    }
  } catch (_) {}
  return new Date(0); // fallback: nagyon régi
}

function prettyDate(d) {
  try {
    return d.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (_) {
    return '';
  }
}

// FŐOLDAL – feed kirajzolása
async function renderFeed() {
  const listEl = $('#list');
  if (!listEl) return; // nem a főoldal

  // a lista elemet feed osztállyal érdemes ellátni a jobb térköz miatt (CSS)
  if (!listEl.classList.contains('feed')) listEl.classList.add('feed');

  try {
    const posts = await fetchJSON('posts/index.json');

    // Legújabb felül
    posts.sort((a, b) => toDateFromPost(b) - toDateFromPost(a));

    const html = posts.map(p => {
      const d = toDateFromPost(p);
      const when = prettyDate(d);
      const league = p.league || '';
      const sport = p.sport || 'Foci';
      const excerpt = p.excerpt || '';

      return `
        <article class="card">
          <h3><a href="posts/${safe(p.slug)}.html">${safe(p.title || p.slug)}</a></h3>
          <div class="meta">${safe(when)} • ${safe(league)} / ${safe(sport)}</div>
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

// Menü aktív link jelölése
function markActiveNav() {
  const path = location.pathname.replace(/\/+$/, ''); // trailing slash off
  const links = $$('#header .links a, header .links a, nav .links a, .links a');
  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    // relatív link összehasonlítás
    const resolved = new URL(href, location.origin).pathname.replace(/\/+$/, '');
    if (resolved === path) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

// Lábléc évszám
function setFooterYear() {
  const y = $('#y');
  if (y) y.textContent = new Date().getFullYear();
}

// DOM betöltés után futtatjuk
document.addEventListener('DOMContentLoaded', () => {
  setFooterYear();
  markActiveNav();
  renderFeed();
});
