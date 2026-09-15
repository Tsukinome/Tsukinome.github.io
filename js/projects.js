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
    title: "House Prices",
    kaggle: "https://www.kaggle.com/c/house-prices-advanced-regression-techniques",
    kaggleLabel: "Getting started",
    summary: "79 features of a house in Ames, Iowa. Guess the price.",
    highlights: ["GBM, XGBoost, MLP on identical folds", "Log target"],
    tags: ["Regression", "Gradient boosting", "Neural nets"],
    notebooks: [{ label: "Notebook", path: "Analysis/Ames.ipynb" }],
    started: "2021-07",
  },
  {
    repo: "Covid-Korea",
    title: "COVID-19 in South Korea",
    kaggle: "https://www.kaggle.com/kimjihoo/coronavirusdataset",
    kaggleLabel: "Dataset",
    summary: "What would a response plan for Lithuania look like?",
    highlights: ["Hypothesis tests", "Regional clustering"],
    tags: ["EDA", "Statistics", "Clustering"],
    notebooks: [{ label: "Notebook", path: "covid.ipynb" }],
    started: "2021-10",
  },
];
