// assets/main.js
(async function () {
  const cacheBust = () => `?_=${Date.now()}`;
  const $ = (sel) => document.querySelector(sel);

  const picksTbody = $("#picksTable");
  const plCanvas = $("#plChart");
  const plEmpty = $("#plEmpty");

  async function loadJSON(path) {
    const res = await fetch(`${path}${cacheBust()}`);
    if (!res.ok) throw new Error(`Fetch failed: ${path}`);
    return res.json();
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function z(n) {
    return typeof n === "number" ? n.toFixed(2) : n ?? "";
  }

  // ----- Tippek táblázat ----------------------------------------------------
  try {
    const picks = await loadJSON("/data/picks.json");
    if (Array.isArray(picks) && picks.length && picksTbody) {
      picksTbody.innerHTML = picks
        .sort(
          (a, b) =>
            new Date(b.commence_time || 0) - new Date(a.commence_time || 0)
        )
        .map((p) => {
          const market =
            p.market === "totals"
              ? `Totals ${p.line ?? ""}`
              : (p.market || "h2h").toUpperCase();
          const tipp =
            p.market === "totals"
              ? `${p.selection || ""} ${p.line ?? ""}`
              : (p.selection || "").toUpperCase();

          // Eredmény/profit – ha a settle script már számolta:
          const eredm =
            p.result ||
            (p.status === "won"
              ? "Nyert"
              : p.status === "lost"
              ? "Vesztes"
              : p.status === "push"
              ? "Push"
              : (p.status || "open"));

          let profit = "";
          if (typeof p.profit === "number") profit = z(p.profit);
          else if (p.status === "won" && p.odds && p.stake)
            profit = z(p.stake * (p.odds - 1));
          else if (p.status === "lost" && p.stake) profit = z(-p.stake);

          const matchName =
            p.match ||
            (p.home_team && p.away_team
              ? `${p.home_team} – ${p.away_team}`
              : (p.eventId || "").slice(0, 8));

          return `
            <tr>
              <td>${fmtDate(p.commence_time)}</td>
              <td>${matchName}</td>
              <td>${market}</td>
              <td>${tipp}</td>
              <td>${z(p.odds)}</td>
              <td>${z(p.stake)}</td>
              <td>${eredm}</td>
              <td>${profit}</td>
            </tr>
          `;
        })
        .join("");
    } else if (picksTbody) {
      picksTbody.innerHTML = "";
    }
  } catch (e) {
    if (picksTbody) picksTbody.innerHTML = `<tr><td colspan="8">Nem sikerült betölteni a tippeket.</td></tr>`;
    console.error(e);
  }

  // ----- Havi P/L grafikon --------------------------------------------------
  try {
    const monthly = await loadJSON("/data/monthly-pl.json");
    if (Array.isArray(monthly) && monthly.length && plCanvas) {
      if (plEmpty) plEmpty.style.display = "none";

      const labels = monthly.map((m) => m.month || m.label || "");
      const monthlyPnL = monthly.map((m) => +m.profit || 0);
      // kumulált
      const cum = [];
      monthlyPnL.reduce((acc, v, i) => (cum[i] = acc + v), 0);

      const ctx = plCanvas.getContext("2d");
      // eslint-disable-next-line no-undef
      new Chart(ctx, {
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "Havi profit",
              data: monthlyPnL,
            },
            {
              type: "line",
              label: "Kumulált",
              data: cum,
              yAxisID: "y",
              tension: 0.2,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true },
          },
          plugins: {
            legend: { position: "top" },
          },
        },
      });
    } else if (plEmpty) {
      plEmpty.style.display = "block";
    }
  } catch (e) {
    if (plEmpty) {
      plEmpty.style.display = "block";
      plEmpty.textContent = "Nem sikerült betölteni a P/L adatokat.";
    }
    console.error(e);
  }
})();
