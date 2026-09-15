# tsukinome.github.io

Live at **https://tsukinome.github.io/**. A one-page portfolio told as a story,
with almost everything on it fetched at load time.

## Live features

| Feature | Source |
| --- | --- |
| Avatar, repo count, followers, stars | GitHub `users` + `repos` |
| Public commits this year | GitHub `search/commits` |
| Latest commits feed | GitHub `repos/*/commits` for the 4 most active repos |
| Language donut across the account | GitHub `repos/*/languages` |
| Per-project stats, language bar, README modal | GitHub `repos/*`, `languages`, `readme` |
| Journey timeline dates for Kaggle projects | GitHub repo `created_at` |
| Local time and greeting | `Intl` with `Europe/Vilnius` |
| Weather in Vilnius | Open-Meteo, no key |
| API meter (live calls, cache hits, remaining quota) | Rate-limit headers |

Motion: constellation canvas that reacts to the cursor with shooting stars,
typewriter, count-up stats, reveal on scroll, card tilt, cursor glow,
scroll progress bar, chapter dots. All of it respects `prefers-reduced-motion`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Chapter skeleton and inline SVG icons |
| `css/style.css` | Twilight theme, light theme via toggle |
| `js/projects.js` | **Edit this.** Site info, journey milestones, projects |
| `js/app.js` | Fetching, caching, rendering, motion |
| `.github/workflows/pages.yml` | Deploys on push to `main` |

## Add a project

Append to `PROJECTS` in `js/projects.js`. Only `repo` is required.

```js
{ repo: "my-repo", title: "Title", summary: "One line.", tags: ["EDA"],
  kaggle: "https://www.kaggle.com/c/...", notebooks: [{ label: "EDA", path: "eda.ipynb" }] }
```

## Notes

Anonymous GitHub API calls are limited to 60 per hour per IP; responses
(including 404s for private repos) are cached in `localStorage` for an hour.
Run locally with any static server, for example `python3 -m http.server`.
