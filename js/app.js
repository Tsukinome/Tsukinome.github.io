/*
 * app.js — a scroll-driven, live portfolio.
 *
 *  Data:   GitHub REST API (profile, repos, languages, commits, README, commit search)
 *          Open-Meteo (current weather + sunrise/sunset in Vilnius, no key)
 *  Cache:  localStorage, 1 hour for GitHub, 30 min for weather, 404s remembered
 *  Motion: living sky (moon phase, sun, weather particles, constellation),
 *          typewriter, count-up, scramble headings, reveal-on-scroll, card tilt,
 *          magnetic buttons, cursor glow, timeline that draws itself,
 *          tech ticker, command palette (⌘K), chapter dots, progress bar
 */

const API = "https://api.github.com";
const TTL_GH = 60 * 60 * 1000;
const TTL_WX = 30 * 60 * 1000;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = matchMedia("(hover: none)").matches;

const LANG_COLORS = {
  "Jupyter Notebook": "#DA5B0B", Python: "#3572A5", HTML: "#e34c26", CSS: "#563d7c",
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Shell: "#89e051", R: "#198CE7",
  SQL: "#e38c00", Dockerfile: "#384d54", Makefile: "#427819", Markdown: "#083fa1",
};
const langColor = (n) => LANG_COLORS[n] || "#9a93b8";

/* ---------- DOM helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c !== null && c !== undefined) node.append(c);
  return node;
};
const icon = (id) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
};
const fmt = (n) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [u, s] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]])
    if (diff >= s) return rtf.format(-Math.floor(diff / s), u);
  return "just now";
}

/* ---------- fetch layer ---------- */
let rateLimited = false;
async function cachedFetch(url, ttl = TTL_GH, headers = { Accept: "application/vnd.github+json" }) {
  const key = "gh:" + url;
  try {
    const hit = JSON.parse(localStorage.getItem(key));
    if (hit && Date.now() - hit.t < ttl) {
      if (hit.s === 404) throw Object.assign(new Error("not found (cached)"), { status: 404 });
      return hit.v;
    }
  } catch (e) { if (e.status === 404) throw e; }
  const res = await fetch(url, { headers });
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get("x-ratelimit-remaining") === "0") rateLimited = true;
    throw Object.assign(new Error("rate limited"), { status: res.status });
  }
  if (res.status === 404) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), s: 404 })); } catch (e) {}
    throw Object.assign(new Error("not found"), { status: 404 });
  }
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
  if (!/json/i.test(res.headers.get("content-type") || "")) throw Object.assign(new Error("not json"), { status: 404 });
  const data = await res.json();
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: data })); } catch (e) {}
  return data;
}
// Private repos go through the same-origin proxy; public ones straight to GitHub.
const repoBase = (p) => (p.private && SITE.proxy ? `${location.origin}${SITE.proxy}${p.repo}` : `${API}/repos/${SITE.githubUser}/${p.repo}`);
function showNotice(text) { const n = $("#notice"); n.textContent = text; n.classList.add("show"); }

/* ---------- static text ---------- */
function renderStatic() {
  const gh = `https://github.com/${SITE.githubUser}`;
  $("#name").textContent = SITE.name;
  $("#brand-name").textContent = SITE.name;
  $("#footer-name").textContent = `© ${new Date().getFullYear()} ${SITE.name}`;
  $("#intro").textContent = SITE.intro;
  $("#gh-profile").href = gh; $("#li-profile").href = SITE.linkedin;
  $("#c-linkedin").href = SITE.linkedin; $("#c-github").href = gh;
  $("#c-github-text").textContent = "@" + SITE.githubUser;
  $("#c-email").href = "mailto:" + SITE.email; $("#c-email-text").textContent = SITE.email;
  $("#c-location").textContent = SITE.location;
  $("#avatar").alt = SITE.name;
  $("#avatar").src = `https://github.com/${SITE.githubUser}.png?size=320`;
  hostBadge();
}
/* Says which host serves this copy and whether private repos can be proxied. Handy for side-by-side demos. */
async function hostBadge() {
  const h = location.hostname;
  const host = h.endsWith("github.io") ? "GitHub Pages" : h.endsWith("pages.dev") || h.endsWith("workers.dev") ? "Cloudflare Pages" : h === "localhost" || h === "127.0.0.1" ? "local server" : h;
  let proxy = "no proxy · private repos hidden";
  try {
    const first = PROJECTS.find((p) => p.private);
    if (first && SITE.proxy) {
      const r = await fetch(`${SITE.proxy}${first.repo}`, { method: "GET" });
      if (/json/i.test(r.headers.get("content-type") || "")) proxy = r.ok ? "proxy on · private repos live" : r.status === 503 ? "proxy deployed · token not set" : `proxy error ${r.status}`;
    }
  } catch (e) {}
  $("#footer-host").textContent = `Served by ${host} · ${proxy}`;
}

