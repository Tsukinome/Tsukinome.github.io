/*
 * Portfolio configuration. Hand-written content lives here; everything
 * else is fetched live from GitHub (and Open-Meteo for the weather).
 */

const SITE = {
  githubUser: "Tsukinome",
  name: "Kristina Grigaitytė",
  roles: ["data analyst", "educator", "ex-biotechnologist", "Kaggle tinkerer"],
  intro: "From pipettes to pandas. This page tells that story with live data.",
  location: "Vilnius, Lithuania",
  timezone: "Europe/Vilnius",
  coords: { lat: 54.69, lon: 25.28 },
  email: "grkristina2@gmail.com",
  linkedin: "https://www.linkedin.com/in/kristina-grigaityt%C4%97/",
  hideFromActivity: ["Tsukinome.github.io", "Files"],
  // Same-origin proxy for private repos (a Cloudflare Pages Function, see functions/).
  // On hosts without functions, such as GitHub Pages, the page falls back to "Private".
  proxy: "/api/repo/",
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
  {
    repo: "Home-credit-default-risk",
    group: "kaggle",
    title: "Home Credit Default Risk",
    kaggle: "https://www.kaggle.com/c/home-credit-default-risk",
    kaggleLabel: "Featured competition",
    summary: "Will this applicant struggle to repay? Seven tables, one answer.",
    highlights: ["7 relational files merged", "RF vs XGBoost vs LightGBM"],
    tags: ["Classification", "Gradient boosting", "Feature engineering"],
    notebooks: [
      { label: "EDA", path: "EDA and models/Credit EDA.ipynb" },
      { label: "Models", path: "EDA and models/Models.ipynb" },
    ],
    featured: true,
  },
  {
    repo: "Kaggle-Overfit",
    group: "kaggle",
    title: "Don't Overfit! II",
    kaggle: "https://www.kaggle.com/c/dont-overfit-ii",
    kaggleLabel: "Playground",
    summary: "250 rows, 300 features. Generalise without fooling yourself.",
    highlights: ["Regularisation over complexity", "Runs tracked in Neptune"],
    tags: ["Classification", "Regularisation"],
    notebooks: [
      { label: "EDA", path: "Modelling and EDA/EDA.ipynb" },
      { label: "Models", path: "Modelling and EDA/Models.ipynb" },
    ],
  },
  {
    repo: "Kaggle-Ames-2.0",
    group: "kaggle",
    title: "House Prices",
    kaggle: "https://www.kaggle.com/c/house-prices-advanced-regression-techniques",
    kaggleLabel: "Getting started",
    summary: "79 features of a house in Ames, Iowa. Guess the price.",
    highlights: ["GBM, XGBoost, MLP on identical folds", "Log target"],
    tags: ["Regression", "Gradient boosting", "Neural nets"],
    notebooks: [{ label: "Notebook", path: "Analysis/Ames.ipynb" }],
    started: "2021-07",
    private: true,
  },
  {
    repo: "Covid-Korea",
    group: "kaggle",
    title: "COVID-19 in South Korea",
    kaggle: "https://www.kaggle.com/kimjihoo/coronavirusdataset",
    kaggleLabel: "Dataset",
    summary: "What would a response plan for Lithuania look like?",
    highlights: ["Hypothesis tests", "Regional clustering"],
    tags: ["EDA", "Statistics", "Clustering"],
    notebooks: [{ label: "Notebook", path: "covid.ipynb" }],
    started: "2021-10",
    private: true,
  },

  /* ---- Things I built ---- */
  {
    repo: "Recipe-scraper",
    group: "build",
    title: "Beer recipe scraper",
    summary: "Scrapes Brewer's Friend recipes into a dataset. Part one of a capstone.",
    highlights: ["Installable Python package", "Unit tests with pytest"],
    tags: ["Scraping", "Python package", "Pipeline"],
    notebooks: [{ label: "Scraper", path: "Beer/beerscraper.py" }],
  },
  {
    repo: "Abv-predict",
    group: "build",
    title: "ABV Predict",
    summary: "Predicts a beer's alcohol content from IBU, SRM, OG and FG. Part two of the capstone.",
    highlights: ["Regression model served by Flask", "Request log kept in Postgres on Heroku"],
    tags: ["Regression", "REST API", "Deployment"],
    notebooks: [{ label: "Model", path: "Models/modelling.ipynb" }, { label: "API", path: "app.py" }],
  },
  {
    repo: "loan",
    group: "build",
    title: "Paskolos planner",
    summary: "A mortgage planner in Lithuanian: compare bank offers, run the numbers, tick off the paperwork.",
    highlights: ["React + TypeScript front end, Express API", "Postgres via Drizzle, deployed on Railway"],
    tags: ["TypeScript", "Full stack", "Personal finance"],
    started: "2026-04",
    private: true,
  },
  {
    repo: "weekly-board",
    group: "build",
    title: "Week Board",
    summary: "A kanban board with one board per week. Unfinished tasks roll over on Monday by themselves.",
    highlights: ["Single-file UI, Express + Postgres behind it", "Drag and drop, planned day per task"],
    tags: ["JavaScript", "Productivity", "Full stack"],
    started: "2026-07",
    private: true,
  },
];
