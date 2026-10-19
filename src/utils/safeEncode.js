/**
 * Safely encode a URI component string without throwing URIError on invalid surrogate pairs / emojis
 */
export function safeEncode(str) {
  try {
    return encodeURIComponent(str || '');
  } catch (e) {
    try {
      // Fallback: strip emojis/special characters if encoding fails
      const cleaned = String(str || '').replace(/[^\x00-\x7F]/g, '');
      return encodeURIComponent(cleaned) || 'WA';
    } catch (err) {
      return 'WA';
    }
  }
}
