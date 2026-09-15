# Tsukinome.github.io

Personal portfolio, live at **https://tsukinome.github.io/**.

A single static page that pulls its numbers from the GitHub REST API on every
load: profile stats, per-repository language mix, last activity and rendered
READMEs. Curated text lives in one config file.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Page skeleton and inline SVG icons |
| `css/style.css` | Styling, light and dark themes |
| `js/projects.js` | **Edit this.** Site info and the list of showcased projects |
| `js/app.js` | Fetches GitHub data, caches it for an hour, renders cards |

## Add a project

Append an entry to `PROJECTS` in `js/projects.js`:

```js
{
  repo: "my-repo",                       // required, must exist under the GitHub user
  title: "Readable title",
  kaggle: "https://www.kaggle.com/c/...", // optional
  kaggleLabel: "Featured competition",
  summary: "One or two sentences.",
  highlights: ["Bullet", "Bullet"],
  tags: ["Classification", "EDA"],       // drive the filter chips
  notebooks: [{ label: "EDA", path: "notebooks/eda.ipynb" }],
  featured: true,                         // optional, renders wide
}
```

Private repositories are shown with curated text only and a "Private repository" pill.

## Run locally

Any static server works, for example:

```bash
python3 -m http.server 8000
```

Anonymous GitHub API calls are limited to 60 per hour per IP. Responses are
cached in `localStorage`, so normal browsing stays well under the limit.
