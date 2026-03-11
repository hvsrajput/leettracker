import requests
import json
import time
import os

URL = "https://leetcode.com/graphql"

query = """
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      questionFrontendId
      title
      titleSlug
      difficulty
      topicTags {
        name
      }
    }
  }
}
"""

headers = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com/problemset/all/",
    "User-Agent": "Mozilla/5.0"
}

limit = 100
skip = 0
all_questions = []

print("Starting LeetCode scrape...")

while True:
    variables = {
        "categorySlug": "",
        "skip": skip,
        "limit": limit,
        "filters": {}
    }

    try:
        response = requests.post(
            URL,
            json={"query": query, "variables": variables},
            headers=headers
        )
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching data: {e}")
        time.sleep(5)
        continue

    try:
        data = response.json()
    except Exception as e:
        print(f"JSON decode error: {e}. Text: {response.text}")
        break

    if "data" not in data or data.get("data") is None:
        print(f"Unexpected data format: {data}")
        break

    problemset = data.get("data", {}).get("problemsetQuestionList")
    if problemset is None:
        print(f"No problemset returned, stopping. Full data: {json.dumps(data, indent=2)}")
        break
        
    questions = problemset.get("questions", [])

    if not questions:
        print("No more questions, stopping.")
        break


    for q in questions:
        if q["questionFrontendId"].isdigit():  # skip weird IDs
            obj = {
                "number": int(q["questionFrontendId"]),
                "slug": q["titleSlug"],
                "title": q["title"],
                "difficulty": q["difficulty"],
                "topics": [t["name"] for t in q["topicTags"]],
                "url": f"https://leetcode.com/problems/{q['titleSlug']}/"
            }
            all_questions.append(obj)

    print(f"Fetched {len(all_questions)} questions...")
    skip += limit
    time.sleep(1)  # avoid rate limiting

# sort by problem number
all_questions.sort(key=lambda x: x["number"])

output_path = os.path.join(os.path.dirname(__file__), "../data/problems.json")
with open(output_path, "w") as f:
    json.dump(all_questions, f, indent=2)

print(f"Saved {len(all_questions)} problems to {output_path}")
