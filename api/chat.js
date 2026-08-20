const { createClient } = require('@supabase/supabase-js');

const PRIMARY_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b';

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ============================================================================
// Site data — mirrors the constants/logic in script.js so the assistant can
// answer with real, computed numbers (schedule, attendance %, HSS, overrides)
// instead of only whatever the frontend happened to pass in `context`.
// If script.js's SCHEDULE / HSS_ELECTIVES / MBA_COURSE ever change, mirror
// the change here too — this is a deliberate duplicate, not a shared import.
// ============================================================================

function tm(h, m) { return h * 60 + m; }
const pad = n => (n < 10 ? '0' + n : '' + n);

const SEMESTER_START = new Date(2026, 6, 28); // 28 Jul 2026 (Tue)
const ATT_THRESHOLD = 75;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SCHEDULE = [
  { day: 1, start: tm(16, 0), end: tm(16, 55), code: "CB2102", type: "lecture", room: "R102" },
  { day: 1, start: tm(17, 0), end: tm(17, 55), code: "CB2103", type: "lecture", room: "R307" },
  { day: 2, start: tm(9, 0), end: tm(9, 55), code: "CB2105", type: "lecture", room: "R106" },
  { day: 2, start: tm(10, 0), end: tm(10, 55), code: "CB2104", type: "lecture", room: "R102" },
  { day: 2, start: tm(15, 0), end: tm(16, 55), code: "CB2101", type: "lecture", room: "R105" },
  { day: 3, start: tm(9, 0), end: tm(9, 55), code: "CB2105", type: "lecture", room: "R307" },
  { day: 3, start: tm(10, 0), end: tm(10, 55), code: "CB2103", type: "lecture", room: "R307" },
  { day: 3, start: tm(15, 0), end: tm(16, 55), code: "CB2102", type: "lecture", room: "R102" },
  { day: 3, start: tm(17, 0), end: tm(17, 55), code: "CB2104", type: "lecture", room: "LT001" },
  { day: 4, start: tm(10, 0), end: tm(12, 55), code: "CB2103", type: "lab", room: "Lab" },
  { day: 4, start: tm(15, 0), end: tm(15, 55), code: "CB2103", type: "lecture", room: "R102" },
  { day: 4, start: tm(16, 0), end: tm(18, 0), code: "CB2104", type: "lecture", room: "LT001" },
  { day: 5, start: tm(9, 0), end: tm(9, 55), code: "CB2105", type: "lecture", room: "R110" },
  { day: 5, start: tm(10, 0), end: tm(11, 55), code: "CB2102", type: "lab", room: "Lab" },
  { day: 5, start: tm(15, 0), end: tm(15, 55), code: "CB2102", type: "lecture", room: "R102" },
].sort((a, b) => a.day - b.day || a.start - b.start);

const COURSE_CODES = [...new Set(SCHEDULE.map(s => s.code))].sort();

const DEFAULT_COURSE_NAMES = {
  CB2101: "Introduction to Chemical Engineering",
  CB2102: "Fluid Mechanics",
  CB2103: "Heat Transfer",
  CB2104: "Chemical Process Calculations",
  CB2105: "Chemical Engineering Thermodynamics",
  HS2101: "Mathematical Statistics",
  HS2110: "Language Human Mind and Indian Society",
  HS2111: "Introductory Sociology",
  HS2112: "Introduction to Demography",
};

const LAB_SPLIT_COURSES = new Set(["CB2102", "CB2103"]);

const HSS_START = tm(14, 0), HSS_END = tm(15, 0);
const HSS_ELECTIVES = [
  { code: "HS2110", sessions: [{ day: 3, room: "LT103" }, { day: 4, room: "LT103" }, { day: 5, room: "LT103" }] },
  { code: "HS2111", sessions: [{ day: 2, room: "LT001" }, { day: 3, room: "LT001" }, { day: 4, room: "LT001" }] },
  { code: "HS2112", sessions: [{ day: 2, room: "LT103" }, { day: 3, room: "LT003" }, { day: 4, room: "LT003" }] },
];
const HSS_MAP = {};
HSS_ELECTIVES.forEach(h => HSS_MAP[h.code] = h);

