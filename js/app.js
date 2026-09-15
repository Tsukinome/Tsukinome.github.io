/*
 * app.js — turns the static config in projects.js into a live portfolio.
 *
 * Data flow:
 *   1. Read SITE + PROJECTS from projects.js (hand-written).
 *   2. Fetch profile, repo metadata, languages and READMEs from api.github.com.
 *   3. Cache every response in localStorage for an hour (anonymous limit is 60/h).
 *   4. Render. If a repo is private or the limit is hit, fall back to curated text.
 */

const API = "https://api.github.com";
const CACHE_TTL_MS = 60 * 60 * 1000;

const LANG_COLORS = {
  "Jupyter Notebook": "#DA5B0B", Python: "#3572A5", HTML: "#e34c26", CSS: "#563d7c",
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Shell: "#89e051", R: "#198CE7",
  SQL: "#e38c00", Dockerfile: "#384d54", Makefile: "#427819", Markdown: "#083fa1",
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};
const icon = (id) => {
  // SVG needs its own namespace; document.createElement would make an inert HTML element.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
};
const fmt = (n) => new Intl.NumberFormat("en", { notation: "compact" }).format(n);

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, secs] of units) if (diff >= secs) return rtf.format(-Math.floor(diff / secs), unit);
  return "just now";
}

/* ---------- Fetch with cache + rate-limit awareness ---------- */
let rateLimited = false;

async function cachedFetch(url) {
  const key = "gh:" + url;
  try {
    const hit = JSON.parse(localStorage.getItem(key));
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
  } catch (e) { /* ignore corrupt cache */ }

  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get("x-ratelimit-remaining") === "0") rateLimited = true;
    throw Object.assign(new Error("rate limited"), { status: res.status });
  }
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
  const data = await res.json();
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: data })); } catch (e) { /* storage full or blocked */ }
  return data;
}

function showNotice(text) {
  const n = $("#notice");
  n.textContent = text;
  n.classList.add("show");
}

/* ---------- Static bits from SITE ---------- */
function renderStatic() {
  const gh = `https://github.com/${SITE.githubUser}`;
  $("#name").textContent = SITE.name;
  $("#brand-name").textContent = SITE.name;
  $("#footer-name").textContent = `© ${new Date().getFullYear()} ${SITE.name}`;
  $("#tagline").textContent = SITE.tagline;
  $("#intro").textContent = SITE.intro;
  $("#gh-profile").href = gh;
  $("#li-profile").href = SITE.linkedin;
  $("#c-linkedin").href = SITE.linkedin;
  $("#c-github").href = gh;
  $("#c-github-text").textContent = "@" + SITE.githubUser;
  $("#c-email").href = "mailto:" + SITE.email;
  $("#c-email-text").textContent = SITE.email;
  $("#c-location").textContent = SITE.location;
  $("#site-repo").href = `${gh}/${SITE.githubUser}.github.io`;
  $("#avatar").alt = SITE.name;
}

/* ---------- Profile + stats ---------- */
async function renderProfile() {
  try {
    const [user, repos] = await Promise.all([
      cachedFetch(`${API}/users/${SITE.githubUser}`),
      cachedFetch(`${API}/users/${SITE.githubUser}/repos?per_page=100&sort=pushed`),
    ]);
    $("#avatar").src = user.avatar_url;
    const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);
    const latest = repos[0];
    setStat("repos", user.public_repos);
    setStat("followers", user.followers);
    setStat("stars", stars);
    setStat("active", relTime(latest?.pushed_at));
    $('[data-stat="active-sub"]').textContent = latest ? `pushed to ${latest.name}` : "";
    $("#footer-updated").textContent = `Live data via GitHub API · loaded ${new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`;
    renderActivity(repos);
  } catch (e) {
    for (const k of ["repos", "followers", "stars", "active"]) setStat(k, "—");
    $("#avatar").src = `https://github.com/${SITE.githubUser}.png?size=300`;
    showNotice(rateLimited
      ? "GitHub API rate limit reached for your network. Live numbers will return within the hour; curated content is unaffected."
      : "Could not reach the GitHub API. Showing curated content only.");
  }
}
function setStat(name, value) {
  const node = $(`[data-stat="${name}"]`);
  node.textContent = typeof value === "number" ? fmt(value) : value;
  node.classList.remove("skel");
}

/* ---------- Auto-generated activity list ---------- */
function renderActivity(repos) {
  const list = $("#activity-list");
  const hide = new Set([...(SITE.hideFromActivity || []), ...PROJECTS.map((p) => p.repo)]);
  const shown = repos.filter((r) => !r.fork && !hide.has(r.name)).slice(0, 6);
  list.replaceChildren(...shown.map((r) =>
    el("a", { class: "act", href: r.html_url, target: "_blank", rel: "noopener" }, [
      el("div", { class: "name" }, [r.name, r.stargazers_count ? el("span", { class: "pill" }, `★ ${r.stargazers_count}`) : null]),
      el("div", { class: "desc" }, r.description || "No description yet."),
      el("div", { class: "foot" }, [
        r.language ? el("span", { html: `<i style="background:${LANG_COLORS[r.language] || "#999"}"></i>${r.language}` }) : null,
        el("span", {}, `Updated ${relTime(r.pushed_at)}`),
      ]),
    ])
  ));
  if (!shown.length) list.replaceChildren(el("p", { style: "color:var(--text-muted)" }, "No public activity to show."));
}

