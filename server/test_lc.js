const axios = require('axios');
async function test() {
  const q = `query { recentAcSubmissionList(username: "hvsrajput", limit: 100) { titleSlug } }`;
  const res = await axios.post('https://leetcode.com/graphql', { query: q });
  console.log(res.data.data.recentAcSubmissionList.length);
}
test();