const MBA_ROLL_PREFIX = "2503CB";
function isMbaRoll(roll) { return typeof roll === "string" && roll.toUpperCase().startsWith(MBA_ROLL_PREFIX); }
const MBA_COURSE = {
  code: "HS2101",
  sessions: [
    { day: 1, start: tm(15, 0), end: tm(15, 55), room: "B1/202" },
    { day: 3, start: tm(10, 0), end: tm(10, 55), room: "B1/202" },
    { day: 5, start: tm(10, 0), end: tm(10, 55), room: "B1/202" },
    { day: 5, start: tm(15, 0), end: tm(15, 55), room: "B1/202", tag: "tutorial" },
  ]
};

const STUDENTS = [{"roll":"2501CB23","name":"AARSH JAIN"},{"roll":"2501CB49","name":"ABHI RAJ"},{"roll":"2501CB13","name":"ABHINAV B"},{"roll":"2501CB33","name":"ABHISHEK BANSAL"},{"roll":"2501CB58","name":"ADWAIT VATS"},{"roll":"2501CB42","name":"AHAN BHATTACHARJEE"},{"roll":"2501CB39","name":"AMAN SAROJ"},{"roll":"2501CB14","name":"ANGAJ SAHIL SARJERAO"},{"roll":"2501CB34","name":"ANSER AYAAN"},{"roll":"2501CB62","name":"ANSHU VISHWAKARMA"},{"roll":"2501CB37","name":"ANUPAM SHARMA"},{"roll":"2501CB06","name":"ARCHIT SHANKER"},{"roll":"2501CB26","name":"ARYAN DEV"},{"roll":"2501CB41","name":"AVDHESH MEENA"},{"roll":"2501CB16","name":"BIBHAS BIKASH BISWAS"},{"roll":"2501CB32","name":"BIKI BARMAN"},{"roll":"2501CB60","name":"BISWAS MAYANK PRADYUT"},{"roll":"2501CB51","name":"BOYINA SADVIKA"},{"roll":"2501CB46","name":"CHILMAKURI CHARAN"},{"roll":"2501CB24","name":"DHADSE OMESH VASANTRAO"},{"roll":"2501CB19","name":"DHRUV AGNIHOTRI"},{"roll":"2501CB22","name":"DHRUV ARVIND GANATRA"},{"roll":"2501CB03","name":"DIA HALDER"},{"roll":"2501CB04","name":"EMIN PHILIP SAJI"},{"roll":"2501CB40","name":"GAURAV SUKHADIA"},{"roll":"2501CB47","name":"HARIOM SINGH"},{"roll":"2501CB31","name":"HEMANT KUMAR BAIRWA"},{"roll":"2501CB01","name":"J SAMRUTHA"},{"roll":"2501CB07","name":"JARPULA MURALI"},{"roll":"2501CB05","name":"KAJAL BATRA"},{"roll":"2501CB11","name":"KARISHMA"},{"roll":"2501CB10","name":"KATURI VANSHIKA"},{"roll":"2501CB29","name":"KAVYA GUPTA"},{"roll":"2501CB48","name":"MADA AKEERA SRI VARSHAN"},{"roll":"2501CB43","name":"MADHUR SRIVASTAVA"},{"roll":"2501CB08","name":"MANAV RATHORE"},{"roll":"2501CB21","name":"NASREEN FATIMA"},{"roll":"2501CB20","name":"OSHI MALVIYA"},{"roll":"2501CB45","name":"PILLI SRI VAISHNAVI"},{"roll":"2501CB02","name":"PRIYANSHI PATEL"},{"roll":"2501CB12","name":"PUSHPENDRA SHARMA"},{"roll":"2501CB57","name":"RAGHVENDRA MEENA"},{"roll":"2501CB56","name":"RAJ ARYAN"},{"roll":"2501CB50","name":"RAUSHAN KUMAR"},{"roll":"2501CB54","name":"RIDDHI PATEL"},{"roll":"2501CB35","name":"S ADITYA"},{"roll":"2501CB55","name":"SACHIN"},{"roll":"2501CB38","name":"SAI SUBRAT JENA"},{"roll":"2501CB44","name":"SAKALA SATHWIK"},{"roll":"2501CB15","name":"SAMIT SARDAR"},{"roll":"2501CB53","name":"SANKET YADAV JADHAV"},{"roll":"2501CB09","name":"SAPTARSHI BOSE"},{"roll":"2501CB52","name":"SARTHAK ANUSIMI"},{"roll":"2501CB61","name":"SATISH KUMAR YADAV"},{"roll":"2501CB28","name":"SHANTANU SARDAR"},{"roll":"2501CB64","name":"SHORYA PRATAP SINGH"},{"roll":"2501CB59","name":"SNEHADIP GHOSH"},{"roll":"2501CB30","name":"SWARNAVA KUNDU"},{"roll":"2501CB63","name":"TANIYA KUMARI GUPTA"},{"roll":"2501CB25","name":"VAANYA VERMA"},{"roll":"2501CB36","name":"VADAVELLI KAMALI HARSHITHA"},{"roll":"2501CB65","name":"VADITHYA UPENDAR"},{"roll":"2501CB17","name":"VAIBHAV SANJAY BHAGURE"},{"roll":"2501CB27","name":"VAISHNAV KRISHNA DURGASI"},{"roll":"2501CB18","name":"VANSH KHURANA"},{"roll":"2503CB01","name":"ADARSH CHOUDHARY"},{"roll":"2503CB02","name":"AMOOLYA SHARAN"},{"roll":"2503CB05","name":"DHEERAJ KUMAR"},{"roll":"2503CB03","name":"TEJVEER"},{"roll":"2503CB04","name":"YASH MADHOK"}];
const STUDENT_MAP = {};
STUDENTS.forEach(s => STUDENT_MAP[s.roll.toUpperCase()] = s.name);

