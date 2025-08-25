/* Aktív menü és tipp-dobozok */
(function () {
  // ---- NAV ACTIVE ----
  const path = location.pathname
    .replace(/\/index\.html?$/, "/")   // /index.html → /
    .replace(/\/+$/, "/");             // dupla / → 1 db

  document.querySelectorAll(".hero-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    // főoldal
    if ((path === "/" && href === "/") ||
        (href !== "/" && path.startsWith(href))) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });

  // ---- TIPP KIEMELÉS ----
  // Ha egy H3 'Fő tipp' vagy 'Alternatíva' címmel kezdődik,
  // a következő szekciót betesszük egy látványos "card"-ba.
  const h3s = document.querySelectorAll("h3");
  h3s.forEach((h) => {
    const t = h.textContent.trim().toLowerCase();
    let kind = null;
    if (t.startsWith("fő tipp")) kind = "main";
    else if (t.startsWith("alternatíva")) kind = "alt";

    if (kind) {
      const card = document.createElement("div");
      card.className = `tip-card ${kind === "main" ? "main" : ""}`;

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = h.textContent;
      card.appendChild(title);

      // gyűjtünk mindent a következő H2/H3-ig
      let el = h.nextSibling;
      const untilHeader = (node) =>
        node && node.nodeType === 1 && /^(H2|H3)$/.test(node.tagName);

      while (el && !untilHeader(el)) {
        const next = el.nextSibling;
        card.appendChild(el);
        el = next;
      }
      h.parentNode.insertBefore(card, h);
      h.remove();
    }
  });
})();
