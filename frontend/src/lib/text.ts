const HTML_ENTITY_REPLACEMENTS: Array<[pattern: RegExp, replacement: string]> = [
  [/&(nbsp|#160|#xa0);/gi, ' '],
  [/&amp;/gi, '&'],
  [/&quot;/gi, '"'],
  [/&#39;/gi, "'"],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
];

export function sanitizeDisplayText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = HTML_ENTITY_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value.replace(/\u00a0/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .trim();

  return normalized.length > 0 ? normalized : null;
}
