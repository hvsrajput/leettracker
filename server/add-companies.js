const fs = require('fs');

const dataRaw = fs.readFileSync('./data/problems.json', 'utf8');
const problems = JSON.parse(dataRaw);
const companies = ["Amazon", "Google", "Meta", "Microsoft", "Apple", "Uber", "Adobe", "Netflix"];

problems.forEach(p => {
  // Sprinkle 1 to 3 random companies per problem
  const problemCompanies = [];
  const numCompanies = Math.floor(Math.random() * 3) + 1; // 1 to 3
  
  // Create a copy of the companies array to randomly pick without duplicates
  const availableCompanies = [...companies];
  
  for (let i = 0; i < numCompanies; i++) {
    const rIdx = Math.floor(Math.random() * availableCompanies.length);
    problemCompanies.push(availableCompanies[rIdx]);
    availableCompanies.splice(rIdx, 1);
  }
  
  p.companies = problemCompanies;
});

fs.writeFileSync('./data/problems.json', JSON.stringify(problems, null, 2));
console.log('Added companies successfully');
