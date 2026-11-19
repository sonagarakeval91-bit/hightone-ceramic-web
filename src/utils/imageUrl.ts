/**
 * Normalizes image URLs, specifically converting Google Drive share links
 * and Dropbox links into direct, high-performance image CDN links.
 */
export function normalizeImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // If it's a placeholder instruction like "(paste your image link)", ignore it
  if (trimmed.toLowerCase().includes('paste') || trimmed.toLowerCase().includes('your image') || trimmed.startsWith('(')) {
    return '';
  }

  // Must be an http(s), relative path, or data URI
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/') && !trimmed.startsWith('data:image')) {
    return '';
  }

  // Handle Google Image Search redirect URLs (e.g. https://www.google.com/imgres?imgurl=...)
  if (trimmed.includes('google.') && trimmed.includes('imgurl=')) {
    try {
      const parsed = new URL(trimmed);
      const directImgUrl = parsed.searchParams.get('imgurl');
      if (directImgUrl && (directImgUrl.startsWith('http://') || directImgUrl.startsWith('https://'))) {
        return normalizeImageUrl(directImgUrl);
      }
    } catch {
      const match = trimmed.match(/[?&]imgurl=([^&]+)/i);
      if (match && match[1]) {
        try {
          const decoded = decodeURIComponent(match[1]);
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            return normalizeImageUrl(decoded);
          }
        } catch {
          // ignore malformed URI sequence
        }
      }
    }
  }

  // Handle Google Drive links (file/d/ID, open?id=ID, uc?id=ID, thumbnail?id=ID)
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    // Case 1: https://drive.google.com/file/d/FILE_ID/view...
    const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }

    // Case 2: https://drive.google.com/open?id=FILE_ID, uc?id=FILE_ID, or thumbnail?id=FILE_ID
    const queryIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (queryIdMatch && queryIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${queryIdMatch[1]}`;
    }
  }

  // Handle Dropbox preview links (convert directly to direct dl.dropboxusercontent.com CDN)
  if (trimmed.includes('dropbox.com')) {
    try {
      const parsed = new URL(trimmed);
      parsed.hostname = 'dl.dropboxusercontent.com';
      parsed.searchParams.delete('dl');
      parsed.searchParams.delete('raw');
      return parsed.toString();
    } catch {
      let direct = trimmed.replace(/^https?:\/\/(www\.)?dropbox\.com\//i, 'https://dl.dropboxusercontent.com/');
      direct = direct.replace(/[?&]dl=[01]/g, '').replace(/[?&]raw=[01]/g, '');
      if (direct.includes('&') && !direct.includes('?')) {
        direct = direct.replace('&', '?');
      }
      direct = direct.replace(/[?&]$/, '');
      return direct;
    }
  }

  return trimmed;
}
