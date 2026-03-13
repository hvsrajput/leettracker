let problemsDataset;
let datasetMapByNumber;
let datasetMapBySlug;

function ensureLoaded() {
  if (problemsDataset) {
    return;
  }

  problemsDataset = require('../data/problems.json');
  datasetMapByNumber = new Map();
  datasetMapBySlug = new Map();

  problemsDataset.forEach((problem) => {
    datasetMapByNumber.set(problem.number, problem);
    datasetMapBySlug.set(problem.slug, problem);
  });
}

function getProblemsDataset() {
  ensureLoaded();
  return problemsDataset;
}

function getProblemByNumber(number) {
  ensureLoaded();
  return datasetMapByNumber.get(Number(number));
}

function getProblemBySlug(slug) {
  ensureLoaded();
  return datasetMapBySlug.get(slug);
}

module.exports = {
  getProblemsDataset,
  getProblemByNumber,
  getProblemBySlug,
};
