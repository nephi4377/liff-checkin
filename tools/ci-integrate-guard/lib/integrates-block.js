'use strict';

/**
 * Parse machine-readable integrates block from PR body.
 * Supported formats:
 *   ```integrates
 *   #182 #185
 *   ```
 *   ```text
 *   integrates: #182 #185
 *   ```
 * @param {string} body
 * @returns {number[]} unique PR numbers in order
 */
function parseIntegratesPrNumbers(body) {
  if (!body || typeof body !== 'string') return [];

  const numbers = [];
  const fenceRe = /```[^\n]*\n([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(body)) !== null) {
    const block = m[1];
    const info = m[0].slice(0, m[0].indexOf('\n'));
    const tag = info.replace(/^```/, '').trim().toLowerCase();
    const isIntegratesFence = tag === 'integrates' || tag.startsWith('integrates');
    const hasIntegratesLine = /^\s*integrates\s*:/im.test(block);
    if (!isIntegratesFence && !hasIntegratesLine) continue;

    const text = hasIntegratesLine && !isIntegratesFence
      ? block.replace(/^\s*integrates\s*:\s*/im, '')
      : block;
    extractPrNumbers(text, numbers);
  }

  return dedupe(numbers);
}

/** Plain-text / CLI: any `#123` tokens in the string. */
function parseIntegratesList(text) {
  if (!text || typeof text !== 'string') return [];
  const numbers = [];
  extractPrNumbers(text, numbers);
  return dedupe(numbers);
}

function extractPrNumbers(text, into) {
  const re = /#(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    into.push(parseInt(m[1], 10));
  }
}

function dedupe(nums) {
  const seen = new Set();
  const out = [];
  for (const n of nums) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

module.exports = {
  parseIntegratesPrNumbers,
  parseIntegratesList,
};
