const USER_AGENT = 'NewsDiscordBot/1.0 (+Discord news notifier)';

function decodeHtml(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const hex = entity[1]?.toLowerCase() === 'x';
        const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      }
      return named[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBloggerFeed(payload) {
  const entries = payload?.feed?.entry;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    const link = entry.link?.find((item) => item.rel === 'alternate' && item.type === 'text/html')?.href;
    const published = new Date(entry.published?.$t || entry.updated?.$t || '');
    if (!link || Number.isNaN(published.getTime())) return [];

    const canonicalUrl = link.replace(/^http:\/\//i, 'https://');
    const id = entry.id?.$t || canonicalUrl;
    const summaryHtml = entry.summary?.$t || entry.content?.$t || '';
    const analysisHtml = entry.content?.$t || entry.summary?.$t || '';
    const analysisText = decodeHtml(analysisHtml).slice(0, 8_000);

    return [{
      id,
      url: canonicalUrl,
      title: decodeHtml(entry.title?.$t || 'Untitled'),
      summary: decodeHtml(summaryHtml).slice(0, 380),
      analysisText,
      contentDepth: entry.content?.$t ? 'feed_content' : 'summary_only',
      published,
      author: decodeHtml(entry.author?.[0]?.name?.$t || ''),
      categories: (entry.category || []).map((item) => item.term).filter(Boolean).slice(0, 5),
      imageUrl: extractImage(analysisHtml),
    }];
  });
}

function extractImage(html = '') {
  const match = html.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
  if (!match) return '';
  try {
    const url = new URL(match[1]);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

async function fetchNews(feedUrl, fetchImpl = fetch) {
  const response = await fetchImpl(feedUrl, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`News feed returned HTTP ${response.status}`);
  return parseBloggerFeed(await response.json());
}

module.exports = { decodeHtml, fetchNews, parseBloggerFeed };
