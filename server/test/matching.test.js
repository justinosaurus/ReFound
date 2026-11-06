const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreMatch } = require("../src/lib/matching");

test("matching prioritizes shared category, location, and descriptive words", () => {
  const report = {
    title: "Blue water bottle",
    description: "Steel bottle with a mountain sticker",
    category: "Bottle",
    location: "Library",
  };
  const candidate = {
    title: "Water bottle with mountain sticker",
    description: "Blue steel bottle",
    category: "Bottle",
    location: "Library",
  };
  assert.equal(scoreMatch(report, candidate), 100);
});

test("unrelated reports receive no match score", () => {
  const report = { title: "Silver keys", description: "Three keys", category: "Keys", location: "Gym" };
  const candidate = { title: "Red scarf", description: "Wool winter scarf", category: "Clothing", location: "Station" };
  assert.equal(scoreMatch(report, candidate), 0);
});