/* ---------- typewriter ---------- */
function typewriter(node, words) {
  if (REDUCED) { node.textContent = words[0]; return; }
  let w = 0, i = 0, del = false;
  const tick = () => {
    const word = words[w];
    node.textContent = word.slice(0, i);
    if (!del && i < word.length) { i++; setTimeout(tick, 70); }
    else if (!del) { del = true; setTimeout(tick, 1600); }
    else if (i > 0) { i--; setTimeout(tick, 35); }
    else { del = false; w = (w + 1) % words.length; setTimeout(tick, 300); }
  };
  tick();
}

/* ---------- scramble-in headings ---------- */
const GLYPHS = "░▒▓▖▗▘▙▚▛▜▝▞▟·:∙";
function scramble(node) {
  if (REDUCED || node.dataset.done) return;
  node.dataset.done = "1";
  const text = node.textContent; const start = performance.now(), dur = 700;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    node.textContent = [...text].map((ch, i) => ch === " " ? " " : i / text.length < p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");
    if (p < 1) requestAnimationFrame(step); else node.textContent = text;
  };
  requestAnimationFrame(step);
}

/* ---------- local time + weather ---------- */
const WX = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog", 51: "drizzle", 53: "drizzle", 55: "drizzle", 61: "rain", 63: "rain", 65: "heavy rain", 71: "snow", 73: "snow", 75: "snow", 77: "snow", 80: "showers", 81: "showers", 82: "showers", 85: "snow showers", 86: "snow showers", 95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm" };
const wx = { code: null, temp: null, isDay: null, sunrise: null, sunset: null };
function vilniusNow() {
  const parts = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: SITE.timezone }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour").value) % 24, m = Number(parts.find((p) => p.type === "minute").value);
  return { h, m, frac: (h + m / 60) / 24 };
}
function clock() {
  const { h, m } = vilniusNow();
  const part = h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  $("#local-time").textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} in ${SITE.location.split(",")[0]} · good ${part}`;
}
async function weather() {
  try {
    const { lat, lon } = SITE.coords;
    const d = await cachedFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=${encodeURIComponent(SITE.timezone)}&forecast_days=1`, TTL_WX, {});
    wx.code = d.current.weather_code; wx.temp = d.current.temperature_2m; wx.isDay = d.current.is_day === 1;
    wx.sunrise = d.daily.sunrise[0].slice(11, 16); wx.sunset = d.daily.sunset[0].slice(11, 16);
    $("#weather").textContent = `· ${Math.round(wx.temp)}°C, ${WX[wx.code] || "changeable"} · ${wx.isDay ? "sunset " + wx.sunset : "sunrise " + wx.sunrise}`;
    document.documentElement.dataset.sky = wx.isDay ? "day" : "night";
  } catch (e) { /* decoration only */ }
}