/* ---------- Project cards ---------- */
function projectCard(p) {
  const repoUrl = `https://github.com/${SITE.githubUser}/${p.repo}`;
  const card = el("article", { class: "card" + (p.featured ? " featured" : ""), "data-tags": (p.tags || []).join("|") });

  card.append(
    el("div", { class: "card-head" }, [
      el("div", { class: "card-kicker" }, [
        p.kaggle ? el("a", { class: "kaggle-badge", href: p.kaggle, target: "_blank", rel: "noopener" }, [icon("i-kaggle"), p.kaggleLabel || "Kaggle"]) : null,
        el("span", { class: "pill", "data-role": "status" }, "loading…"),
      ]),
      el("h3", {}, el("a", { href: repoUrl, target: "_blank", rel: "noopener" }, p.title || p.repo)),
      el("p", { class: "summary" }, p.summary || ""),
    ]),
    el("div", { class: "card-body" }, [
      p.highlights?.length ? el("ul", {}, p.highlights.map((h) => el("li", {}, h))) : null,
      el("div", { class: "tags" }, (p.tags || []).map((t) => el("span", { class: "tag" }, t))),
    ]),
    el("div", { class: "card-meta" }, [
      el("div", { class: "meta-row", "data-role": "meta" }, el("span", { class: "skel" }, "loading metadata…")),
      el("div", { class: "langbar skel", "data-role": "langbar" }),
      el("div", { class: "langkey", "data-role": "langkey" }),
    ]),
    el("div", { class: "card-foot" }, [
      el("a", { class: "btn btn-sm", href: repoUrl, target: "_blank", rel: "noopener" }, [icon("i-github"), "Repository"]),
      ...(p.notebooks || []).map((n) => el("a", { class: "btn btn-sm", href: `${repoUrl}/blob/main/${encodeURI(n.path)}`, target: "_blank", rel: "noopener", "data-role": "notebook" }, [icon("i-notebook"), n.label])),
      el("button", { class: "btn btn-sm", type: "button", "data-role": "readme", onclick: () => openReadme(p) }, [icon("i-book"), "Read README"]),
    ]),
  );
  return card;
}

async function hydrateCard(p, card) {
  const status = $('[data-role="status"]', card);
  const meta = $('[data-role="meta"]', card);
  const bar = $('[data-role="langbar"]', card);
  const key = $('[data-role="langkey"]', card);
  const base = `${API}/repos/${SITE.githubUser}/${p.repo}`;

  try {
    const [repo, langs] = await Promise.all([cachedFetch(base), cachedFetch(`${base}/languages`)]);

    status.textContent = repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? `${repo.license.spdx_id} licence` : "Public";
    meta.replaceChildren(
      el("span", {}, [icon("i-star"), `${repo.stargazers_count} stars`]),
      el("span", {}, [icon("i-fork"), `${repo.forks_count} forks`]),
      el("span", {}, [icon("i-clock"), `Updated ${relTime(repo.pushed_at)}`]),
      el("span", {}, `${fmt(repo.size * 1024)}B`),
    );

    const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
    const entries = Object.entries(langs).sort((a, b) => b[1] - a[1]);
    bar.classList.remove("skel");
    bar.replaceChildren(...entries.map(([name, bytes]) =>
      el("span", { style: `width:${(bytes / total) * 100}%;background:${LANG_COLORS[name] || "#999"}`, title: `${name} ${((bytes / total) * 100).toFixed(1)}%` })
    ));
    key.replaceChildren(...entries.map(([name, bytes]) =>
      el("span", { html: `<i style="background:${LANG_COLORS[name] || "#999"}"></i>${name} ${((bytes / total) * 100).toFixed(0)}%` })
    ));
    // Notebook links assume "main"; correct if the default branch differs.
    if (repo.default_branch && repo.default_branch !== "main") {
      for (const a of card.querySelectorAll('[data-role="notebook"]')) a.href = a.href.replace("/blob/main/", `/blob/${repo.default_branch}/`);
    }
  } catch (e) {
    bar.remove(); key.remove();
    if (e.status === 404) {
      status.textContent = "Private repository";
      status.classList.add("private");
      meta.replaceChildren(el("span", {}, "Code available on request. Live stats are hidden for private repos."));
      $('[data-role="readme"]', card).remove();
      for (const a of card.querySelectorAll('[data-role="notebook"]')) a.remove();
    } else {
      status.textContent = rateLimited ? "Live data paused" : "Offline";
      meta.replaceChildren(el("span", {}, rateLimited ? "GitHub API rate limit reached; stats will return within the hour." : "Could not load live stats."));
    }
  }
}

function renderProjects() {
  const grid = $("#project-grid");
  const cards = PROJECTS.map((p) => {
    const card = projectCard(p);
    grid.append(card);
    return [p, card];
  });
  renderFilters(cards.map(([, c]) => c));
  // Stagger requests slightly so the browser doesn't fire everything at once.
  cards.forEach(([p, card], i) => setTimeout(() => hydrateCard(p, card), i * 120));
}

/* ---------- Tag filters ---------- */
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
    const html = DOMPurify.sanitize(marked.parse(md), { ADD_ATTR: ["target"] });
    body.innerHTML = html;
    // Relative links inside the README should point back at GitHub.
    const blobBase = data.html_url.replace(/\/README\.md$/i, "/");
    for (const a of body.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!/^(https?:|mailto:|#)/i.test(href)) a.href = new URL(href, blobBase).href;
      if (!href.startsWith("#")) { a.target = "_blank"; a.rel = "noopener"; }
    }
  } catch (e) {
    body.innerHTML = `<p style="color:var(--text-muted)">Could not load the README${e.status === 404 ? " (repository is private)" : ""}. <a href="https://github.com/${SITE.githubUser}/${p.repo}" target="_blank" rel="noopener">Open it on GitHub</a>.</p>`;
  }
}

/* ---------- Theme toggle ---------- */
$("#theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme || (systemDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
});

/* ---------- Go ---------- */
renderStatic();
renderProjects();
renderProfile();
