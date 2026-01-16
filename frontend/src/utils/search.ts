/**
 * Search/Filtering Utilities
 * Supports structured queries like "service:cart" or "status:error"
 */

interface FilterCriteria {
  text: string[];
  fields: Record<string, string>;
}

/**
 * Parses a search query string into structured criteria.
 * Example: "error service:payment database" 
 * Result: { text: ["error", "database"], fields: { service: "payment" } }
 */
export function parseQuery(query: string): FilterCriteria {
  const parts = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const criteria: FilterCriteria = { text: [], fields: {} };

  parts.forEach(part => {
    if (part.includes(':')) {
      const [key, ...valueParts] = part.split(':');
      let value = valueParts.join(':');
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (key && value) {
        criteria.fields[key.toLowerCase()] = value.toLowerCase();
      }
    } else {
      criteria.text.push(part.toLowerCase());
    }
  });

  return criteria;
}

/**
 * matchesGeneric checks if an item matches the criteria.
 * extractors maps field names (e.g., 'service') to a function that retrieves value from item.
 */
export function matchItem<T>(
  item: T,
  criteria: FilterCriteria,
  extractors: Record<string, (item: T) => string | undefined | null>,
  globalSearchFields: (item: T) => string[]
): boolean {
  // 1. Check field matches (AND logic)
  for (const [key, targetValue] of Object.entries(criteria.fields)) {
    const extractor = extractors[key];
    if (!extractor) continue; // Ignore unknown fields or handle strictly? Ignoring for "soft" matching.

    const actualValue = extractor(item);
    if (!actualValue || !actualValue.toLowerCase().includes(targetValue)) {
      return false;
    }
  }

  // 2. Check text matches (AND logic - all words must exist somewhere in global fields)
  if (criteria.text.length > 0) {
    const globalText = globalSearchFields(item).join(' ').toLowerCase();
    for (const word of criteria.text) {
      if (!globalText.includes(word)) {
        return false;
      }
    }
  }

  return true;
}