/* ---------- count-up ---------- */
function countUp(node, target) {
  node.classList.remove("skel");
  if (typeof target !== "number" || REDUCED) { node.textContent = typeof target === "number" ? fmt(target) : target; return; }
  const start = performance.now(), dur = 1100;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(Math.round(target * e));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- profile + everything derived from the repo list ---------- */
let repoCache = [];
async function renderProfile() {
  try {
    const [user, repos] = await Promise.all([
      cachedFetch(`${API}/users/${SITE.githubUser}`),
      cachedFetch(`${API}/users/${SITE.githubUser}/repos?per_page=100&sort=pushed`),
    ]);
    repoCache = repos;
    $("#avatar").src = user.avatar_url;
    countUp($('[data-stat="repos"]'), user.public_repos);
    countUp($('[data-stat="followers"]'), user.followers);
    countUp($('[data-stat="stars"]'), repos.reduce((s, r) => s + r.stargazers_count, 0));
    $("#footer-updated").textContent = `Live via GitHub API · ${new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`;
    renderTimeline(repos);
    renderTicker(repos);
    renderHeatmap(repos);
    buildPalette();
  } catch (e) {
    for (const k of ["repos", "followers", "stars"]) countUp($(`[data-stat="${k}"]`), "—");
    renderTimeline([]); renderTicker([]); buildPalette();
    $("#heat").hidden = true;
    showNotice(rateLimited ? "GitHub API limit reached for your network. Live numbers return within the hour." : "Could not reach the GitHub API. Showing curated content only.");
  }
  const year = new Date().getFullYear();
  cachedFetch(`${API}/search/commits?q=author:${SITE.githubUser}+committer-date:>${year}-01-01&per_page=1`)
    .then((r) => countUp($('[data-stat="commits"]'), r.total_count))
    .catch(() => countUp($('[data-stat="commits"]'), "—"));
}

/* Journey: static milestones + Kaggle repos by created date + "now" from latest push. */
function renderTimeline(repos) {
  const byName = Object.fromEntries(repos.map((r) => [r.name, r]));
  const items = JOURNEY.map((j) => ({ ...j, sort: j.when + "-01" }));
  for (const p of PROJECTS) {
    const iso = byName[p.repo]?.created_at?.slice(0, 7) || p.started;
    if (!iso) continue;
    const isKaggle = (p.group || "kaggle") === "kaggle";
    items.push({ when: new Date(iso + "-01").toLocaleDateString("en", { month: "short", year: "numeric" }), title: p.title, note: isKaggle ? "Kaggle · " + (p.kaggleLabel || "project") : "Built · " + (p.tags?.[0] || "project"), sort: iso, kaggle: isKaggle, build: !isKaggle, href: isKaggle ? "#projects" : "#builds" });
  }
  const latest = repos[0];
  if (latest) items.push({ when: "Now", title: `Working on ${latest.name}`, note: `last push ${relTime(latest.pushed_at)}`, sort: "9999", now: true, href: latest.html_url });
  items.sort((a, b) => a.sort.localeCompare(b.sort));
  $("#timeline").replaceChildren(...items.map((it, i) =>
    el("li", { class: "tl reveal" + (it.kaggle ? " kaggle" : "") + (it.build ? " build" : "") + (it.now ? " now" : ""), style: `--i:${i}` }, [
      el("span", { class: "tl-when" }, it.when),
      el("div", { class: "tl-body" }, [
        it.href ? el("a", { class: "tl-title", href: it.href, target: it.href.startsWith("#") ? null : "_blank", rel: "noopener" }, it.title) : el("span", { class: "tl-title" }, it.title),
        el("span", { class: "tl-note" }, it.note),
      ]),
    ])
  ));
  observeReveals();
}

/* Ticker: languages across the account (live) + curated tags. */
async function renderTicker(repos) {
  const totals = {};
  await Promise.all(repos.filter((r) => !r.fork).slice(0, 12).map(async (r) => {
    try { const l = await cachedFetch(`${API}/repos/${SITE.githubUser}/${r.name}/languages`); for (const [k, v] of Object.entries(l)) totals[k] = (totals[k] || 0) + v; } catch (e) {}
  }));
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const langs = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([n, v]) => el("span", { class: "tk" }, [el("i", { style: `background:${langColor(n)}` }), n, el("b", {}, `${(v / sum) * 100 < 1 ? "<1" : Math.round((v / sum) * 100)}%`)]));
  const tags = [...new Set(PROJECTS.flatMap((p) => p.tags || []))].map((t) => el("span", { class: "tk tag-tk" }, ["✦ ", t]));
  const items = [];
  const max = Math.max(langs.length, tags.length);
  for (let i = 0; i < max; i++) { if (langs[i]) items.push(langs[i]); if (tags[i]) items.push(tags[i]); }
  const track = $("#ticker-track");
  track.replaceChildren(...items, ...items.map((n) => n.cloneNode(true)));
  track.style.setProperty("--n", items.length);
  $("#ticker").classList.add("ready");
}