const ANNOUNCE_TTL_HOURS = 6;

function getISTNow() {
  // India has no DST, so this stays accurate; matches the client's own
  // wall-clock reading of "now" for IST users.
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}
function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function startOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmtHM(mins) {
  let h = Math.floor(mins / 60), m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ":" + pad(m) + " " + ap;
}

function buildPersonalWeekSchedule(hssCode, roll) {
  let list = SCHEDULE.slice();
  if (hssCode && HSS_MAP[hssCode]) {
    HSS_MAP[hssCode].sessions.forEach(sess => {
      list.push({ day: sess.day, start: HSS_START, end: HSS_END, code: hssCode, type: "hss", room: sess.room });
    });
  }
  if (isMbaRoll(roll)) {
    MBA_COURSE.sessions.forEach(sess => {
      list.push({ day: sess.day, start: sess.start, end: sess.end, code: MBA_COURSE.code, type: "mba", room: sess.room, tag: sess.tag });
    });
  }
  return list.sort((a, b) => a.day - b.day || a.start - b.start);
}

function sessionSig(s) { return s.code + "|" + s.start + "|" + s.room; }

function scheduleForDate(weekSchedule, overrides, date) {
  const dow = date.getDay();
  const iso = isoDate(date);
  let list = weekSchedule.filter(s => s.day === dow);
  const ov = overrides[iso];
  if (ov && ov.removed && ov.removed.length) {
    const removedSet = new Set(ov.removed);
    list = list.filter(s => !removedSet.has(sessionSig(s)));
  }
  if (ov && ov.extra && ov.extra.length) {
    list = list.concat(ov.extra.map(e => Object.assign({}, e, { day: dow, isExtra: true })));
  }
  return list.slice().sort((a, b) => a.start - b.start);
}

function sessionHasStarted(d, s, now) {
  const dayStart = startOfDay(d).getTime();
  const todayStart = startOfDay(now).getTime();
  if (dayStart > todayStart) return false;
  if (dayStart < todayStart) return true;
  return (now.getHours() * 60 + now.getMinutes()) >= s.start;
}

function markKeyFor(dateIso, s) { return dateIso + "|" + s.code + "|" + s.start; }
function statKeyForSession(code, sessionType) {
  if (LAB_SPLIT_COURSES.has(code)) return sessionType === 'lab' ? code + ':lab' : code + ':theory';
  return code;
}
function activeCourseCodes(hssCode, roll) {
  const codes = COURSE_CODES.slice();
  if (hssCode && HSS_MAP[hssCode]) codes.push(hssCode);
  if (isMbaRoll(roll)) codes.push(MBA_COURSE.code);
  return codes;
}
function statGroupsForActiveCourses(hssCode, roll) {
  const groups = [];
  activeCourseCodes(hssCode, roll).forEach(code => {
    if (LAB_SPLIT_COURSES.has(code)) {
      groups.push({ key: code + ':theory', code, label: 'Theory' });
      groups.push({ key: code + ':lab', code, label: 'Lab' });
    } else {
      groups.push({ key: code, code, label: null });
    }
  });
  return groups;
}

