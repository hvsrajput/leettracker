export const COMPANY_OPTIONS = [
  'Amazon',
  'Google',
  'Meta',
  'Microsoft',
  'Apple',
  'Uber',
  'Adobe',
  'Netflix',
];

export function getProblemTopics(problems = []) {
  const topicSet = new Set();

  problems.forEach((problem) => {
    if (Array.isArray(problem.topics)) {
      problem.topics.forEach((topic) => topicSet.add(topic));
    }

    if (problem.pattern_name) {
      topicSet.add(problem.pattern_name);
    }
  });

  return Array.from(topicSet).sort();
}
