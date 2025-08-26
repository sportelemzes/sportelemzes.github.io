/**
 * Server-side odds updater for data/picks.json
 * Provider: The Odds API (v4) – https://the-odds-api.com
 * - Secret: ODDS_API_KEY (in GitHub Actions)
 * - Strategy:
 *      1) loads data/picks.json
 *      2) for all "open" picks tries to fetch an up-to-date price
 *      3) writes updated picks.json (only odds field gets overwritten)
 *
 * IMPORTANT
 * - Picks format (per item):
 *   {
 *     "id": "pick-001",
 *     "sport": "soccer_epl",
 *     "eventId": "NEW-LIV",                     // optional shorthand
 *     "home": "Newcastle",                      // optional; preferred if present
 *     "away": "Liverpool",                      // optional; preferred if present
 *     "kickoff": "2025-08-25T19:00:00Z",        // optional but helps matching
 *     "market": "asian_handicap",               // "h2h"|"totals"|"asian_handicap"
 *     "line": 0,                                // for totals/ah; null for h2h
 *     "selection": "away",                      // "home"|"away"|"draw"|"over"|"under"
 *     "odds": 2.10,
 *     "stake": 1000,
 *     "status": "open",                         // "open"|"won"|"lost"|"void"
 *     "result": null,
 *     "profit": null
 *   }
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PICKS_FILE = path.join(ROOT, 'data', 'picks.json');
const API_KEY = process.env.ODDS_API_KEY;

if (!API_KEY) {
  console.error('❌ ODDS_API_KEY missing.');
  process.exit(1);
}

// --- small helper ------------------------------------------------------------

const TEAM_ALIASES = {
  // EPL rövidítések → hivatalos név (bővíthető kedved szerint)
  ARS: 'Arsenal', CHE: 'Chelsea', NEW: 'Newcastle', LIV: 'Liverpool',
  MCI: 'Manchester City', MUN: 'Manchester United', TOT: 'Tottenham',
  WHU: 'West Ham', WOL: 'Wolves', AVL: 'Aston Villa', BHA: 'Brighton',
  LEE: 'Leeds', CRY: 'Crystal Palace', FUL: 'Fulham', BRE: 'Brentford',
};

function aliasToName(codeOrName) {
  const key = (codeOrName || '').trim().toUpperCase();
  if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
  // Try split like "ARS-CHE" → ["ARS","CHE"]
  if (key.includes('-')) return codeOrName; // handled elsewhere
  // Return in Title Case if it's already a name
  return codeOrName;
}

function prettyMarket(p) {
  if (p.market === 'h2h') return '1x2';
  if (p.market === 'totals') return `o/u ${Number(p.line).toFixed(1)}`;
  if (p.market === 'asian_handicap') return `AH ${Number(p.line).toFixed(1)}`;
  return p.market;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- provider access ----------------------------------------------------------

const BASE = 'https://api.the-odds-api.com/v4';

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`);
  return r.json();
}

/**
 * Try to find an event id matching a pick by team names and (roughly) date.
 */
async function findEventIdForPick(pick) {
  const sport = pick.sport; // e.g. "soccer_epl"
  // events in the next 7 days (can tune)
  const eventsUrl = `${BASE}/sports/${sport}/events/?daysFrom=7&apiKey=${API_KEY}`;
  const events = await fetchJson(eventsUrl);

  // Get desired home/away names
  let homeName = pick.home;
  let awayName = pick.away;

  if ((!homeName || !awayName) && pick.eventId) {
    // allow "NEW-LIV" short code
    const [h, a] = pick.eventId.split('-').map(s => s.trim().toUpperCase());
    if (!homeName) homeName = aliasToName(h);
    if (!awayName) awayName = aliasToName(a);
  }

  // Try exact match by names (case-insensitive, ignoring FC etc.)
  const norm = s => (s || '').toLowerCase().replace(/ fc| afc| \.|-/g, '').trim();
  const nh = norm(homeName);
  const na = norm(awayName);

  // Optional date constraint
  const target = pick.kickoff ? new Date(pick.kickoff) : null;

  let best = null;
  for (const ev of events) {
    if (norm(ev.home_team) === nh && norm(ev.away_team) === na) {
      if (!target) return ev.id;
      const d = new Date(ev.commence_time);
      const diffH = Math.abs((d - target) / 36e5);
      if (!best || diffH < best.diffH) best = { id: ev.id, diffH };
    }
  }
  return best?.id || null;
}

/**
 * Fetch odds for a given event id and return price for our pick.
 */
