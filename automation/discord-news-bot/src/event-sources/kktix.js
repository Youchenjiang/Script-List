const { XMLParser } = require('fast-xml-parser');
const { normalizeEventRecord } = require('../event-model');
const { decodeHtml } = require('../news-feed');

const USER_AGENT = 'CyberNewsSentinel/1.0 (+Discord security event notifier)';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text', trimValues: false });

function asArray(value) { return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]; }

function scalar(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return scalar(value['#text'] ?? value.__cdata ?? '');
  return '';
}

function taipeiDate(value) {
  const text = String(value || '').trim().replaceAll('/', '-');
  const date = new Date(`${text}:00+08:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseSchedule(content, fallbackStart) {
  const text = decodeHtml(content);
  const match = text.match(/時間：\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\(\+0800\)\s*~\s*(?:(\d{4}\/\d{2}\/\d{2})\s+)?(\d{2}:\d{2})(?:\(\+0800\))?/u);
  const startsAt = match ? taipeiDate(match[1]) : new Date(fallbackStart || '');
  if (!Number.isFinite(startsAt?.getTime())) return { startsAt: null, endsAt: null };
  const endDate = match?.[2] || match?.[1].slice(0, 10);
  const endsAt = match ? taipeiDate(`${endDate} ${match[3]}`) : startsAt;
  return { startsAt, endsAt: endsAt || startsAt };
}

function parseLocation(content) {
  return decodeHtml(content).match(/地點：([^\r\n]*)/u)?.[1]?.trim() || '';
}

function eventKind(text) {
  if (/\bctf\b/iu.test(text)) return 'ctf';
  if (/競賽|挑戰賽|技能競賽|cyber range/iu.test(text)) return 'competition';
  if (/workshop|工作坊/iu.test(text)) return 'workshop';
  if (/課程|培訓|training|camp/iu.test(text)) return 'training';
  if (/conference|summit|研討會|高峰會|年會|大會/iu.test(text)) return 'conference';
  return 'community';
}

function attendance(text, location) {
  const online = /(?:線上|online)(?:活動|競賽|參與|舉辦|作戰|\s+(?:event|competition))/iu.test(text);
  if (location && online) return 'hybrid';
  if (location) return 'onsite';
  return online ? 'online' : 'unknown';
}

function safeEventUrl(value, feedUrl) {
  try {
    const url = new URL(value);
    const feed = new URL(feedUrl);
    if (url.protocol !== 'https:' || url.hostname !== feed.hostname || !url.pathname.startsWith('/events/')) return '';
    url.search = '';
    url.hash = '';
    return url.href.replace(/\/$/u, '');
  } catch { return ''; }
}

function entryLink(entry) {
  const link = asArray(entry.link).find((value) => (!value.rel || value.rel === 'alternate') && (!value.type || value.type === 'text/html'));
  return link?.href || scalar(link);
}

function parseKktixAtom(xml, source) {
  let document;
  try { document = parser.parse(String(xml || '')); } catch (error) { throw new Error(`KKTIX returned invalid Atom: ${error.message}`); }
  if (!document?.feed) throw new Error('KKTIX returned an unsupported Atom document');
  return asArray(document.feed.entry).flatMap((entry) => {
    const url = safeEventUrl(entryLink(entry), source.feedUrl);
    const title = decodeHtml(scalar(entry.title));
    const summary = decodeHtml(scalar(entry.summary));
    const content = scalar(entry.content);
    const { startsAt, endsAt } = parseSchedule(content, scalar(entry.published || entry.updated));
    if (!url || !title || !startsAt || !endsAt) return [];
    const location = parseLocation(content);
    const combined = `${title}\n${summary}\n${decodeHtml(content)}`;
    const event = normalizeEventRecord({
      id: `kktix:${source.id}:${new URL(url).pathname.split('/').filter(Boolean).at(-1)}`,
      sourceId: `kktix:${source.id}`,
      source: source.name,
      title,
      url,
      description: summary,
      startsAt,
      endsAt,
      allDay: false,
      timeZone: 'Asia/Taipei',
      attendance: attendance(combined, location),
      location,
      kind: eventKind(combined),
    });
    return event ? [event] : [];
  });
}

function extractStructuredEvent(html) {
  for (const match of String(html || '').matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)) {
    try {
      const values = asArray(JSON.parse(match[1]));
      const event = values.find((value) => value?.['@type'] === 'Event');
      if (event) return event;
    } catch { /* inspect the next JSON-LD block */ }
  }
  return null;
}

function parseKktixEventPage(html, expectedUrl) {
  const value = extractStructuredEvent(html);
  if (!value || safeEventUrl(value.url, expectedUrl) !== safeEventUrl(expectedUrl, expectedUrl)) {
    throw new Error('KKTIX event page did not contain matching structured data');
  }
  const startsAt = new Date(value.startDate || '');
  const endsAt = new Date(value.endDate || value.startDate || '');
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
    throw new Error('KKTIX event page contained invalid dates');
  }
  const location = [value.location?.name, value.location?.address].map((item) => String(item || '').trim()).filter(Boolean);
  const deadlines = asArray(value.offers).flatMap((offer) => {
    const at = new Date(offer?.validThrough || '');
    return Number.isFinite(at.getTime()) ? [{ at, kind: 'registration', note: String(offer.name || '') }] : [];
  });
  return {
    startsAt,
    endsAt,
    location: [...new Set(location)].join(' / '),
    deadlines,
  };
}

function isActionableKktixEvent(event, now) {
  if (!event?.startsAt || event.startsAt < now) return false;
  if (!event.deadlines?.length) return true;
  return event.deadlines.some(({ at }) => new Date(at) >= now);
}

async function fetchText(url, accept, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { Accept: accept, 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).host} returned HTTP ${response.status}`);
  return response.text();
}

async function fetchKktixEvents({ source, start, finish, fetchImpl = fetch, maxDetails = 20 }) {
  const xml = await fetchText(source.feedUrl, 'application/atom+xml, application/xml;q=0.9', fetchImpl);
  const candidates = parseKktixAtom(xml, source)
    .filter((event) => event.endsAt >= start && event.startsAt <= finish)
    .slice(0, maxDetails);
  const enriched = await Promise.all(candidates.map(async (event) => {
    try {
      const html = await fetchText(event.url, 'text/html', fetchImpl);
      const detail = parseKktixEventPage(html, event.url);
      const combined = `${event.title}\n${event.description}`;
      return normalizeEventRecord({
        ...event,
        ...detail,
        start: detail.startsAt,
        finish: detail.endsAt,
        attendance: attendance(combined, detail.location || event.location),
      });
    } catch {
      return event;
    }
  }));
  return enriched.filter((event) => isActionableKktixEvent(event, start));
}

module.exports = { fetchKktixEvents, isActionableKktixEvent, parseKktixAtom, parseKktixEventPage, parseSchedule, safeEventUrl };
