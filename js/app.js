/*
 * app.js — a scroll-driven, live portfolio.
 *
 *  Data:   GitHub REST API (profile, repos, languages, README, public events)
 *          Open-Meteo (current weather in Vilnius, no key)
 *  Cache:  localStorage, 1 hour for GitHub, 30 min for weather
 *  Motion: constellation canvas, typewriter, count-up, reveal-on-scroll,
 *          card tilt, cursor glow, chapter dots, progress bar
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

/* ---------- tiny DOM helpers ---------- */
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

/* ---------- fetch layer with cache + meter ---------- */
const meter = { live: 0, cache: 0, remaining: null };
let rateLimited = false;

async function cachedFetch(url, ttl = TTL_GH, headers = { Accept: "application/vnd.github+json" }) {
  const key = "gh:" + url;
  try {
    const hit = JSON.parse(localStorage.getItem(key));
    if (hit && Date.now() - hit.t < ttl) {
      meter.cache++; renderMeter();
      if (hit.s === 404) throw Object.assign(new Error("not found (cached)"), { status: 404 });
      return hit.v;
    }
  } catch (e) { if (e.status === 404) throw e; }
  const res = await fetch(url, { headers });
  meter.live++;
  const rem = res.headers.get("x-ratelimit-remaining");
  if (rem !== null) meter.remaining = Number(rem);
  renderMeter();
  if (res.status === 403 || res.status === 429) {
    if (rem === "0") rateLimited = true;
    throw Object.assign(new Error("rate limited"), { status: res.status });
  }
  if (res.status === 404) {
    // Remember misses too (private repos), so a reload doesn't spend API budget on them.
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), s: 404 })); } catch (e) {}
    throw Object.assign(new Error("not found"), { status: 404 });
  }
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
  const data = await res.json();
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: data })); } catch (e) {}
  return data;
}
function renderMeter() {
  $("#m-live").textContent = meter.live;
  $("#m-cache").textContent = meter.cache;
  $("#m-limit").textContent = meter.remaining ?? "…";
}
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
  $("#site-repo").href = `${gh}/${SITE.githubUser}.github.io`;
  $("#avatar").alt = SITE.name;
  $("#avatar").src = `https://github.com/${SITE.githubUser}.png?size=320`;
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