async function fetchPriceForPick(eventId, pick) {
  // Request both H2H, Totals, Spreads (asian) – EU region, decimal odds
  const url = `${BASE}/sports/${pick.sport}/events/${eventId}/odds` +
              `?apiKey=${API_KEY}&regions=eu&markets=h2h,totals,spreads&oddsFormat=decimal`;
  const data = await fetchJson(url);

  // The API returns array of bookmakers, each with markets.
  // We’ll take the first bookmaker that has our market.
  const books = data?.bookmakers || [];

  if (pick.market === 'h2h') {
    for (const bk of books) {
      const m = bk.markets.find(m => m.key === 'h2h');
      if (!m) continue;
      const out = m.outcomes.find(o =>
        (pick.selection === 'home' && o.name?.toLowerCase() === (data.home_team || '').toLowerCase()) ||
        (pick.selection === 'away' && o.name?.toLowerCase() === (data.away_team || '').toLowerCase()) ||
        (pick.selection === 'draw' && o.name?.toLowerCase() === 'draw')
      );
      if (out?.price) return out.price;
    }
  }

  if (pick.market === 'totals') {
    const want = Number(pick.line);
    for (const bk of books) {
      const m = bk.markets.find(m => m.key === 'totals');
      if (!m) continue;
      // pick the outcome by point and side
      let best = null;
      for (const o of m.outcomes) {
        const point = Number(o.point);
        if (isNaN(point)) continue;
        if (Math.abs(point - want) <= 0.05 && o.name?.toLowerCase() === (pick.selection || '').toLowerCase()) {
          best = o; break;
        }
      }
      if (!best) {
        // fallback: nearest line within 0.5
        for (const o of m.outcomes) {
          const point = Number(o.point);
          if (isNaN(point)) continue;
          if (Math.abs(point - want) <= 0.5 && o.name?.toLowerCase() === (pick.selection || '').toLowerCase()) {
            if (!best || Math.abs(Number(best.point) - want) > Math.abs(point - want)) best = o;
          }
        }
      }
      if (best?.price) return best.price;
    }
  }

  if (pick.market === 'asian_handicap') {
    const want = Number(pick.line);
    for (const bk of books) {
      const m = bk.markets.find(m => m.key === 'spreads');
      if (!m) continue;
      // look for outcome with our team + point
      const isHome = pick.selection === 'home';
      let best = null;
      for (const o of m.outcomes) {
        const point = Number(o.point);
        if (isNaN(point)) continue;
        const name = (o.name || '').toLowerCase();
        const wantName = isHome ? (data.home_team || '').toLowerCase()
                                : (data.away_team || '').toLowerCase();
        if (Math.abs(point - want) <= 0.05 && name === wantName) {
          best = o; break;
        }
      }
      if (!best) {
        // fallback: nearest line within 0.25
        for (const o of m.outcomes) {
          const point = Number(o.point);
          if (isNaN(point)) continue;
          const name = (o.name || '').toLowerCase();
          const wantName = isHome ? (data.home_team || '').toLowerCase()
                                  : (data.away_team || '').toLowerCase();
          if (Math.abs(point - want) <= 0.25 && name === wantName) {
            if (!best || Math.abs(Number(best.point) - want) > Math.abs(point - want)) best = o;
          }
        }
      }
      if (best?.price) return best.price;
    }
  }

  return null;
}

// --- main --------------------------------------------------------------------

const raw = await fs.readFile(PICKS_FILE, 'utf8');
let picks;
try {
  picks = JSON.parse(raw);
} catch (e) {
  console.error('❌ Invalid JSON in data/picks.json:\n', e.message);
  process.exit(1);
}

let changed = false;

for (const p of picks) {
  if (p.status !== 'open') continue;

  try {
    const eventId = await findEventIdForPick(p);
    if (!eventId) {
      console.log(`ℹ️  Event not found for ${p.eventId || `${p.home}–${p.away}`} (${prettyMarket(p)})`);
      continue;
    }

    // rate-limit safety
    await sleep(250);

    const price = await fetchPriceForPick(eventId, p);
    if (price && price !== p.odds) {
      console.log(`✔️  ${p.eventId || `${p.home}–${p.away}`} ${prettyMarket(p)} ${p.selection} → ${price}`);
      p.odds = price;
      changed = true;
    } else {
      console.log(`…  No better price for ${p.eventId || `${p.home}–${p.away}`} (${prettyMarket(p)})`);
    }

  } catch (e) {
    console.log(`⚠️  Could not update odds for ${p.eventId || `${p.home}–${p.away}`}: ${e.message}`);
  }
}

if (changed) {
  await fs.writeFile(PICKS_FILE, JSON.stringify(picks, null, 2) + '\n', 'utf8');
  console.log('✅ picks.json updated.');
} else {
  console.log('No changes.');
}
