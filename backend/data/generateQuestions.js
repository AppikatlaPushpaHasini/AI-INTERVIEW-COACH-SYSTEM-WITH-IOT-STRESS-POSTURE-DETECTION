const fs = require("fs");
const path = require("path");

const outputPath = path.join(__dirname, "questions.json");
const TARGET_PER_ROUND = 100;

function unique(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function buildQuestions(topics, templates, target = TARGET_PER_ROUND) {
  const results = [];

  for (const topic of topics) {
    for (const template of templates) {
      const question = template(topic);
      if (!question || results.includes(question)) continue;
      results.push(question);
      if (results.length >= target) {
        return results;
      }
    }
  }

  return results.slice(0, target);
}

const hrTopics = [
  "your background and how it prepared you for this role",
  "the most relevant project from your college or previous work",
  "your strongest professional skill",
  "an area you are actively improving",
  "why you want to join this company",
  "what motivates you at work",
  "your long-term career plan",
  "a work style that helps you perform well",
  "how you prioritize tasks during a busy week",
  "how you handle feedback from a manager",
  "a personal achievement you are proud of",
  "a time you learned a new skill quickly",
  "how you communicate with a team",
  "how you handle deadlines and pressure",
  "the type of manager or team culture where you do your best work",
  "what you expect from your first 90 days in a new role",
  "how you prepare before an interview or important presentation",
  "what makes you different from other candidates",
  "a responsibility you took ownership of",
  "how you stay organized when managing multiple tasks",
  "what kind of problems you enjoy solving",
  "how you decide what to learn next in your career",
  "a mistake that helped you grow professionally",
  "your preferred way of collaborating across teams",
  "what success in this role would look like for you"
];

const technicalTopics = [
  "object-oriented programming and where it is useful",
  "REST APIs and how clients use them",
  "database normalization and why it matters",
  "SQL joins and when to choose each join type",
  "NoSQL databases and the trade-offs compared with SQL",
  "authentication versus authorization",
  "HTTP methods and status codes in API design",
  "caching strategies in a web application",
  "processes versus threads",
  "synchronous versus asynchronous programming",
  "how indexes improve database performance",
  "the difference between monoliths and microservices",
  "Docker containers in development and deployment",
  "Kubernetes and why teams use orchestration",
  "load balancing in distributed systems",
  "message queues and event-driven architecture",
  "rate limiting and API protection",
  "logging, monitoring, and alerting in production",
  "unit testing versus integration testing",
  "CI/CD pipelines and release automation",
  "cloud scaling and high availability",
  "security risks such as SQL injection or XSS",
  "how WebSockets differ from normal HTTP requests",
  "version control workflows with Git",
  "how to debug a production issue systematically"
];

const codingTopics = [
  "reversing a string efficiently",
  "checking whether a number or string is a palindrome",
  "finding duplicate values in an array",
  "solving two-sum style array problems",
  "using hash maps for fast lookup",
  "sorting an array and choosing the right algorithm",
  "binary search on a sorted collection",
  "merging overlapping intervals",
  "validating balanced parentheses with a stack",
  "finding the first non-repeating character",
  "sliding window problems on strings",
  "two-pointer techniques on arrays",
  "reversing or traversing a linked list",
  "detecting a cycle in a linked list",
  "queue and stack implementation questions",
  "tree traversal using DFS or BFS",
  "binary tree depth or height calculations",
  "graph traversal problems",
  "dynamic programming for optimization problems",
  "memoization versus tabulation",
  "handling edge cases in recursion",
  "time and space complexity analysis",
  "designing a clean function interface",
  "writing code that handles empty or null input safely",
  "explaining trade-offs between brute force and optimized solutions"
];

const behaviourTopics = [
  "a difficult challenge you faced on a project",
  "a disagreement with a teammate or classmate",
  "a time you worked under tight pressure",
  "a leadership situation where others depended on you",
  "a failure or setback that taught you something important",
  "a time you received critical feedback",
  "a time you had to learn something quickly",
  "a situation where you had to prioritize competing tasks",
  "a conflict between quality and deadline",
  "a time you solved a problem without much guidance",
  "a time you had to explain a complex idea simply",
  "a time you supported a struggling teammate",
  "a situation where you had to adapt to change",
  "a decision you made with incomplete information",
  "a time you took ownership beyond your role",
  "a time you handled ambiguity",
  "a time you improved a process or workflow",
  "a situation where you made an ethical decision",
  "a time you influenced someone without formal authority",
  "a moment when you had to stay calm during stress",
  "a time you balanced multiple responsibilities",
  "a time you had to rebuild trust after a mistake",
  "a situation where you had to collaborate with different personalities",
  "a time you helped deliver results for a customer or stakeholder",
  "a challenge that changed the way you work today"
];

const hrTemplates = [
  (topic) => `Tell me about ${topic}.`,
  (topic) => `How would you connect ${topic} to the role you are applying for?`,
  (topic) => `What example would you use in an HR interview to discuss ${topic}?`,
  (topic) => `If an interviewer asks about ${topic}, what key point should your answer leave behind?`
];

const technicalTemplates = [
  (topic) => `Explain ${topic} as you would in a technical interview.`,
  (topic) => `When would you apply ${topic} in a real project or production system?`,
  (topic) => `What trade-offs or common mistakes would you discuss when talking about ${topic}?`,
  (topic) => `How would you give a practical example for ${topic} during an interview?`
];

const codingTemplates = [
  (topic) => `How would you approach ${topic} in a coding interview?`,
  (topic) => `What edge cases would you check when ${topic}?`,
  (topic) => `How would you explain the time and space complexity while ${topic}?`,
  (topic) => `What optimized solution or trade-off would you mention when ${topic}?`
];

const behaviourTemplates = [
  (topic) => `Tell me about a time you dealt with ${topic}.`,
  (topic) => `What action did you take when facing ${topic}, and what was the outcome?`,
  (topic) => `What did you learn from ${topic}?`,
  (topic) => `How would you answer a behavioural question about ${topic} using the STAR format?`
];

const data = {
  hr: buildQuestions(hrTopics, hrTemplates),
  technical: buildQuestions(technicalTopics, technicalTemplates),
  coding: buildQuestions(codingTopics, codingTemplates),
  behaviour: buildQuestions(behaviourTopics, behaviourTemplates)
};

for (const [round, items] of Object.entries(data)) {
  data[round] = unique(items).slice(0, TARGET_PER_ROUND);
}

fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");

const total = Object.values(data).reduce((sum, items) => sum + items.length, 0);
console.log(`Generated ${total} realistic questions across ${Object.keys(data).length} rounds.`);