/* Heatmap: public commits over the last 12 months, aggregated per day. */
async function renderHeatmap(repos) {
  const since = new Date(); since.setMonth(since.getMonth() - 12); since.setHours(0, 0, 0, 0);
  const own = repos.filter((r) => !r.fork && new Date(r.pushed_at) > since).slice(0, 8);
  const counts = {};
  let total = 0;
  await Promise.all(own.map(async (r) => {
    try {
      const c = await cachedFetch(`${API}/repos/${SITE.githubUser}/${r.name}/commits?since=${since.toISOString()}&per_page=100&author=${SITE.githubUser}`);
      for (const x of c) { const d = x.commit.author.date.slice(0, 10); counts[d] = (counts[d] || 0) + 1; total++; }
    } catch (e) {}
  }));
  if (!total && (rateLimited || !own.length)) { $("#heat").hidden = true; return; }
  // grid: columns are weeks, rows Mon..Sun, ending today
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - 7 * 52 - ((end.getDay() + 6) % 7));
  const max = Math.max(1, ...Object.values(counts));
  const cells = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10), n = counts[key] || 0;
    const lvl = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
    cells.push(el("i", { class: `l${lvl}`, title: `${n} commit${n === 1 ? "" : "s"} · ${d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}`, style: `--d:${cells.length}` }));
  }
  $("#heat-grid").replaceChildren(...cells);
  $("#heat-total").textContent = `${total} commit${total === 1 ? "" : "s"} · ${own.length} repo${own.length === 1 ? "" : "s"}`;
  $("#heat").classList.add("ready");
}

/* ---------- project cards ---------- */
function projectCard(p) {
  const repoUrl = `https://github.com/${SITE.githubUser}/${p.repo}`;
  const card = el("article", { class: "card tilt reveal" + (p.featured ? " featured" : ""), "data-tags": (p.tags || []).join("|") });
  card.append(
    el("div", { class: "card-head" }, [
      el("div", { class: "card-kicker" }, [
        p.kaggle ? el("a", { class: "kaggle-badge", href: p.kaggle, target: "_blank", rel: "noopener" }, [icon("i-kaggle"), p.kaggleLabel || "Kaggle"]) : null,
        el("span", { class: "pill", "data-role": "status" }, "…"),
      ]),
      el("h3", {}, el("a", { href: repoUrl, target: "_blank", rel: "noopener" }, p.title || p.repo)),
      el("p", { class: "summary" }, p.summary || ""),
    ]),
    el("div", { class: "card-body" }, [
      p.highlights?.length ? el("ul", {}, p.highlights.map((h) => el("li", {}, h))) : null,
      el("div", { class: "tags" }, (p.tags || []).map((t) => el("span", { class: "tag" }, t))),
    ]),
    el("div", { class: "card-meta" }, [
      el("div", { class: "meta-row", "data-role": "meta" }, el("span", { class: "skel" }, "loading")),
      el("div", { class: "langbar skel", "data-role": "langbar" }),
    ]),
    el("div", { class: "card-foot" }, p.private ? [
      el("a", { class: "btn btn-sm", href: `mailto:${SITE.email}?subject=${encodeURIComponent("Code request: " + p.repo)}` }, [icon("i-mail"), "Code on request"]),
      el("button", { class: "btn btn-sm", type: "button", "data-role": "readme", onclick: () => openReadme(p) }, [icon("i-book"), "README"]),
    ] : [
      el("a", { class: "btn btn-sm", href: repoUrl, target: "_blank", rel: "noopener" }, [icon("i-github"), "Code"]),
      ...(p.notebooks || []).map((n) => el("a", { class: "btn btn-sm", href: `${repoUrl}/blob/main/${encodeURI(n.path)}`, target: "_blank", rel: "noopener", "data-role": "notebook" }, [icon("i-notebook"), n.label])),
      el("button", { class: "btn btn-sm", type: "button", "data-role": "readme", onclick: () => openReadme(p) }, [icon("i-book"), "README"]),
    ]),
  );
  return card;
}
async function hydrateCard(p, card) {
  const status = $('[data-role="status"]', card), meta = $('[data-role="meta"]', card), bar = $('[data-role="langbar"]', card);
  const base = repoBase(p);
  try {
    const [repo, langs] = await Promise.all([cachedFetch(base), cachedFetch(`${base}/languages`)]);
    status.textContent = p.private ? "Private" : repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : "Public";
    if (p.private) { status.classList.add("private"); status.title = "Stats served through a read-only proxy; the code itself stays private."; }
    meta.replaceChildren(
      el("span", {}, [icon("i-star"), String(repo.stargazers_count)]),
      el("span", {}, [icon("i-fork"), String(repo.forks_count)]),
      el("span", {}, [icon("i-clock"), relTime(repo.pushed_at)]),
      el("span", {}, `${fmt(repo.size * 1024)}B`),
    );
    const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
    bar.classList.remove("skel");
    bar.replaceChildren(...Object.entries(langs).sort((a, b) => b[1] - a[1]).map(([n, b]) =>
      el("span", { style: `width:${(b / total) * 100}%;background:${langColor(n)}`, title: `${n} ${((b / total) * 100).toFixed(0)}%` })));
    if (repo.default_branch && repo.default_branch !== "main")
      for (const a of $$('[data-role="notebook"]', card)) a.href = a.href.replace("/blob/main/", `/blob/${repo.default_branch}/`);
  } catch (e) {
    bar.remove();
    if (e.status === 404 || (p.private && e.status === 503)) {
      status.textContent = "Private"; status.classList.add("private");
      meta.replaceChildren(el("span", {}, "Code on request."));
      $('[data-role="readme"]', card).remove();
    } else {
      status.textContent = rateLimited ? "Paused" : "Offline";
      meta.replaceChildren(el("span", {}, rateLimited ? "API limit reached." : "Stats unavailable."));
    }
  }
}
function renderProjects() {
  const all = [];
  for (const grid of $$("[data-grid]")) {
    const group = grid.dataset.grid;
    const items = PROJECTS.filter((p) => (p.group || "kaggle") === group);
    const cards = items.map((p) => { const c = projectCard(p); grid.append(c); return [p, c]; });
    renderFilters($(`[data-filters="${group}"]`), items, cards.map(([, c]) => c));
    all.push(...cards);
  }
  all.forEach(([p, c], i) => setTimeout(() => hydrateCard(p, c), i * 120));
  bindTilt(); bindMagnet();
}
function renderFilters(bar, items, cards) {
  if (!bar) return;
  const tags = [...new Set(items.flatMap((p) => p.tags || []))].sort();
  let active = "All";
  const apply = () => {
    for (const c of cards) c.classList.toggle("hidden", active !== "All" && !c.dataset.tags.split("|").includes(active));
    for (const b of bar.children) b.setAttribute("aria-pressed", String(b.textContent === active));
  };
  bar.replaceChildren(...["All", ...tags].map((t) => el("button", { class: "chip", type: "button", "aria-pressed": "false", onclick: () => { active = t; apply(); } }, t)));
  apply();
}

