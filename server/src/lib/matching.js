const ignoredWords = new Set([
  "a", "an", "and", "are", "at", "for", "from", "in", "is", "it", "my",
  "of", "on", "or", "the", "to", "with",
]);

function words(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 1 && !ignoredWords.has(word)),
  );
}

function scoreMatch(report, candidate) {
  let score = 0;
  if (report.category.toLowerCase() === candidate.category.toLowerCase()) score += 30;
  if (report.location.toLowerCase() === candidate.location.toLowerCase()) score += 20;

  const reportWords = words(`${report.title} ${report.description}`);
  const candidateWords = words(`${candidate.title} ${candidate.description}`);
  const overlap = [...reportWords].filter((word) => candidateWords.has(word)).length;
  const unionSize = new Set([...reportWords, ...candidateWords]).size;
  if (unionSize) score += Math.round((overlap / unionSize) * 50);
  return score;
}

module.exports = { scoreMatch };
