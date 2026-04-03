/**
 * Extract a student matricule from a photo filename.
 * Looks for a pattern like 25FS0060S, 24TG001M, etc.
 * Falls back to the full filename stem (uppercase, stripped spaces).
 */
export function extractMatriculeFromFilename(filename: string): string {
  // Remove extension
  const stem = filename.replace(/\.[^/.]+$/, '').trim();
  // Try to detect a student ID pattern and stop before separators like _, -, or space.
  const match = stem.match(/(?:^|[^A-Z0-9])(\d{2}[A-Z]{1,6}\d{3,}[A-Z]?)(?=[^A-Z0-9]|$)/i)
    ?? stem.match(/^(\d{2}[A-Z]{1,6}\d{3,}[A-Z]?)/i);
  if (match) return match[1].toUpperCase();
  // Fallback: normalize and return as-is
  return stem.toUpperCase().replace(/\s+/g, '_');
}
