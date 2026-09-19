const { normalizeEventRecord } = require('../event-model');

const USER_AGENT = 'CyberNewsSentinel/1.0 (+Discord security event notifier)';

function unfoldLines(value) {
  return String(value || '').replace(/\r?\n[ \t]/gu, '').split(/\r?\n/gu);
}

function unescapeText(value) {
  return String(value || '')
    .replace(/\\[nN]/gu, '\n')
    .replace(/\\,/gu, ',')
    .replace(/\\;/gu, ';')
    .replace(/\\\\/gu, '\\')
    .trim();
}

function parseProperty(line) {
  const separator = line.indexOf(':');
  if (separator < 1) return null;
  const declaration = line.slice(0, separator);
  const [rawName, ...rawParameters] = declaration.split(';');
  const parameters = Object.fromEntries(rawParameters.flatMap((parameter) => {
    const equals = parameter.indexOf('=');
    return equals < 1 ? [] : [[parameter.slice(0, equals).toUpperCase(), parameter.slice(equals + 1)]];
  }));
  return { name: rawName.toUpperCase(), parameters, value: line.slice(separator + 1) };
}

function timeZoneOffset(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second),
  ) - timestamp;
}

function parseIcalDate(value, parameters = {}, fallbackTimeZone = 'UTC') {
  const text = String(value || '').trim();
  const dateOnly = text.match(/^(\d{4})(\d{2})(\d{2})$/u);
  if (dateOnly) {
    return {
      date: new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))),
      allDay: true,
    };
  }
  const dateTime = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/u);
  if (!dateTime) return { date: null, allDay: false };
  const utcGuess = Date.UTC(
    Number(dateTime[1]), Number(dateTime[2]) - 1, Number(dateTime[3]),
    Number(dateTime[4]), Number(dateTime[5]), Number(dateTime[6]),
  );
  if (dateTime[7]) return { date: new Date(utcGuess), allDay: false };
  const timeZone = parameters.TZID || fallbackTimeZone;
  try {
    const first = utcGuess - timeZoneOffset(utcGuess, timeZone);
    return { date: new Date(utcGuess - timeZoneOffset(first, timeZone)), allDay: false };
  } catch {
    return { date: null, allDay: false };
  }
}

function googleCalendarEventUrl(uid, calendarId) {
  if (!uid || !calendarId) return '';
  const eid = Buffer.from(`${uid} ${calendarId}`, 'utf8').toString('base64url');
  return `https://calendar.google.com/calendar/event?eid=${eid}`;
}

function eventKind(text) {
  if (/ctf|競賽|比賽|攻防賽/iu.test(text)) return 'competition';
  if (/workshop|課程|社課|培訓|訓練|講座/iu.test(text)) return 'training';
  if (/conference|研討會|年會|高峰會/iu.test(text)) return 'conference';
  return 'community';
}

function matchesSourceRules(event, source) {
  const text = `${event.title}\n${event.description}`;
  const included = !source.includeKeywords?.length
    || source.includeKeywords.some((keyword) => new RegExp(keyword, 'iu').test(text));
  const excluded = source.excludeKeywords?.some((keyword) => new RegExp(keyword, 'iu').test(text));
  return included && !excluded;
}

function parseIcalEvents(ical, source) {
  const rawEvents = [];
  let current = null;
  for (const line of unfoldLines(ical)) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) rawEvents.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const property = parseProperty(line);
    if (property && current[property.name] === undefined) current[property.name] = property;
  }

  return rawEvents.flatMap((raw) => {
    if (raw.STATUS?.value === 'CANCELLED') return [];
    const title = unescapeText(raw.SUMMARY?.value);
    const uid = unescapeText(raw.UID?.value);
    const starts = parseIcalDate(raw.DTSTART?.value, raw.DTSTART?.parameters, source.timeZone);
    const ends = raw.DTEND
      ? parseIcalDate(raw.DTEND.value, raw.DTEND.parameters, source.timeZone)
      : starts;
    const url = /^https:\/\//iu.test(raw.URL?.value || '')
      ? unescapeText(raw.URL.value)
      : googleCalendarEventUrl(uid, source.calendarId);
    if (!title || !uid || !starts.date || !ends.date || !url) return [];
    const description = unescapeText(raw.DESCRIPTION?.value);
    const event = normalizeEventRecord({
      id: `ical:${source.id}:${uid}`,
      sourceId: `ical:${source.id}`,
      source: source.name,
      title,
      description,
      url,
      startsAt: starts.date,
      endsAt: ends.date,
      allDay: starts.allDay,
      timeZone: source.timeZone,
      location: unescapeText(raw.LOCATION?.value),
      kind: eventKind(`${title}\n${description}`),
      audience: source.audience,
      evidence: { calendar: source.calendarUrl },
    });
    return event && matchesSourceRules(event, source) ? [event] : [];
  });
}

async function fetchIcalEvents({ source, start, finish, fetchImpl = fetch }) {
  const response = await fetchImpl(source.calendarUrl, {
    headers: { Accept: 'text/calendar, text/plain;q=0.9', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`${new URL(source.calendarUrl).host} returned HTTP ${response.status}`);
  const events = parseIcalEvents(await response.text(), source);
  return events.filter((event) => event.startsAt >= start && event.startsAt <= finish);
}

module.exports = {
  fetchIcalEvents,
  googleCalendarEventUrl,
  matchesSourceRules,
  parseIcalDate,
  parseIcalEvents,
};
