(() => {
  'use strict';

  // --- kis segédek
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // év a láblécben
    const y = $('#y');
    if (y) y.textContent = new Date().getFullYear();

    // egyszerű nav-kiemelés
    markActiveNav();

    // főoldali feed
    const list = $('#list');
    if (list) {
      list.classList.add('feed');
      loadAndRenderFeed(list);
    }
  }

  function markActiveNav() {
    const p = location.pathname.replace(/\/+$/, '') || '/';
    $$('.links a').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const normalized = href.replace(/^\//, '');
      if ((p === '/' && href === '/') || (p.endsWith(normalized) && normalized !== '')) {
        a.classList.add('active');
      }
    });
  }

  // --- feed

  async function loadAndRenderFeed(list) {
    try {
      const res = await fetch('/posts/index.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const posts = await res.json();
      if (!Array.isArray(posts)) throw new Error('posts/index.json nem tömb');

      // legújabb felül
      posts.sort((a, b) => stampForPost(b) - stampForPost(a));

      list.innerHTML = posts.map(renderCard).join('');
    } catch (err) {
      console.error(err);
      list.innerHTML = `<p class="muted">Nem sikerült betölteni a listát.</p>`;
    }
  }

  function renderCard(p) {
    const url   = `/posts/${p.slug}.html`;
    const date  = p.date || prettyDateFromSlug(p.slug) || '';
    const league = p.league ? ` • ${escapeHtml(p.league)}` : '';
    const excerpt = p.excerpt ? escapeHtml(p.excerpt) : '';
    const title = escapeHtml(p.title || p.slug);

    return `
      <article class="card">
        <h3 class="title"><a href="${url}">${title}</a></h3>
        <p class="muted">${escapeHtml(date)}${league}</p>
        ${excerpt ? `<p>${excerpt}</p>` : ``}
        <p><a class="more" href="${url}">Tovább →</a></p>
      </article>
    `;
  }

  // ---- dátum: megbízható rendezési bélyeg

  function stampForPost(p) {
    // 1) slug – mindig tartalmaz YYYY-MM-DD-et
    if (p && p.slug) {
      const t = parseYMDtoUTC(p.slug);
      if (t != null) return t;
    }
    // 2) opcionális: dateSort mező (pl. "2025-08-26")
    if (p && p.dateSort) {
      const t = parseYMDtoUTC(p.dateSort);
      if (t != null) return t;
    }
    // 3) p.date szöveg (pl. "2025. 08. 26.")
    if (p && p.date) {
      let t = parseYMDtoUTC(p.date);
      if (t != null) return t;
      t = Date.parse(p.date);
      if (!Number.isNaN(t)) return t;
    }
    // 4) ha semmi sem megy, 0 (lista aljára kerül)
    return 0;
  }

  function prettyDateFromSlug(slug = '') {
    const t = parseYMDtoUTC(slug);
    if (t == null) return '';
    const d = new Date(t);
    const y  = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}. ${mo}. ${dd}.`;
  }

  // YYYY-MM-DD vagy "YYYY. MM. DD." felbontása → UTC milliszekundum
  function parseYMDtoUTC(str = '') {
    // 1) 2025-08-26, 2025_08_26, 2025 08 26, stb.
    let m = str.match(/(\d{4})[-_.\/\s]?(\d{2})[-_.\/\s]?(\d{2})/);
    if (m) {
      const y = +m[1], mo = +m[2], d = +m[3];
      if (validYMD(y, mo, d)) return Date.UTC(y, mo - 1, d);
    }
    // 2) Hungarian dotted: 2025. 08. 26.
    m = str.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (m) {
      const y = +m[1], mo = +m[2], d = +m[3];
      if (validYMD(y, mo, d)) return Date.UTC(y, mo - 1, d);
    }
    return null;
  }

  function validYMD(y, m, d) {
    return (m >= 1 && m <= 12 && d >= 1 && d <= 31);
  }

  function escapeHtml(s = '') {
    return s.replace(/[&<>"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[ch]));
  }

})();