/* ---------- README modal ---------- */
const modal = $("#readme-modal");
$("#readme-close").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
async function openReadme(p) {
  const body = $("#readme-body");
  $("#readme-title").textContent = `${p.repo} / README.md`;
  body.innerHTML = '<p class="skel" style="width:60%">loading</p><p class="skel">loading</p><p class="skel" style="width:80%">loading</p>';
  modal.showModal();
  try {
    const data = await cachedFetch(`${repoBase(p)}/readme`);
    const md = new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
    body.innerHTML = DOMPurify.sanitize(marked.parse(md), { ADD_ATTR: ["target"] });
    const blobBase = data.html_url.replace(/\/README\.md$/i, "/");
    for (const a of $$("a[href]", body)) {
      const href = a.getAttribute("href");
      if (!/^(https?:|mailto:|#)/i.test(href)) a.href = new URL(href, blobBase).href;
      if (!href.startsWith("#")) { a.target = "_blank"; a.rel = "noopener"; }
    }
  } catch (e) {
    body.innerHTML = p.private
      ? `<p style="color:var(--text-muted)">This repository is private and its README isn't available on this host. <a href="mailto:${SITE.email}">Ask for access</a>.</p>`
      : `<p style="color:var(--text-muted)">Could not load the README. <a href="https://github.com/${SITE.githubUser}/${p.repo}" target="_blank" rel="noopener">Open on GitHub</a>.</p>`;
  }
}

/* ---------- command palette ---------- */
const palette = $("#palette"), pInput = $("#palette-input"), pList = $("#palette-list");
let pItems = [], pFiltered = [], pIndex = 0;
function buildPalette() {
  const gh = `https://github.com/${SITE.githubUser}`;
  pItems = [
    ...$$(".chapter").map((c) => ({ group: "Chapter", label: c.dataset.chapter, hint: c.querySelector("h1, h2")?.textContent || "", run: () => c.scrollIntoView({ behavior: "smooth" }) })),
    ...PROJECTS.map((p) => ({ group: (p.group || "kaggle") === "kaggle" ? "Kaggle" : "Build", label: p.title, hint: p.private ? p.repo + " · private" : p.repo, run: () => p.private ? $("#builds").scrollIntoView({ behavior: "smooth" }) : open(`${gh}/${p.repo}`, "_blank", "noopener") })),
    ...repoCache.filter((r) => !r.fork && !PROJECTS.some((p) => p.repo === r.name) && !(SITE.hideFromActivity || []).includes(r.name)).slice(0, 8).map((r) => ({ group: "Repo", label: r.name, hint: r.description || relTime(r.pushed_at), run: () => open(r.html_url, "_blank", "noopener") })),
    { group: "Action", label: "Toggle light / dark", hint: "theme", run: toggleTheme },
    { group: "Action", label: "Copy email", hint: SITE.email, run: () => navigator.clipboard?.writeText(SITE.email) },
    { group: "Action", label: "Open GitHub profile", hint: "@" + SITE.githubUser, run: () => open(gh, "_blank", "noopener") },
    { group: "Action", label: "Open LinkedIn", hint: "", run: () => open(SITE.linkedin, "_blank", "noopener") },
  ];
}
function paletteRender() {
  const q = pInput.value.trim().toLowerCase();
  pFiltered = pItems.filter((i) => !q || (i.label + " " + i.hint + " " + i.group).toLowerCase().includes(q));
  pIndex = Math.min(pIndex, Math.max(0, pFiltered.length - 1));
  pList.replaceChildren(...pFiltered.map((i, k) => el("li", { role: "option", "aria-selected": String(k === pIndex), onclick: () => paletteRun(i), onmousemove: () => { if (pIndex !== k) { pIndex = k; paletteRender(); } } }, [
    el("span", { class: "p-group" }, i.group), el("span", { class: "p-label" }, i.label), el("span", { class: "p-hint" }, i.hint),
  ])));
  if (!pFiltered.length) pList.append(el("li", { class: "p-empty" }, "Nothing matches."));
}
function paletteRun(i) { palette.close(); i.run(); }
function paletteOpen() { pInput.value = ""; pIndex = 0; paletteRender(); palette.showModal(); pInput.focus(); }
pInput.addEventListener("input", () => { pIndex = 0; paletteRender(); });
pInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); pIndex = (pIndex + 1) % pFiltered.length; paletteRender(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); pIndex = (pIndex - 1 + pFiltered.length) % pFiltered.length; paletteRender(); }
  else if (e.key === "Enter" && pFiltered[pIndex]) paletteRun(pFiltered[pIndex]);
});
palette.addEventListener("click", (e) => { if (e.target === palette) palette.close(); });
$("#palette-btn").addEventListener("click", paletteOpen);
addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.open ? palette.close() : paletteOpen(); }
  else if (e.key === "/" && !palette.open && !modal.open && !/input|textarea/i.test(document.activeElement?.tagName)) { e.preventDefault(); paletteOpen(); }
});

