const { XMLParser } = require('fast-xml-parser');
const { decodeHtml, extractImage } = require('./news-feed');

const USER_AGENT = 'CyberNewsSentinel/1.0 (+Discord security news notifier)';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text', trimValues: false });

function asArray(value) { return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]; }

function scalar(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return scalar(value['#text'] ?? value.__cdata ?? '');
  return '';
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href.replace(/^http:/iu, 'https:') : '';
  } catch { return ''; }
}

function categories(values) {
  return [...new Set(asArray(values).map((value) => scalar(value.term ?? value)).map(decodeHtml).filter(Boolean))].slice(0, 5);
}

function normalizeArticle({ id, url, title, summaryHtml, contentHtml, published, author, category }) {
  const date = new Date(published || '');
  const canonicalUrl = safeUrl(url);
  if (!canonicalUrl || !Number.isFinite(date.getTime())) return null;
  const analysisHtml = scalar(contentHtml) || scalar(summaryHtml);
  const analysisText = decodeHtml(analysisHtml).slice(0, 8_000);
  return {
    id: scalar(id) || canonicalUrl,
    url: canonicalUrl,
    title: decodeHtml(scalar(title) || 'Untitled'),
    summary: decodeHtml(scalar(summaryHtml) || analysisHtml).slice(0, 380),
    analysisText,
    contentDepth: scalar(contentHtml) ? 'feed_content' : 'summary_only',
    published: date,
    author: decodeHtml(scalar(author)),
    categories: categories(category),
    imageUrl: extractImage(analysisHtml),
  };
}

function rssLink(item) {
  const link = asArray(item.link).find((value) => typeof value === 'string' || value?.href);
  return scalar(link?.href ?? link);
}

function atomLink(entry) {
  const links = asArray(entry.link);
  const preferred = links.find((link) => (!link.rel || link.rel === 'alternate') && (!link.type || link.type === 'text/html'));
  return preferred?.href || scalar(preferred || links[0]);
}

function parseRss(channel) {
  return asArray(channel?.item).map((item) => normalizeArticle({
    id: item.guid, url: rssLink(item), title: item.title, summaryHtml: item.description,
    contentHtml: item['content:encoded'], published: item.pubDate || item['dc:date'],
    author: item.author || item['dc:creator'], category: item.category,
  })).filter(Boolean);
}

function parseAtom(feed) {
  return asArray(feed?.entry).map((entry) => normalizeArticle({
    id: entry.id, url: atomLink(entry), title: entry.title, summaryHtml: entry.summary,
    contentHtml: entry.content, published: entry.published || entry.updated,
    author: entry.author?.name || entry.author, category: entry.category,
  })).filter(Boolean);
}

function parseSyndicationFeed(xml) {
  let document;
  try { document = parser.parse(String(xml || '')); } catch (error) { throw new Error(`Syndication feed returned invalid XML: ${error.message}`); }
  if (document?.rss?.channel) return parseRss(document.rss.channel);
  if (document?.feed) return parseAtom(document.feed);
  throw new Error('Syndication feed returned an unsupported document');
}

async function fetchSyndicationFeed(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).host} returned HTTP ${response.status}`);
  return parseSyndicationFeed(await response.text());
}

module.exports = { fetchSyndicationFeed, parseSyndicationFeed };
