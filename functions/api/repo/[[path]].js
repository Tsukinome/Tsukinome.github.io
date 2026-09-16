/*
 * Cloudflare Pages Function: a narrow, read-only proxy to the GitHub API.
 *
 *   /api/repo/<name>            -> selected repository metadata
 *   /api/repo/<name>/languages  -> language byte counts
 *   /api/repo/<name>/readme     -> README (base64 content + html_url)
 *
 * The token lives in the GITHUB_TOKEN secret on Cloudflare and never reaches
 * the browser. Only repositories in ALLOWED can be requested, so the function
 * cannot be used to enumerate anything else on the account.
 */

const OWNER = "Tsukinome";
const ALLOWED = new Set(["Kaggle-Ames-2.0", "Covid-Korea", "loan", "weekly-board"]);
const CACHE_SECONDS = 3600;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${CACHE_SECONDS}`, ...extra },
  });

export async function onRequestGet({ request, env, params }) {
  const [name, sub, ...rest] = params.path || [];
  if (!name || !ALLOWED.has(name) || rest.length || (sub && !["languages", "readme"].includes(sub)))
    return json({ message: "Not found" }, 404);
  if (!env.GITHUB_TOKEN) return json({ message: "Proxy not configured: GITHUB_TOKEN secret is missing" }, 503, { "cache-control": "no-store" });

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const upstream = `https://api.github.com/repos/${OWNER}/${name}${sub ? "/" + sub : ""}`;
  const res = await fetch(upstream, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "tsukinome-portfolio-proxy",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return json({ message: `GitHub responded ${res.status}` }, res.status === 404 ? 404 : 502, { "cache-control": "no-store" });
  const data = await res.json();

  // Return only what the page needs.
  let body;
  if (!sub) body = {
    name: data.name, description: data.description, html_url: data.html_url, private: data.private,
    stargazers_count: data.stargazers_count, forks_count: data.forks_count, size: data.size,
    created_at: data.created_at, pushed_at: data.pushed_at, default_branch: data.default_branch,
    license: data.license ? { spdx_id: data.license.spdx_id } : null,
  };
  else if (sub === "languages") body = data;
  else body = { content: data.content, encoding: data.encoding, html_url: data.html_url };

  const out = json(body);
  await cache.put(cacheKey, out.clone());
  return out;
}