/* ---------- motion: reveal, tilt, magnet, glow, progress, dots, timeline draw ---------- */
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) {
    e.target.classList.add("in");
    const h = e.target.matches("h2") ? e.target : e.target.querySelector("h2");
    if (h) scramble(h);
    revealIO.unobserve(e.target);
  }
}, { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
function observeReveals() { for (const n of $$(".reveal:not(.in)")) revealIO.observe(n); }
// Safety net for fast scrolling: anything already above the fold is shown, observer or not.
function sweepReveals() {
  for (const n of $$(".reveal:not(.in)")) if (n.getBoundingClientRect().top < innerHeight * 0.95) { n.classList.add("in"); const h = n.matches("h2") ? n : n.querySelector("h2"); if (h) scramble(h); revealIO.unobserve(n); }
}

function bindTilt() {
  if (TOUCH || REDUCED) return;
  for (const c of $$(".tilt:not([data-tilt])")) {
    c.dataset.tilt = "1";
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `perspective(900px) rotateX(${-y * 6}deg) rotateY(${x * 8}deg) translateY(-2px)`;
      c.style.setProperty("--mx", `${(x + 0.5) * 100}%`); c.style.setProperty("--my", `${(y + 0.5) * 100}%`);
    });
    c.addEventListener("pointerleave", () => { c.style.transform = ""; });
  }
}
function bindMagnet() {
  if (TOUCH || REDUCED) return;
  for (const b of $$(".hero .btn, .chip, .contact .c").filter((b) => !b.dataset.mag)) {
    b.dataset.mag = "1";
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  }
}
if (!TOUCH && !REDUCED) {
  const glow = $("#glow");
  let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
  addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; glow.style.opacity = 1; });
  (function loop() { gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12; glow.style.transform = `translate(${gx}px, ${gy}px)`; requestAnimationFrame(loop); })();
}