function computeStats(weekSchedule, overrides, attendanceMarks, hssCode, roll, now) {
  const stats = {};
  statGroupsForActiveCourses(hssCode, roll).forEach(g => stats[g.key] = { present: 0, total: 0 });
  let totalPresent = 0, totalMarked = 0;

  const start = startOfDay(SEMESTER_START);
  const end = startOfDay(now);
  if (start.getTime() <= end.getTime()) {
    for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      const iso = isoDate(d);
      scheduleForDate(weekSchedule, overrides, d).forEach(s => {
        if (!sessionHasStarted(d, s, now)) return;
        const key = markKeyFor(iso, s);
        const val = attendanceMarks[key] || 'a';
        if (val === 'c') return;
        const statKey = statKeyForSession(s.code, s.type);
        if (!stats[statKey]) stats[statKey] = { present: 0, total: 0 };
        stats[statKey].total++;
        totalMarked++;
        if (val === 'p') { stats[statKey].present++; totalPresent++; }
      });
    }
  }
  return { stats, totalPresent, totalMarked };
}

function attendanceProjection(present, total) {
  if (!total) return null;
  const T = ATT_THRESHOLD / 100;
  const pct = present / total;
  if (pct >= T) {
    const canSkip = Math.floor(present / T - total);
    return canSkip > 0
      ? `can skip the next ${canSkip} and stay ≥${ATT_THRESHOLD}%`
      : `no room left — the next miss drops it below ${ATT_THRESHOLD}%`;
  }
  const need = Math.max(1, Math.ceil((T * total - present) / (1 - T)));
  return `needs to attend the next ${need} straight to reach ${ATT_THRESHOLD}%`;
}