/* ---------- local time + weather ---------- */
const WX = { 0: "clear ☀️", 1: "mostly clear 🌤", 2: "partly cloudy ⛅", 3: "overcast ☁️", 45: "fog 🌫", 48: "fog 🌫", 51: "drizzle 🌦", 53: "drizzle 🌦", 55: "drizzle 🌧", 61: "rain 🌧", 63: "rain 🌧", 65: "heavy rain 🌧", 71: "snow 🌨", 73: "snow 🌨", 75: "snow ❄️", 80: "showers 🌦", 81: "showers 🌧", 82: "showers ⛈", 95: "thunderstorm ⛈" };
function clock() {
  const t = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: SITE.timezone }).format(new Date());
  const h = Number(t.slice(0, 2));
  const part = h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  $("#local-time").textContent = `${t} in ${SITE.location.split(",")[0]} · good ${part}`;
}
async function weather() {
  try {
    const { lat, lon } = SITE.coords;
    const d = await cachedFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`, TTL_WX, {});
    const c = d.current;
    $("#weather").textContent = `· ${Math.round(c.temperature_2m)}°C, ${WX[c.weather_code] || "changeable"}`;
  } catch (e) { /* weather is decoration; fail silently */ }
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

/* ---------- profile, stats, activity, donut, timeline, feed ---------- */
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
    renderActivity(repos);
    renderTimeline(repos);
    renderDonut(repos);
    renderFeed();
  } catch (e) {
    for (const k of ["repos", "followers", "stars", "commits"]) countUp($(`[data-stat="${k}"]`), "—");
    renderTimeline([]);
    showNotice(rateLimited
      ? "GitHub API limit reached for your network. Live numbers return within the hour."
      : "Could not reach the GitHub API. Showing curated content only.");
  }
}

function renderActivity(repos) {
  const hide = new Set([...(SITE.hideFromActivity || []), ...PROJECTS.map((p) => p.repo)]);
  const shown = repos.filter((r) => !r.fork && !hide.has(r.name)).slice(0, 6);
  $("#activity-list").replaceChildren(...shown.map((r) =>
    el("a", { class: "act tilt", href: r.html_url, target: "_blank", rel: "noopener" }, [
      el("div", { class: "name" }, [r.name, r.stargazers_count ? el("span", { class: "pill" }, `★ ${r.stargazers_count}`) : null]),
      el("div", { class: "desc" }, r.description || ""),
      el("div", { class: "foot" }, [
        r.language ? el("span", { html: `<i style="background:${langColor(r.language)}"></i>${r.language}` }) : null,
        el("span", {}, relTime(r.pushed_at)),
      ]),
    ])
  ));
  bindTilt();
}

/* Journey: static milestones + Kaggle repos by created date + "now" from latest push. */
function renderTimeline(repos) {
  const byName = Object.fromEntries(repos.map((r) => [r.name, r]));
  const items = JOURNEY.map((j) => ({ ...j, sort: j.when + "-01" }));
  for (const p of PROJECTS) {
    const r = byName[p.repo];
    const iso = r?.created_at?.slice(0, 7) || p.started;
    if (!iso) continue;
    items.push({ when: new Date(iso + "-01").toLocaleDateString("en", { month: "short", year: "numeric" }), title: p.title, note: "Kaggle · " + (p.kaggleLabel || "project"), sort: iso, kaggle: true, href: "#projects" });
  }
  const latest = repos[0];
  if (latest) items.push({ when: "Now", title: `Working on ${latest.name}`, note: `last push ${relTime(latest.pushed_at)}`, sort: "9999", now: true, href: latest.html_url });
  items.sort((a, b) => a.sort.localeCompare(b.sort));
  $("#timeline").replaceChildren(...items.map((it) =>
    el("li", { class: "tl reveal" + (it.kaggle ? " kaggle" : "") + (it.now ? " now" : "") }, [
      el("span", { class: "tl-when" }, it.when),
      el("div", { class: "tl-body" }, [
        it.href ? el("a", { class: "tl-title", href: it.href, target: it.href.startsWith("#") ? null : "_blank", rel: "noopener" }, it.title) : el("span", { class: "tl-title" }, it.title),
        el("span", { class: "tl-note" }, it.note),
      ]),
    ])
  ));
  observeReveals();
}

/* Language donut across all public, non-fork repos. */
async function renderDonut(repos) {
  const own = repos.filter((r) => !r.fork).slice(0, 12);
  const totals = {};
  await Promise.all(own.map(async (r) => {
    try { const l = await cachedFetch(`${API}/repos/${SITE.githubUser}/${r.name}/languages`); for (const [k, v] of Object.entries(l)) totals[k] = (totals[k] || 0) + v; } catch (e) {}
  }));
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((a, [, v]) => a + v, 0) || 1;
  let acc = 0;
  const stops = entries.map(([n, v]) => { const from = acc; acc += (v / sum) * 100; return `${langColor(n)} ${from}% ${acc}%`; });
  const donut = $("#donut");
  donut.style.setProperty("--pie", `conic-gradient(${stops.join(",")})`);
  donut.classList.add("ready");
  $("#donut-total").textContent = fmt(sum);
  $("#donut-key").replaceChildren(...entries.slice(0, 6).map(([n, v]) =>
    el("li", { html: `<i style="background:${langColor(n)}"></i>${n} <b>${(v / sum) * 100 < 1 ? "<1" : ((v / sum) * 100).toFixed(0)}%</b>` })
  ));
}

/* Commit feed: latest commits from the most recently pushed public repos,
   plus a public-commit count for the year from the search API (separate rate bucket). */
async function renderFeed() {
  const feed = $("#feed");
  const year = new Date().getFullYear();
  cachedFetch(`${API}/search/commits?q=author:${SITE.githubUser}+committer-date:>${year}-01-01&per_page=1`)
    .then((r) => countUp($('[data-stat="commits"]'), r.total_count))
    .catch(() => countUp($('[data-stat="commits"]'), "—"));
  try {
    const recent = repoCache.filter((r) => !r.fork).slice(0, 4);
    const lists = await Promise.all(recent.map((r) => cachedFetch(`${API}/repos/${SITE.githubUser}/${r.name}/commits?per_page=3`).then((c) => c.map((x) => ({ ...x, repo: r.name }))).catch(() => [])));
    const commits = lists.flat().sort((a, b) => b.commit.author.date.localeCompare(a.commit.author.date)).slice(0, 6);
    if (!commits.length) throw new Error("empty");
    feed.replaceChildren(...commits.map((c) => el("li", { class: "reveal" }, [
      el("a", { class: "feed-msg", href: c.html_url, target: "_blank", rel: "noopener", title: c.commit.message }, c.commit.message.split("\n")[0]),
      el("span", { class: "feed-meta" }, [el("b", {}, c.repo), ` · ${relTime(c.commit.author.date)} · `, el("code", {}, c.sha.slice(0, 7))]),
    ])));
    observeReveals();
  } catch (e) {
    feed.replaceChildren(el("li", { class: "feed-meta" }, rateLimited ? "API limit reached; commits return within the hour." : "No public commits to show."));
  }
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
    el("div", { class: "card-foot" }, [
      el("a", { class: "btn btn-sm", href: repoUrl, target: "_blank", rel: "noopener" }, [icon("i-github"), "Code"]),
      ...(p.notebooks || []).map((n) => el("a", { class: "btn btn-sm", href: `${repoUrl}/blob/main/${encodeURI(n.path)}`, target: "_blank", rel: "noopener", "data-role": "notebook" }, [icon("i-notebook"), n.label])),
      el("button", { class: "btn btn-sm", type: "button", "data-role": "readme", onclick: () => openReadme(p) }, [icon("i-book"), "README"]),
    ]),
  );
  return card;
}

async function hydrateCard(p, card) {
  const status = $('[data-role="status"]', card), meta = $('[data-role="meta"]', card), bar = $('[data-role="langbar"]', card);
  const base = `${API}/repos/${SITE.githubUser}/${p.repo}`;
  try {
    const [repo, langs] = await Promise.all([cachedFetch(base), cachedFetch(`${base}/languages`)]);
    status.textContent = repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : "Public";
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
    if (e.status === 404) {
      status.textContent = "Private"; status.classList.add("private");
      meta.replaceChildren(el("span", {}, "Code on request."));
      $('[data-role="readme"]', card).remove();
      for (const a of $$('[data-role="notebook"]', card)) a.remove();
    } else {
      status.textContent = rateLimited ? "Paused" : "Offline";
      meta.replaceChildren(el("span", {}, rateLimited ? "API limit reached." : "Stats unavailable."));
    }
  }
}

function renderProjects() {
  const grid = $("#project-grid");
  const cards = PROJECTS.map((p) => { const c = projectCard(p); grid.append(c); return [p, c]; });
  renderFilters(cards.map(([, c]) => c));
  cards.forEach(([p, c], i) => setTimeout(() => hydrateCard(p, c), i * 120));
  bindTilt();
}

function renderFilters(cards) {
  const tags = [...new Set(PROJECTS.flatMap((p) => p.tags || []))].sort();
  const bar = $("#filters");
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
    const data = await cachedFetch(`${API}/repos/${SITE.githubUser}/${p.repo}/readme`);
    const md = new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
    body.innerHTML = DOMPurify.sanitize(marked.parse(md), { ADD_ATTR: ["target"] });
    const blobBase = data.html_url.replace(/\/README\.md$/i, "/");
    for (const a of $$("a[href]", body)) {
      const href = a.getAttribute("href");
      if (!/^(https?:|mailto:|#)/i.test(href)) a.href = new URL(href, blobBase).href;
      if (!href.startsWith("#")) { a.target = "_blank"; a.rel = "noopener"; }
    }
  } catch (e) {
    body.innerHTML = `<p style="color:var(--text-muted)">Could not load the README. <a href="https://github.com/${SITE.githubUser}/${p.repo}" target="_blank" rel="noopener">Open on GitHub</a>.</p>`;
  }
}

/* ---------- motion: reveal, tilt, glow, progress, dots ---------- */
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
}, { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
function observeReveals() { for (const n of $$(".reveal:not(.in)")) revealIO.observe(n); }

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

addEventListener("scroll", () => {
  const h = document.documentElement;
  $("#progress").style.width = `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`;
  // parallax: the sky drifts slower than the page
  if (!REDUCED) $("#sky").style.transform = `translateY(${h.scrollTop * 0.25}px)`;
}, { passive: true });

/* ---------- constellation sky ---------- */
function sky() {
  const canvas = $("#sky"), ctx = canvas.getContext("2d");
  const hero = $(".hero");
  let w, h, dpr, pts = [], meteors = [], mouse = { x: -1e9, y: -1e9 }, running = true, raf;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 14000);
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.85, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.1, r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2 }));
  };
  const draw = (t) => {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h * 0.85) p.vy *= -1;
      const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
      if (d < 140) { p.x -= dx / d * 0.6; p.y -= dy / d * 0.6; }
      const a = 0.45 + 0.45 * Math.sin(t / 900 + p.tw);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 0.6;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 110) { ctx.strokeStyle = `rgba(201,162,255,${(1 - d / 110) * 0.35})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    // mouse links
    for (const p of pts) { const d = Math.hypot(mouse.x - p.x, mouse.y - p.y); if (d < 180) { ctx.strokeStyle = `rgba(245,163,184,${(1 - d / 180) * 0.5})`; ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.x, p.y); ctx.stroke(); } }
    // shooting stars
    if (Math.random() < 0.004) meteors.push({ x: Math.random() * w, y: Math.random() * h * 0.3, vx: -(4 + Math.random() * 3), vy: 2 + Math.random() * 2, life: 1 });
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
}

/* ---------- theme ---------- */
$("#theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  const next = (root.dataset.theme || "dark") === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
});

/* ---------- go ---------- */
renderStatic();
typewriter($("#typewriter"), SITE.roles);
clock(); setInterval(clock, 30_000);
weather();
renderProjects();
renderProfile();
observeReveals();
if (!REDUCED) sky();
