/**
 * Normalizes text for search by removing diacritics (accents) and converting to lowercase.
 * This allows searching "salvação" to match "salvacao" and "glória" to match "gloria".
 * 
 * @param text - The text to normalize
 * @returns Normalized text with accents removed and converted to lowercase
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  
  // Convert to lowercase
  const lowercased = text.toLowerCase();
  
  // Normalize to NFD (Normalization Form Decomposed) to separate base characters from combining marks
  // Then remove the combining marks (diacritics) using a regex
  // Finally remove any remaining special characters that aren't alphanumeric or spaces
  return lowercased
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/[^\w\s]/g, '') // Remove special characters (keep alphanumeric and spaces)
    .trim();
}

/**
 * Checks if the search query matches the target text, ignoring accents and special characters.
 * 
 * @param query - The search query
 * @param target - The text to search in
 * @returns True if the normalized query is found in the normalized target
 */
export function matchesSearch(query: string, target: string): boolean {
  if (!query || !target) return false;
  
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTarget = normalizeSearchText(target);
  
  return normalizedTarget.includes(normalizedQuery);
}

/**
 * Finds all matches of the query in the target text, returning the original text positions.
 * This is useful for highlighting where matches occur in the original text.
 * 
 * @param query - The search query
 * @param target - The text to search in
 * @returns Array of match objects with start and end positions in the original text
 */
export function findMatchesInText(query: string, target: string): Array<{ start: number; end: number }> {
  if (!query || !target) return [];
  
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  
  const matches: Array<{ start: number; end: number }> = [];
  
  // Search through the original text, comparing normalized substrings
  // We'll try different window sizes to find the best match
  const queryLength = normalizedQuery.length;
  
  // Start searching from each position in the target
  for (let i = 0; i <= target.length - 1; i++) {
    // Try different ending positions to find a match
    for (let j = i + 1; j <= target.length; j++) {
      const substring = target.slice(i, j);
      const normalizedSubstring = normalizeSearchText(substring);
      
      // Check if this substring matches (allowing for some flexibility)
      if (normalizedSubstring === normalizedQuery) {
        // Found an exact match
        matches.push({ start: i, end: j });
        // Skip past this match to avoid overlapping matches
        i = j - 1;
        break;
      } else if (normalizedSubstring.length > normalizedQuery.length * 2) {
        // If we've gone too far, break this inner loop
        break;
      }
    }
  }
  
  // Remove overlapping matches (keep the first one)
  const filteredMatches: Array<{ start: number; end: number }> = [];
  for (const match of matches) {
    const overlaps = filteredMatches.some(existing => 
      (match.start >= existing.start && match.start < existing.end) ||
      (match.end > existing.start && match.end <= existing.end) ||
      (match.start <= existing.start && match.end >= existing.end)
    );
    
    if (!overlaps) {
      filteredMatches.push(match);
    }
  }
  
  return filteredMatches;
}