const chapters = $$(".chapter");
const dots = $("#dots");
dots.replaceChildren(...chapters.map((c) => el("a", { href: `#${c.id}`, "data-label": c.dataset.chapter, "aria-label": c.dataset.chapter })));
const chapterIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) for (const d of dots.children) d.classList.toggle("active", d.getAttribute("href") === `#${e.target.id}`);
}, { rootMargin: "-45% 0px -45% 0px" });
chapters.forEach((c) => chapterIO.observe(c));

const timeline = $("#timeline");
addEventListener("scroll", () => {
  const h = document.documentElement;
  $("#progress").style.width = `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`;
  if (!REDUCED) $("#sky").style.transform = `translateY(${h.scrollTop * 0.25}px)`;
  // timeline draws itself as it enters the viewport
  const r = timeline.getBoundingClientRect();
  const p = Math.max(0, Math.min(1, (innerHeight * 0.8 - r.top) / r.height));
  timeline.style.setProperty("--draw", p.toFixed(3));
  sweepReveals();
}, { passive: true });

/* ---------- the living sky ---------- */
function moonPhase(date = new Date()) {
  // fraction of synodic month since a known new moon (2000-01-06 18:14 UTC)
  const synodic = 29.530588853, days = (date - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return ((days % synodic) + synodic) % synodic / synodic; // 0 new, .5 full
}
function sky() {
  const canvas = $("#sky"), ctx = canvas.getContext("2d");
  const hero = $(".hero");
  let w, h, dpr, pts = [], meteors = [], drops = [], clouds = [], mouse = { x: -1e9, y: -1e9 }, running = true, raf;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = Array.from({ length: Math.round((w * h) / 14000) }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.85, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.1, r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2 }));
    clouds = Array.from({ length: 5 }, () => ({ x: Math.random() * w, y: h * (0.1 + Math.random() * 0.35), rx: 120 + Math.random() * 160, ry: 30 + Math.random() * 30, v: 0.08 + Math.random() * 0.12, a: 0.05 + Math.random() * 0.06 }));
  };
  const kind = () => { const c = wx.code; if (c === null) return "clear"; if ([45, 48].includes(c)) return "fog"; if (c >= 71 && c <= 77 || c === 85 || c === 86) return "snow"; if (c >= 51) return "rain"; if (c === 2 || c === 3) return "cloud"; return "clear"; };
  const drawMoon = () => {
    // position follows Vilnius time: rises at the left, sets at the right
    const { frac } = vilniusNow();
    const isDay = wx.isDay ?? (frac > 0.25 && frac < 0.83);
    const t = isDay ? (frac - 0.25) / 0.58 : ((frac + 0.17) % 1) / 0.42; // 0..1 across the sky
    const x = w * (0.15 + 0.7 * Math.min(1, Math.max(0, t))), y = h * (0.45 - 0.33 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
    if (isDay) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 120);
      g.addColorStop(0, "rgba(255,214,150,.55)"); g.addColorStop(0.3, "rgba(255,170,120,.18)"); g.addColorStop(1, "rgba(255,150,120,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,236,200,.9)"; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      return 0.35;
    }
    const r = 22, ph = moonPhase();
    const g = ctx.createRadialGradient(x, y, r, x, y, r * 4);
    g.addColorStop(0, "rgba(230,220,255,.22)"); g.addColorStop(1, "rgba(230,220,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#efe9ff"; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    // shadow: an offset disc whose horizontal squash follows the phase
    const k = Math.cos(ph * Math.PI * 2); // 1 new, -1 full
    ctx.fillStyle = "rgba(25,22,50,.96)";
    ctx.beginPath();
    if (ph < 0.5) { ctx.ellipse(x, y, r, r, 0, -Math.PI / 2, Math.PI / 2); ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k < 0); }
    else { ctx.ellipse(x, y, r, r, 0, Math.PI / 2, -Math.PI / 2); ctx.ellipse(x, y, Math.abs(k) * r, r, 0, -Math.PI / 2, Math.PI / 2, k < 0); }
    ctx.fill(); ctx.restore();
    return 1;
  };
  const draw = (t) => {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    const k = kind();
    const starAlpha = drawMoon() * (k === "clear" ? 1 : k === "cloud" ? 0.6 : 0.35);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h * 0.85) p.vy *= -1;
      const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
      if (d < 140) { p.x -= dx / d * 0.6; p.y -= dy / d * 0.6; }
      ctx.fillStyle = `rgba(255,255,255,${(0.45 + 0.45 * Math.sin(t / 900 + p.tw)) * starAlpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 0.6;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 110) { ctx.strokeStyle = `rgba(201,162,255,${(1 - d / 110) * 0.35 * starAlpha})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    for (const p of pts) { const d = Math.hypot(mouse.x - p.x, mouse.y - p.y); if (d < 180) { ctx.strokeStyle = `rgba(245,163,184,${(1 - d / 180) * 0.5})`; ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.x, p.y); ctx.stroke(); } }
    // weather layers
    if (k === "cloud" || k === "fog" || k === "rain" || k === "snow") for (const c of clouds) {
      c.x += c.v; if (c.x - c.rx > w) c.x = -c.rx;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
      g.addColorStop(0, `rgba(210,200,240,${c.a * (k === "fog" ? 2.2 : 1)})`); g.addColorStop(1, "rgba(210,200,240,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (k === "fog") { const g = ctx.createLinearGradient(0, h * 0.5, 0, h); g.addColorStop(0, "rgba(200,190,230,0)"); g.addColorStop(1, "rgba(200,190,230,.22)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    if (k === "rain" || k === "snow") {
      const snow = k === "snow";
      while (drops.length < (snow ? 90 : 140)) drops.push({ x: Math.random() * w, y: Math.random() * h, v: snow ? 0.5 + Math.random() : 6 + Math.random() * 5, s: Math.random() });
      for (const d of drops) {
        d.y += d.v; d.x += snow ? Math.sin(t / 700 + d.s * 10) * 0.4 : 0.8;
        if (d.y > h) { d.y = -10; d.x = Math.random() * w; }
        if (snow) { ctx.fillStyle = `rgba(255,255,255,${0.35 + d.s * 0.4})`; ctx.beginPath(); ctx.arc(d.x, d.y, 1 + d.s * 1.6, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = `rgba(200,210,255,${0.18 + d.s * 0.25})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.5, d.y - 14 - d.s * 10); ctx.stroke(); }
      }
    } else drops = [];
    // shooting stars
    if (k === "clear" && Math.random() < 0.004) meteors.push({ x: Math.random() * w, y: Math.random() * h * 0.3, vx: -(4 + Math.random() * 3), vy: 2 + Math.random() * 2, life: 1 });
    for (const m of meteors) {
      m.x += m.vx; m.y += m.vy; m.life -= 0.02;
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
      g.addColorStop(0, `rgba(255,255,255,${m.life})`); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12); ctx.stroke();
    }
    meteors = meteors.filter((m) => m.life > 0);
    raf = requestAnimationFrame(draw);
  };
  resize(); addEventListener("resize", resize);
  hero.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  hero.addEventListener("pointerleave", () => { mouse.x = mouse.y = -1e9; });
  new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) raf = requestAnimationFrame(draw); else cancelAnimationFrame(raf); }).observe(hero);
  // easter egg: click the avatar three times for a meteor shower
  let clicks = 0, timer;
  $("#avatar").addEventListener("click", () => {
    clicks++; clearTimeout(timer); timer = setTimeout(() => (clicks = 0), 800);
    if (clicks >= 3) { clicks = 0; for (let i = 0; i < 40; i++) setTimeout(() => meteors.push({ x: Math.random() * w, y: Math.random() * h * 0.4, vx: -(4 + Math.random() * 4), vy: 2 + Math.random() * 3, life: 1 }), i * 60); }
  });
}

/* ---------- theme ---------- */
function toggleTheme() {
  const root = document.documentElement;
  const next = (root.dataset.theme || "dark") === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
}
$("#theme-toggle").addEventListener("click", toggleTheme);

/* ---------- go ---------- */
renderStatic();
typewriter($("#typewriter"), SITE.roles);
clock(); setInterval(clock, 30_000);
weather();
renderProjects();
renderProfile();
observeReveals();
bindMagnet();
if (!REDUCED) sky();
