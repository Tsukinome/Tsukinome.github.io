/*
 * Portfolio configuration. Hand-written content lives here; everything
 * else is fetched live from GitHub (and Open-Meteo for the weather).
 */

const SITE = {
  githubUser: "Tsukinome",
  name: "Kristina Grigaitytė",
  roles: ["data analyst", "educator", "ex-biotechnologist", "AI-engineering teacher"],
  intro: "From pipettes to pandas. This page tells that story with live data.",
  location: "Vilnius, Lithuania",
  timezone: "Europe/Vilnius",
  coords: { lat: 54.69, lon: 25.28 },
  email: "grkristina2@gmail.com",
  linkedin: "https://www.linkedin.com/in/kristina-grigaityt%C4%97/",
  hideFromActivity: ["Tsukinome.github.io"],
  // Same-origin GitHub proxy (a Cloudflare Pages Function, see functions/). When it answers,
  // every GitHub call goes through it: shared cache, shared 5,000/hour limit, private repos
  // on its allow-list become visible. On hosts without functions (GitHub Pages) the page talks
  // to api.github.com directly with the anonymous 60/hour limit and private repos stay hidden.
  proxy: "/api/gh/",
};

/* Static milestones. Kaggle projects and "now" are appended automatically from GitHub. */
const JOURNEY = [
  { when: "2016", title: "Microbiology & Biotechnology", note: "BSc, Vilnius University" },
  { when: "2018", title: "Research intern", note: "VU Life Sciences Center" },
  { when: "2020", title: "COVID-19 researcher", note: "VU Life Sciences Center" },
  { when: "2021", title: "Switched to data", note: "Turing College, Data Science" },
  { when: "2022", title: "Molecular Biotechnology", note: "MSc, Vilnius University" },
];

const PROJECTS = [
  /* ---- Chapter 02 · Data & ML (2021 capstone and course work) ---- */
  {
    repo: "Recipe-scraper",
    group: "data",
    title: "Beer recipe scraper",
    summary: "Scrapes Brewer's Friend recipes into a dataset. Part one of a two-part capstone.",
    highlights: ["Installable Python package", "Unit tests with pytest"],
    tags: ["Scraping", "Python package", "Pipeline"],
    notebooks: [{ label: "Scraper", path: "Beer/beerscraper.py" }],
  },
  {
    repo: "Abv-predict",
    group: "data",
    title: "ABV Predict",
    summary: "Predicts a beer's alcohol content from IBU, SRM, OG and FG. Part two: model behind an API.",
    highlights: ["Regression model served by Flask", "Request log kept in Postgres on Heroku"],
    tags: ["Regression", "REST API", "Deployment"],
    notebooks: [{ label: "Model", path: "Models/modelling.ipynb" }, { label: "API", path: "app.py" }],
    featured: true,
  },
  {
    repo: "Etsy-scraper",
    group: "data",
    title: "Etsy scraper",
    summary: "Keyword in, product listings out, straight into a Postgres database.",
    highlights: ["BeautifulSoup scraper with a small ORM layer", "Two tables, CSV export"],
    tags: ["Scraping", "SQL", "Pipeline"],
    notebooks: [{ label: "Scraper", path: "functions/scraping_functions.py" }],
  },

  /* ---- Chapter 03 · AI engineering & teaching (2026) ---- */
  {
    repo: "workshops",
    group: "ai",
    title: "Workshops",
    summary: "Give it a topic, get an interactive workshop website. Also a worked example of a real AI-engineering project.",
    highlights: ["Prompts versioned like code, with evals next to them", "Guardrails, cost tracking, and decision records"],
    tags: ["LLM app", "Evals", "Streamlit", "Python"],
    notebooks: [{ label: "Decisions", path: "docs/decisions" }],
    featured: true,
  },
  {
    repo: "mcp-showcase",
    group: "ai",
    title: "MCP showcase",
    summary: "A readable tour of the Model Context Protocol, one primitive per file.",
    highlights: ["Tools, resources, prompts, then the same server over HTTP", "A client that drives Google's chrome-devtools-mcp"],
    tags: ["MCP", "Agents", "Python"],
    notebooks: [{ label: "Tools", path: "1_tools.py" }, { label: "Real server", path: "6_real_server.py" }],
  },
  {
    repo: "w11-task-wall",
    group: "ai",
    title: "Workshop task wall",
    summary: "One mentor drives the timer, every learner's screen follows, and what they post lands on a wall the whole room sees.",
    highlights: ["Cases unlock in order; the room's split shows only after you commit", "Mentor panel sorts by disagreement"],
    tags: ["Live classroom", "Realtime", "JavaScript"],
    started: "2026-08",
    private: true,
  },

  /* ---- Chapter 04 · Small apps I use ---- */
  {
    repo: "loan",
    group: "apps",
    title: "Paskolos planner",
    summary: "A mortgage planner in Lithuanian: compare bank offers, run the numbers, tick off the paperwork.",
    highlights: ["React + TypeScript front end, Express API", "Postgres via Drizzle, deployed on Railway"],
    tags: ["TypeScript", "Full stack", "Personal finance"],
    started: "2026-04",
    private: true,
  },
  {
    repo: "weekly-board",
    group: "apps",
    title: "Week Board",
    summary: "A kanban board with one board per week. Unfinished tasks roll over on Monday by themselves.",
    highlights: ["Single-file UI, Express + Postgres behind it", "Drag and drop, planned day per task"],
    tags: ["JavaScript", "Productivity", "Full stack"],
    started: "2026-07",
    private: true,
  },
];
