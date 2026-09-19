const { parse } = require('yaml');
const { normalizeEventRecord } = require('../event-model');

const USER_AGENT = 'CyberNewsSentinel/1.0 (+Discord security event notifier)';
const MONTHS = new Map([
  ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['may', 5], ['jun', 6],
  ['jul', 7], ['aug', 8], ['sep', 9], ['oct', 10], ['nov', 11], ['dec', 12],
]);

function taipeiDate(year, month, day, time = '00:00') {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}:00+08:00`;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseTaipeiDeadline(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/u);
  if (!match) return null;
  return taipeiDate(Number(match[1]), Number(match[2]), Number(match[3]), `${match[4].padStart(2, '0')}:${match[5]}`);
}

function parseDatePart(value, fallbackYear) {
  const match = String(value || '').trim().match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?$/u);
  if (!match) return null;
  const month = MONTHS.get(match[1].slice(0, 3).toLowerCase());
  if (!month) return null;
  return {
    year: Number(match[3] || fallbackYear),
    month,
    day: Number(match[2]),
    time: match[4] ? `${match[4].padStart(2, '0')}:${match[5]}` : '',
  };
}

function parseTaiwanDateRange(value, fallbackYear) {
  const text = String(value || '').trim();
  const parts = text.split(/\s+[–—-]\s+/u);
  if (parts.length > 2) return null;
  const startPart = parseDatePart(parts[0], fallbackYear);
  if (!startPart) return null;
  const endPart = parts.length === 2 ? parseDatePart(parts[1], startPart.year) : startPart;
  if (!endPart) return null;
  const start = taipeiDate(startPart.year, startPart.month, startPart.day, startPart.time || '00:00');
  const end = taipeiDate(endPart.year, endPart.month, endPart.day, endPart.time || '23:59');
  if (!start || !end || end < start) return null;
  return { start, end, allDay: !startPart.time && !endPart.time };
}

function deadlineKind(text) {
  if (/投稿|徵稿|submission|cfp/iu.test(text)) return 'submission';
  if (/甄選|選拔|selection/iu.test(text)) return 'selection';
  if (/繳交|資料|document/iu.test(text)) return 'materials';
  if (/報名|registration|register/iu.test(text)) return 'registration';
  return 'unknown';
}

function eventKind(text) {
  if (/\bctf\b|競賽|挑戰賽|技能競賽/iu.test(text)) return 'competition';
  if (/workshop|工作坊/iu.test(text)) return 'workshop';
  if (/課程|培訓|training|camp/iu.test(text)) return 'training';
  if (/conference|summit|研討會|高峰會|大會|hitcon|cybersec/iu.test(text)) return 'conference';
  return 'community';
}

function attendance(tags) {
  const values = new Set((Array.isArray(tags) ? tags : []).map((tag) => String(tag).toUpperCase()));
  if (values.has('ONLINE') && values.has('ONSITE')) return 'hybrid';
  if (values.has('ONLINE')) return 'online';
  if (values.has('ONSITE')) return 'onsite';
  return 'unknown';
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 100);
}

function normalizeTaiwanDeadlineEvent(entry) {
  const year = Number(entry?.year);
  const name = String(entry?.name || '').trim();
  if (!Number.isInteger(year) || !name || !Array.isArray(entry.deadline)) return null;
  const dates = entry.timezone === 'Asia/Taipei' || !entry.timezone
    ? parseTaiwanDateRange(entry.date, year) : null;
  const kind = eventKind(`${name}\n${entry.description || ''}`);
  const note = String(entry.comment || '').trim();
  const inferredKind = entry.deadline.length === 1 ? deadlineKind(`${name}\n${note}`) : 'unknown';
  const deadlines = entry.deadline.flatMap((value) => {
    const at = parseTaipeiDeadline(value);
    return at ? [{ at, kind: inferredKind, note }] : [];
  });
  if (deadlines.length === 0) return null;

  return normalizeEventRecord({
    id: `taiwan-deadlines:${year}:${slug(name)}`,
    sourceId: 'taiwan-security-deadlines',
    source: 'Taiwan Security Deadlines',
    title: name.includes(String(year)) ? name : `${name} ${year}`,
    url: entry.link,
    description: entry.description,
    start: dates?.start || null,
    finish: dates?.end || null,
    startDate: dates?.start?.toISOString().slice(0, 10) || '',
    allDay: dates?.allDay ?? true,
    dateText: entry.date,
    deadlines,
    timeZone: entry.timezone || '',
    attendance: attendance(entry.tags),
    location: entry.place,
    kind,
    audience: /高中職|high school/iu.test(`${name}\n${entry.description || ''}`)
      ? ['high-school'] : [],
  });
}

function inWindow(event, now, finish) {
  const futureDeadlines = event.deadlines.filter(({ at }) => at >= now && at <= finish);
  const activeByDate = event.endsAt && event.endsAt >= now && event.startsAt <= finish;
  return futureDeadlines.length > 0 || activeByDate;
}

async function fetchTaiwanDeadlineEvents({ url, start, finish, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'text/yaml, text/plain;q=0.9', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).host} returned HTTP ${response.status}`);
  let payload;
  try {
    payload = parse(await response.text());
  } catch (error) {
    throw new Error(`Taiwan Security Deadlines returned invalid YAML: ${error.message}`);
  }
  if (!Array.isArray(payload)) throw new Error('Taiwan Security Deadlines returned an unexpected payload');
  return payload.map(normalizeTaiwanDeadlineEvent).filter(Boolean)
    .filter((event) => inWindow(event, start, finish));
}

module.exports = {
  fetchTaiwanDeadlineEvents,
  normalizeTaiwanDeadlineEvent,
  parseTaipeiDeadline,
  parseTaiwanDateRange,
};
