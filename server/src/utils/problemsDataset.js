import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let problemsDataset;
let datasetMapByNumber;
let datasetMapBySlug;

// Lazily load the problems dataset on first access
const ensureLoaded = () => {
  if (problemsDataset) {
    return;
  }

  problemsDataset = JSON.parse(
    readFileSync(path.join(__dirname, '../data/problems.json'), 'utf8')
  );
  datasetMapByNumber = new Map();
  datasetMapBySlug = new Map();

  problemsDataset.forEach((problem) => {
    datasetMapByNumber.set(problem.number, problem);
    datasetMapBySlug.set(problem.slug, problem);
  });
};

export const getProblemsDataset = () => {
  ensureLoaded();
  return problemsDataset;
};

export const getProblemByNumber = (number) => {
  ensureLoaded();
  return datasetMapByNumber.get(Number(number));
};

export const getProblemBySlug = (slug) => {
  ensureLoaded();
  return datasetMapBySlug.get(slug);
};
