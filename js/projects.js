/*
 * Portfolio configuration.
 *
 * Everything hand-written lives here. Everything else on the page
 * (avatar, follower count, language mix, last activity, README text)
 * is fetched live from the GitHub REST API by app.js.
 *
 * To add a project: append an object to PROJECTS. Only `repo` is required.
 */

const SITE = {
  githubUser: "Tsukinome",
  name: "Kristina Grigaitytė",
  tagline: "Data analyst and educator with a molecular biotechnology background.",
  intro:
    "I turn messy datasets into clear, defensible answers. This page is a living " +
    "portfolio: the numbers and READMEs you see below are pulled from GitHub " +
    "every time the page loads, so it never goes stale.",
  location: "Vilnius, Lithuania",
  email: "grkristina2@gmail.com",
  linkedin: "https://www.linkedin.com/in/kristina-grigaityt%C4%97/",
  // Repos to hide from the auto-generated "Latest activity" list.
  hideFromActivity: ["Tsukinome.github.io", "Files"],
};

const PROJECTS = [
  {
    repo: "Home-credit-default-risk",
    title: "Home Credit Default Risk",
    kaggle: "https://www.kaggle.com/c/home-credit-default-risk",
    kaggleLabel: "Featured competition",
    summary:
      "Binary classification of loan repayment difficulty across seven linked " +
      "tables: application data, bureau records, credit card balances and " +
      "previous applications.",
    highlights: [
      "Merged and aggregated seven relational files into one training matrix",
      "Compared Random Forest, XGBoost and LightGBM with hyperparameter search",
      "Three separate Kaggle submissions kept for side-by-side scoring",
    ],
    tags: ["Classification", "Gradient boosting", "Feature engineering", "EDA"],
    notebooks: [
      { label: "EDA notebook", path: "EDA and models/Credit EDA.ipynb" },
      { label: "Models notebook", path: "EDA and models/Models.ipynb" },
    ],
    featured: true,
  },
  {
    repo: "Kaggle-Overfit",
    title: "Don't Overfit! II",
    kaggle: "https://www.kaggle.com/c/dont-overfit-ii",
    kaggleLabel: "Playground competition",
    summary:
      "250 training rows, 19,750 test rows and 300 anonymous features. The " +
      "whole challenge is generalising from almost nothing without fooling " +
      "yourself.",
    highlights: [
      "Heavy regularisation and feature selection instead of model complexity",
      "Cross-validation strategy designed around a tiny training set",
      "Experiment tracking with Neptune to keep runs comparable",
    ],
    tags: ["Classification", "Regularisation", "Experiment tracking", "EDA"],
    notebooks: [
      { label: "EDA notebook", path: "Modelling and EDA/EDA.ipynb" },
      { label: "Models notebook", path: "Modelling and EDA/Models.ipynb" },
    ],
  },
  {
    repo: "Kaggle-Ames-2.0",
    title: "House Prices: Advanced Regression",
    kaggle: "https://www.kaggle.com/c/house-prices-advanced-regression-techniques",
    kaggleLabel: "Getting started competition",
    summary:
      "Predicting sale prices for homes in Ames, Iowa from 79 descriptive " +
      "features. A classic regression benchmark used here to compare model " +
      "families on the same data.",
    highlights: [
      "Gradient Boosting, XGBoost and an MLP regressor on identical folds",
      "Log-transformed target and careful handling of ordinal categories",
      "Focus on understanding model behaviour rather than leaderboard rank",
    ],
    tags: ["Regression", "Gradient boosting", "Neural nets", "EDA"],
    notebooks: [{ label: "Analysis notebook", path: "Analysis/Ames.ipynb" }],
  },
  {
    repo: "Covid-Korea",
    title: "COVID-19 in South Korea",
    kaggle: "https://www.kaggle.com/kimjihoo/coronavirusdataset",
    kaggleLabel: "Kaggle dataset",
    summary:
      "Exploratory analysis of the Korean outbreak data with one practical " +
      "question in mind: what would a response plan for Lithuania look like?",
    highlights: [
      "Hypothesis tests on transmission routes and patient demographics",
      "Clustering of regions by outbreak dynamics",
      "Analysis written for a policy audience, not just a technical one",
    ],
    tags: ["EDA", "Statistics", "Clustering", "Public health"],
    notebooks: [{ label: "Full notebook", path: "covid.ipynb" }],
  },
];