async function safeSingle(query) {
  try {
    const { data, error } = await query;
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// Fetches this student's live data from Supabase and computes the same
// schedule/attendance numbers the frontend shows, so the assistant can
// answer accurately without the frontend having to spell everything out.
async function fetchSiteContext(rollNumber) {
  const roll = rollNumber ? String(rollNumber).toUpperCase() : null;
  const now = getISTNow();
  const cutoffISO = new Date(now.getTime() - ANNOUNCE_TTL_HOURS * 3600 * 1000).toISOString();

  const [hssRow, attRow, ovRow, namesRow, announceRows, pyqCount, bookCount] = await Promise.all([
    roll && supabase ? safeSingle(supabase.from('cbe_hss').select('code').eq('roll', roll).maybeSingle()) : null,
    roll && supabase ? safeSingle(supabase.from('cbe_attendance').select('attendance').eq('roll', roll).maybeSingle()) : null,
    roll && supabase ? safeSingle(supabase.from('cbe_day_overrides').select('overrides').eq('roll', roll).maybeSingle()) : null,
    supabase ? safeSingle(supabase.from('cbe_course_names').select('names').eq('id', 1).maybeSingle()) : null,
    supabase ? safeSingle(supabase.from('cbe_announcements').select('id,message,created_at').gte('created_at', cutoffISO).order('created_at', { ascending: false }).limit(5)) : null,
    supabase ? safeSingle(supabase.from('cbe_pyq_files').select('id', { count: 'exact', head: true })) : null,
    supabase ? safeSingle(supabase.from('cbe_reference_books').select('id', { count: 'exact', head: true })) : null,
  ]);

  const courseNames = Object.assign({}, DEFAULT_COURSE_NAMES, (namesRow && namesRow.names) || {});
  const result = { announcements: announceRows || [], now };

  if (roll) {
    const hssCode = hssRow && hssRow.code ? hssRow.code : null;
    const attendanceMarks = (attRow && attRow.attendance) || {};
    const overrides = (ovRow && ovRow.overrides) || {};
    const weekSchedule = buildPersonalWeekSchedule(hssCode, roll);

    // Today's sessions with live status.
    const todaysList = scheduleForDate(weekSchedule, overrides, now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todaysSessions = todaysList.map(s => {
      let status = 'upcoming';
      if (nowMin >= s.end) status = 'finished';
      else if (nowMin >= s.start) status = 'in progress';
      return {
        code: s.code, name: courseNames[s.code] || s.code, type: s.type, room: s.room,
        start: fmtHM(s.start), end: fmtHM(s.end), status, extra: !!s.isExtra,
      };
    });

    // Next upcoming class, searching forward if none left today.
    let nextClass = null;
    for (let dayOffset = 0; dayOffset <= 7 && !nextClass; dayOffset++) {
      const d = addDays(now, dayOffset);
      const list = scheduleForDate(weekSchedule, overrides, d);
      const candidate = list.find(s => dayOffset > 0 || (now.getHours() * 60 + now.getMinutes()) < s.start);
      if (candidate) {
        nextClass = {
          code: candidate.code, name: courseNames[candidate.code] || candidate.code,
          type: candidate.type, room: candidate.room, start: fmtHM(candidate.start),
          when: dayOffset === 0 ? 'today' : dayOffset === 1 ? 'tomorrow' : DAY_NAMES[d.getDay()],
        };
      }
    }

    // Attendance stats.
    const { stats, totalPresent, totalMarked } = computeStats(weekSchedule, overrides, attendanceMarks, hssCode, roll, now);
    const overallPct = totalMarked ? Math.round((totalPresent / totalMarked) * 100) : null;
    const perCourse = statGroupsForActiveCourses(hssCode, roll).map(g => {
      const st = stats[g.key] || { present: 0, total: 0 };
      const pct = st.total ? Math.round((st.present / st.total) * 100) : null;
      return {
        code: g.code, label: g.label, name: courseNames[g.code] || g.code,
        present: st.present, total: st.total, pct,
        projection: st.total ? attendanceProjection(st.present, st.total) : null,
      };
    });

    result.roll = roll;
    result.studentName = STUDENT_MAP[roll] || null;
    result.hssCode = hssCode;
    result.hssName = hssCode ? (courseNames[hssCode] || hssCode) : null;
    result.isMba = isMbaRoll(roll);
    result.todaysSessions = todaysSessions;
    result.nextClass = nextClass;
    result.attendance = { overallPct, totalPresent, totalMarked, perCourse };
  }

  result.resourceCounts = {
    pyq: pyqCount && typeof pyqCount.count === 'number' ? pyqCount.count : null,
    books: bookCount && typeof bookCount.count === 'number' ? bookCount.count : null,
  };

  return result;
}

function formatSiteContext(site) {
  if (!site) return '';
  const lines = [];
  const dayLabel = DAY_NAMES[site.now.getDay()];
  const dateLabel = `${dayLabel} ${site.now.getDate()}/${site.now.getMonth() + 1}/${site.now.getFullYear()}`;
  lines.push(`Current date/time (IST): ${dateLabel}, ${fmtHM(site.now.getHours() * 60 + site.now.getMinutes())}`);

  if (site.roll) {
    if (site.studentName) lines.push(`Student: ${site.studentName} (${site.roll})`);
    lines.push(`HSS elective: ${site.hssName ? `${site.hssCode} — ${site.hssName}` : 'not yet selected'}`);
    if (site.isMba) lines.push(`Also enrolled in the MBA-track course (HS2101 Mathematical Statistics).`);

    if (site.todaysSessions.length) {
      lines.push(`Today's schedule:`);
      site.todaysSessions.forEach(s => {
        lines.push(`- ${s.start}-${s.end} ${s.code} (${s.name}) ${s.type} @ ${s.room} — ${s.status}${s.extra ? ' [added for today]' : ''}`);
      });
    } else {
      lines.push(`Today's schedule: no classes today.`);
    }

    if (site.nextClass) {
      const nc = site.nextClass;
      lines.push(`Next class: ${nc.code} (${nc.name}) ${nc.type} at ${nc.start} in ${nc.room}, ${nc.when}.`);
    } else {
      lines.push(`Next class: none found in the coming week.`);
    }

    const att = site.attendance;
    if (att.totalMarked) {
      lines.push(`Overall attendance: ${att.overallPct}% (${att.totalPresent}/${att.totalMarked} sessions held so far, since semester start 28 Jul 2026).`);
      lines.push(`Per-course attendance:`);
      att.perCourse.forEach(c => {
        if (!c.total) { lines.push(`- ${c.code}${c.label ? ' ' + c.label : ''} (${c.name}): no sessions held yet.`); return; }
        lines.push(`- ${c.code}${c.label ? ' ' + c.label : ''} (${c.name}): ${c.pct}% (${c.present}/${c.total}) — ${c.projection}`);
      });
    } else {
      lines.push(`Attendance: no sessions have been held yet this semester.`);
    }
  } else {
    lines.push(`No roll number available for this session — personal schedule/attendance/HSS data cannot be looked up. If the student asks about their own attendance or schedule, tell them to make sure they're logged in.`);
  }

  if (site.announcements && site.announcements.length) {
    lines.push(`Recent announcements (last ${ANNOUNCE_TTL_HOURS}h):`);
    site.announcements.forEach(a => lines.push(`- ${a.message}`));
  }

  if (site.resourceCounts.pyq !== null || site.resourceCounts.books !== null) {
    const parts = [];
    if (site.resourceCounts.pyq !== null) parts.push(`${site.resourceCounts.pyq} previous-year question files`);
    if (site.resourceCounts.books !== null) parts.push(`${site.resourceCounts.books} reference books`);
    lines.push(`Resources available in the app: ${parts.join(', ')} (student can browse these in the Resources tab).`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(context, references, site) {
  let prompt = `You are the in-app assistant for a CBE (Chemical & Biochemical Engineering) 2nd-year student timetable app at IIT Patna.

Rules:
- Be direct and to the point. 1-3 sentences for most answers. Only go longer if the student explicitly asks for detail, a list, or steps.
- No filler openers like "Great question!" or "I'd be happy to help." Just answer.
- Plain text only — no markdown headers, no bullet-heavy formatting unless the answer is genuinely a list.
- You DO have access to this student's live schedule, attendance, HSS elective, and app announcements — it's given to you below as ground truth. Use it directly and confidently; never say you don't have access to the site's data.
- If something is genuinely missing from the data below (e.g. a question about another student, or a feature with no data given), say so plainly instead of guessing. Never invent class timings, room numbers, or attendance figures that aren't in the data below.
- You are not limited to app/timetable topics. Answer any question the student asks — coursework, general knowledge, advice, whatever — like a knowledgeable, helpful general assistant. Only nudge back on-topic if the question is actually about the app itself and you're missing the data to answer it.`;

  const siteBlock = formatSiteContext(site);
  if (siteBlock) {
    prompt += `\n\nLive app data for this student right now (ground truth — trust this over anything else, including your own assumptions):\n${siteBlock}`;
  }

  if (context && typeof context === 'object') {
    const parts = [];
    if (context.currentClass) parts.push(`Frontend-reported current/next class: ${context.currentClass}`);
    if (context.day) parts.push(`Frontend-reported day: ${context.day}`);
    if (context.time) parts.push(`Frontend-reported time: ${context.time}`);
    if (parts.length) {
      prompt += `\n\nAdditional UI state reported by the frontend (only use if it fills a gap in the live app data above — the live app data above wins on any conflict):\n` + parts.map(p => `- ${p}`).join('\n');
    }
  }

  if (references && references.length) {
    prompt += `\n\nRelevant answers from previous student conversations (reuse if they genuinely apply; prefer live app data above if they conflict; don't mention that this came from "previous conversations" — just answer naturally):\n` +
      references.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n');
  }

  return prompt;
}

// Pull the most recent user message to use as the search query for past Q&A.
function getLatestUserQuestion(trimmedMessages) {
  for (let i = trimmedMessages.length - 1; i >= 0; i--) {
    if (trimmedMessages[i].role === 'user') return trimmedMessages[i].content;
  }
  return '';
}

async function getEmbedding(text) {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || !text || !text.trim()) return null;
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        input: [text.slice(0, 4000)],
        model: 'voyage-3.5-lite'
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.data && data.data[0] && data.data[0].embedding ? data.data[0].embedding : null;
  } catch (e) {
    return null;
  }
}

async function getRelevantReferences(question) {
  if (!supabase || !question || question.trim().length < 3) return [];

  // Best: semantic search — matches by MEANING, so a differently
  // phrased or informally-worded question still finds the relevant
  // past answer, no matter how old it is.
  const embedding = await getEmbedding(question);
  if (embedding) {
    try {
      const { data, error } = await supabase.rpc('match_ai_knowledge_semantic', {
        query_embedding: embedding,
        match_count: 5
      });
      if (!error && data && data.length) return data;
    } catch (e) {
      // fall through to keyword-based search below
    }
  }

  // Fallback (no embeddings key configured, or semantic search found
  // nothing): plain full-text search on exact-ish wording.
  try {
    const { data, error } = await supabase
      .from('cbe_ai_knowledge')
      .select('question, answer')
      .textSearch('search_vector', question, { type: 'plain', config: 'english' })
      .limit(5);

    if (!error && data && data.length) return data;

    // Last resort: fuzzy trigram match for rephrased/informal wording.
    const { data: fuzzyData, error: fuzzyError } = await supabase.rpc('match_ai_knowledge', {
      search_query: question,
      match_count: 5
    });

    if (fuzzyError || !fuzzyData) return [];
    return fuzzyData;
  } catch (e) {
    return [];
  }
}

async function loadChatHistory(rollNumber, limit) {
  if (!supabase || !rollNumber) return [];
  try {
    const { data, error } = await supabase
      .from('cbe_ai_chat_history')
      .select('role, content')
      .eq('roll_number', rollNumber)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.reverse(); // chronological order for the model
  } catch (e) {
    return [];
  }
}

async function saveChatTurn(rollNumber, role, content) {
  if (!supabase || !rollNumber || !content) return;
  try {
    await supabase.from('cbe_ai_chat_history').insert({
      roll_number: rollNumber,
      role,
      content: content.slice(0, 4000)
    });
  } catch (e) {
    // Non-fatal — history logging should never break the chat response.
  }
}

async function saveQA(question, answer, rollNumber) {
  if (!supabase || !question || !answer) return;
  try {
    const embedding = await getEmbedding(question);
    await supabase.from('cbe_ai_knowledge').insert({
      question: question.slice(0, 2000),
      answer: answer.slice(0, 4000),
      roll_number: rollNumber || null,
      embedding: embedding || null
    });
  } catch (e) {
    // Non-fatal — memory logging should never break the chat response.
  }
}

async function callGroq(apiKey, model, systemPrompt, trimmedMessages) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
      max_tokens: 400,
      temperature: 0.4,
      top_p: 0.9
    })
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured: missing GROQ_API_KEY' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const messages = Array.isArray(body && body.messages) ? body.messages : [];
  if (!messages.length) {
    res.status(400).json({ error: 'No messages provided' });
    return;
  }

  const trimmed = messages.slice(-20).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000)
  }));

  const rollNumber = body && body.context && body.context.rollNumber;

  // If the client only sent a short/fresh conversation (e.g. page just
  // loaded), pull in this student's stored history so the AI picks up
  // where earlier sessions left off, instead of starting from scratch.
  let effectiveMessages = trimmed;
  if (rollNumber && trimmed.length <= 2) {
    const history = await loadChatHistory(rollNumber, 30);
    if (history.length) {
      effectiveMessages = [...history, ...trimmed].slice(-30);
    }
  }

  const latestQuestion = getLatestUserQuestion(trimmed);
  const [references, site] = await Promise.all([
    getRelevantReferences(latestQuestion),
    fetchSiteContext(rollNumber),
  ]);
  const systemPrompt = buildSystemPrompt(body && body.context, references, site);

  try {
    let upstream = await callGroq(apiKey, PRIMARY_MODEL, systemPrompt, effectiveMessages);

    if (!upstream.ok && (upstream.status === 429 || upstream.status >= 500)) {
      upstream = await callGroq(apiKey, FALLBACK_MODEL, systemPrompt, effectiveMessages);
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({ error: 'Upstream error', detail: errText.slice(0, 500) });
      return;
    }

    const data = await upstream.json();
    const reply =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content.trim()
        : '';

    if (!reply) {
      res.status(200).json({ reply: "Hmm, I didn't get a clear answer for that — try rephrasing?" });
      return;
    }

    // Save this exchange so future students' questions can benefit from it,
    // and so this specific student's conversation persists across sessions.
    await saveQA(latestQuestion, reply, rollNumber);
    if (rollNumber) {
      await saveChatTurn(rollNumber, 'user', latestQuestion);
      await saveChatTurn(rollNumber, 'assistant', reply);
    }

    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'Request failed', detail: String((e && e.message) || e) });
  }
};