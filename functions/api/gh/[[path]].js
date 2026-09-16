/*
 * Cloudflare Pages Function: a narrow, cached, read-only proxy to the GitHub API.
 *
 * Why: anonymous browsers get 60 GitHub calls per hour per network. Routing the
 * page's calls through here means one token (5,000/hour) and one edge cache are
 * shared by every visitor, and private repos on the allow-list become visible.
 *
 * Allowed paths (GET only):
 *   ping
 *   users/<OWNER>                          profile
 *   users/<OWNER>/repos?...                public repo list
 *   repos/<OWNER>/<name>                   repo metadata (trimmed)
 *   repos/<OWNER>/<name>/languages
 *   repos/<OWNER>/<name>/readme
 *   repos/<OWNER>/<name>/commits?...
 *   repos/<OWNER>/<name>/git/trees/<ref>?recursive=1   file list for the code browser
 *   repos/<OWNER>/<name>/contents/<path>                one file (base64, <= 300 KB)
 *   search/commits?q=author:<OWNER>...
 *
 * Private repositories are served only if listed in PRIVATE_ALLOWED. The token
 * lives in the GITHUB_TOKEN secret and never reaches the browser.
 */

const OWNER = "Tsukinome";
const PRIVATE_ALLOWED = new Set(["loan", "weekly-board", "w11-task-wall"]);
const EDGE_TTL = 3600;      // seconds a GitHub response stays in Cloudflare's cache
const BROWSER_TTL = 300;    // seconds the browser may reuse it

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 ? `public, max-age=${BROWSER_TTL}` : "no-store", ...extra },
  });

const SAFE_QUERY = new Set(["per_page", "sort", "since", "author", "q", "page", "direction", "type", "recursive", "ref"]);
const MAX_FILE_BYTES = 300 * 1024;

function route(parts, query) {
  const [a, b, c, d, ...rest] = parts;
  if (a === "repos" && b === OWNER && c && d === "git" && rest[0] === "trees" && rest[1] && rest.length === 2)
    return { kind: "tree", name: c, path: `repos/${OWNER}/${c}/git/trees/${encodeURIComponent(rest[1])}` };
  if (a === "repos" && b === OWNER && c && d === "contents" && rest.length)
    return { kind: "file", name: c, path: `repos/${OWNER}/${c}/contents/${rest.map(encodeURIComponent).join("/")}` };
  if (rest.length) return null;
  if (a === "ping" && !b) return { kind: "ping" };
  if (a === "users" && b === OWNER && !c) return { kind: "user", path: `users/${OWNER}` };
  if (a === "users" && b === OWNER && c === "repos" && !d) return { kind: "repos", path: `users/${OWNER}/repos` };
  if (a === "repos" && b === OWNER && c && !d) return { kind: "repo", name: c, path: `repos/${OWNER}/${c}` };
  if (a === "repos" && b === OWNER && c && ["languages", "readme", "commits"].includes(d)) return { kind: d, name: c, path: `repos/${OWNER}/${c}/${d}` };
  if (a === "search" && b === "commits" && !c) {
    const q = query.get("q") || "";
    if (!q.includes(`author:${OWNER}`)) return null;
    return { kind: "search", path: "search/commits" };
  }
  return null;
}

async function github(path, query, env) {
  const url = new URL(`https://api.github.com/${path}`);
  for (const [k, v] of query) if (SAFE_QUERY.has(k)) url.searchParams.set(k, v);
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "tsukinome-portfolio-proxy",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

const trimRepo = (r) => ({
  name: r.name, description: r.description, html_url: r.html_url, private: r.private, fork: r.fork,
  stargazers_count: r.stargazers_count, forks_count: r.forks_count, size: r.size, language: r.language,
  created_at: r.created_at, pushed_at: r.pushed_at, default_branch: r.default_branch,
  license: r.license ? { spdx_id: r.license.spdx_id } : null,
});

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const r = route(params.path || [], url.searchParams);
  if (!r) return json({ message: "Not found" }, 404);
  if (r.kind === "ping") return json({ ok: true, proxy: "github", tokenConfigured: Boolean(env.GITHUB_TOKEN) }, 200, { "cache-control": "no-store" });
  if (!env.GITHUB_TOKEN) return json({ message: "Proxy not configured: GITHUB_TOKEN secret is missing" }, 503);

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  // A private repo must be on the allow-list. Check the repo's flag first for sub-resources.
  if (r.name && !PRIVATE_ALLOWED.has(r.name)) {
    const meta = await github(`repos/${OWNER}/${r.name}`, new URLSearchParams(), env);
    if (!meta.ok) return json({ message: `GitHub responded ${meta.status}` }, meta.status === 404 ? 404 : 502);
    if ((await meta.json()).private) return json({ message: "Not found" }, 404);
  }

  const res = await github(r.path, url.searchParams, env);
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (!res.ok) return json({ message: `GitHub responded ${res.status}` }, res.status === 404 ? 404 : res.status === 403 ? 429 : 502, { "x-gh-remaining": remaining ?? "" });
  const data = await res.json();

  let body;
  if (r.kind === "repo") body = trimRepo(data);
  else if (r.kind === "repos") body = data.map(trimRepo);
  else if (r.kind === "readme") body = { content: data.content, encoding: data.encoding, html_url: data.html_url };
  else if (r.kind === "commits") body = data.map((c) => ({ sha: c.sha, html_url: c.html_url, commit: { message: c.commit.message, author: { date: c.commit.author?.date } } }));
  else if (r.kind === "search") body = { total_count: data.total_count };
  else if (r.kind === "tree") body = { truncated: data.truncated, tree: data.tree.filter((t) => t.type === "blob").map((t) => ({ path: t.path, size: t.size })) };
  else if (r.kind === "file") {
    if (Array.isArray(data)) return json({ message: "Path is a directory" }, 400);
    if (data.size > MAX_FILE_BYTES) return json({ message: `File too large to preview (${data.size} bytes)` }, 413);
    body = { path: data.path, size: data.size, content: data.content, encoding: data.encoding, html_url: data.html_url };
  }
  else if (r.kind === "user") body = { login: data.login, name: data.name, avatar_url: data.avatar_url, public_repos: data.public_repos, followers: data.followers, html_url: data.html_url };
  else body = data;

  const out = json(body, 200, { "x-gh-remaining": remaining ?? "" });
  const forCache = new Response(out.body, out);
  forCache.headers.set("cache-control", `public, max-age=${BROWSER_TTL}, s-maxage=${EDGE_TTL}`);
  await cache.put(cacheKey, forCache.clone());
  return forCache;
}
