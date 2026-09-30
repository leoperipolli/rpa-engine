/**
 * Detects if a string looks like HTML (starts with a tag).
 */
export function isHtml(s: string): boolean {
  return s.trimStart().startsWith('<') && s.includes('>');
}

/**
 * Parses the innerHTML of a single list item (e.g., a <li>) into a row object.
 * Uses the element's class name as the column key; falls back to col1, col2, ...
 * Returns null if fewer than 2 meaningful children are found.
 */
export function parseHtmlItem(html: string): Record<string, string> | null {
  if (typeof window === 'undefined') return null;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.querySelector('div')!;

  // Direct children that carry text content
  const children = Array.from(root.children).filter(
    (el) => !['SCRIPT', 'STYLE', 'IMG', 'BR', 'HR'].includes(el.tagName),
  );

  if (children.length < 2) return null;

  const row: Record<string, string> = {};
  children.forEach((child, i) => {
    // Prefer a meaningful class name over generic layout classes
    const cls = Array.from(child.classList).find(
      (c) => c && !/^(col-|row|flex|grid|d-|p-|m-|text-|bg-|list-)/.test(c),
    );
    const key = cls || `col${i + 1}`;
    row[key] = child.textContent?.trim() ?? '';
  });

  return row;
}
