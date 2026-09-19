const STUDENT_CALENDARS = new Set(['ical:scist', 'ical:bamboofox']);
const ROUTINE = /社課|迎新|社團博覽會|助教時間|內部培訓|例行社團|club meeting|members.only|internal training/iu;
const RESTRICTED = /不對外開放|未對外開放|僅限.{0,12}(?:社員|本校|校內)|限本校|限社員|not open to (?:the )?public/iu;
const PUBLIC = /對外開放|公開報名|開放校外|歡迎校外|不限學校|open to (?:the public|everyone|all)/iu;
const SECURITY = /資安|資訊安全|CTF|security|\bpwn\b|逆向|密碼學|鑑識|滲透|漏洞/iu;

function isEligibleEvent(event) {
  const text = `${event.title || ''}\n${event.description || ''}`;
  if (ROUTINE.test(text) || RESTRICTED.test(text)) return false;
  const sources = [event.sourceId, ...(event.sources || [])];
  if (sources.some((source) => STUDENT_CALENDARS.has(source))) {
    return PUBLIC.test(text) && SECURITY.test(text);
  }
  return true;
}

module.exports = { isEligibleEvent };
