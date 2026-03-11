const axios = require('axios');
const session = process.argv[2];

async function test() {
  let offset = 0;
  let limit = 20;
  try {
    const subResp = await axios.get(`https://leetcode.com/api/submissions/?offset=${offset}&limit=${limit}`, {
      headers: {
        'Cookie': `LEETCODE_SESSION=${session}`,
        'Referer': 'https://leetcode.com'
      }
    });
    console.log(Object.keys(subResp.data));
    console.log(subResp.data.submissions_dump?.[0]);
    console.log("has next:", subResp.data.has_next);
    console.log("dump len:", subResp.data.submissions_dump?.length);
  } catch(e) { console.error(e.response?.status, e.response?.data); }
}
test();
