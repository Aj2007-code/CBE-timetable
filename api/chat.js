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
  { day: 5, start: tm(15, 0), end: tm(15, 55), code: "CB2102", type: "lecture", room: "R102" },
  // NOTE: CB2102's lab is intentionally NOT a fixed weekly slot here — it's a
  // 16-group, alternating-week rotation with a one-off exception, injected
  // per-student by fluidLabSessionForDate() below (mirrors script.js exactly).
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

// L-T-P-C credit structure per course — mirrors script.js's COURSE_CREDITS
// (used there for the SPI calculator). l=lecture, t=tutorial, p=practical
// hours/week, c=credit points.
const COURSE_CREDITS = {
  CB2101: { l: 2, t: 0, p: 0, c: 2 },
  CB2102: { l: 3, t: 1, p: 2, c: 5 },
  CB2103: { l: 3, t: 0, p: 3, c: 4.5 },
  CB2104: { l: 3, t: 1, p: 0, c: 4 },
  CB2105: { l: 3, t: 0, p: 0, c: 3 },
  HS2101: { l: 3, t: 1, p: 0, c: 4 },
  HS2110: { l: 3, t: 0, p: 0, c: 3 },
  HS2111: { l: 3, t: 0, p: 0, c: 3 },
  HS2112: { l: 3, t: 0, p: 0, c: 3 },
};

const LAB_SPLIT_COURSES = new Set(["CB2102", "CB2103"]);

// ---- CB2102 Fluid Mechanics Lab: 16 groups, alternating weeks ----
// Mirrors script.js exactly — do not let this drift. Groups 1-8 ("set A")
// and Groups 9-16 ("set B") take the lab on alternating weeks, with one
// known one-off exception. Roster sourced from CB2102_LAB_Group_list.pdf.
const FLUID_LAB_GROUPS = {
  1: ["2501CB01", "2501CB02", "2501CB03", "2501CB04", "2501CB05", "2501CT07", "2501CT26"],
  2: ["2501CB06", "2501CB07", "2501CB08", "2501CB09", "2501CB10", "2501CT19", "2501CT23"],
  3: ["2501CB11", "2501CB12", "2501CB13", "2501CB14", "2501CB15", "2501CT22", "2501CT38"],
  4: ["2501CB16", "2501CB17", "2501CB18", "2501CB19", "2501CT08", "2501CT16", "2501CT31"],
  5: ["2501CB20", "2501CB21", "2501CB22", "2501CB23", "2501CT20", "2501CT30", "2503CT01"],
  6: ["2501CB24", "2501CB25", "2501CB26", "2501CB27", "2501CB28", "2501CT10", "2501CT37"],
  7: ["2501CB29", "2501CB30", "2501CB31", "2501CT03", "2501CT05", "2501CT36"],
  8: ["2501CB32", "2501CB33", "2501CB34", "2501CB35", "2501CT01", "2503CT03"],
  9: ["2501CB36", "2501CB37", "2501CB38", "2501CB39", "2501CB40", "2501CT17", "2501CT28"],
  10: ["2501CB41", "2501CB42", "2501CB43", "2501CB44", "2501CB45", "2501CT25", "2501CT34"],
  11: ["2501CB46", "2501CB47", "2501CB48", "2501CB49", "2501CB50", "2501CT11", "2501CT35"],
  12: ["2501CB51", "2501CB52", "2501CB53", "2501CB54", "2501CB55", "2501CT09", "2501CT27"],
  13: ["2501CB56", "2501CB58", "2501CB60", "2501CT02", "2501CT06", "2501CT13", "2501CT29"],
  14: ["2501CB61", "2501CB62", "2501CB63", "2501CB64", "2501CT12", "2501CT18", "2501CT32"],
  15: ["2501CB65", "2501CT14", "2501CT15", "2503CB01", "2503CB02", "2503CT02"],
  16: ["2501CT04", "2501CT21", "2501CT24", "2501CT33", "2503CB03", "2503CB04"],
};
const FLUID_LAB_GROUP_OF = {};
Object.keys(FLUID_LAB_GROUPS).forEach(g => {
  FLUID_LAB_GROUPS[g].forEach(roll => { FLUID_LAB_GROUP_OF[roll] = Number(g); });
});
function fluidLabGroupOf(roll) {
  return FLUID_LAB_GROUP_OF[String(roll || "").toUpperCase()] || null;
}
function fluidLabSetOf(groupNum) {
  if (!groupNum) return null;
  return groupNum <= 8 ? "A" : "B";
}
function fluidLabMondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const diffToMon = (dow === 0 ? -6 : 1) - dow;
  d.setDate(d.getDate() + diffToMon);
  return d;
}
const FLUID_LAB_ANCHOR_MONDAY = fluidLabMondayOf(new Date(2026, 7, 24));
const FLUID_LAB_EXCEPTION_ISO = "2026-08-24";
function fluidLabActiveSetForWeek(date) {
  const wkMon = fluidLabMondayOf(date);
  const diffWeeks = Math.round((wkMon - FLUID_LAB_ANCHOR_MONDAY) / (7 * 24 * 60 * 60 * 1000));
  const parity = ((diffWeeks % 2) + 2) % 2;
  return parity === 0 ? "A" : "B";
}
// Returns a CB2102 lab session object for this date/group, or null.
function fluidLabSessionForDate(date, groupNum) {
  if (!groupNum) return null;
  const iso = isoDate(date);
  const mySet = fluidLabSetOf(groupNum);
  const isExceptionWeek = isoDate(fluidLabMondayOf(date)) === isoDate(FLUID_LAB_ANCHOR_MONDAY);

  if (iso === FLUID_LAB_EXCEPTION_ISO && mySet === "A") {
    return { day: 1, start: tm(11, 0), end: tm(13, 0), code: "CB2102", type: "lab", room: "Lab", note: "Shifted from Friday — this week only" };
  }
  if (isExceptionWeek) return null;

  if (date.getDay() === 5 && fluidLabActiveSetForWeek(date) === mySet) {
    return { day: 5, start: tm(10, 0), end: tm(11, 55), code: "CB2102", type: "lab", room: "Lab" };
  }
  return null;
}

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

function scheduleForDate(weekSchedule, globalOverrides, dayOverrides, date, roll) {
  const dow = date.getDay();
  const iso = isoDate(date);
  let list = weekSchedule.filter(s => s.day === dow);
  const gov = globalOverrides[iso];
  const ov = dayOverrides[iso];
  if (gov && gov.removed && gov.removed.length) {
    const removedSet = new Set(gov.removed);
    list = list.filter(s => !removedSet.has(sessionSig(s)));
  }
  if (ov && ov.removed && ov.removed.length) {
    const removedSet = new Set(ov.removed);
    list = list.filter(s => !removedSet.has(sessionSig(s)));
  }
  if (gov && gov.extra && gov.extra.length) {
    list = list.concat(gov.extra.map(e => Object.assign({}, e, { day: dow, isGlobalExtra: true })));
  }
  if (ov && ov.extra && ov.extra.length) {
    list = list.concat(ov.extra.map(e => Object.assign({}, e, { day: dow, isExtra: true })));
  }
  if (roll) {
    const grp = fluidLabGroupOf(roll);
    const labSession = fluidLabSessionForDate(date, grp);
    if (labSession) list = list.concat([labSession]);
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

function computeStats(weekSchedule, globalOverrides, dayOverrides, attendanceMarks, hssCode, roll, now, attendanceMode) {
  const stats = {};
  const activeKeys = new Set(statGroupsForActiveCourses(hssCode, roll).map(g => g.key));
  activeKeys.forEach(k => stats[k] = { present: 0, total: 0 });
  let totalPresent = 0, totalMarked = 0;

  const start = startOfDay(SEMESTER_START);
  const end = startOfDay(now);
  if (start.getTime() <= end.getTime()) {
    for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      const iso = isoDate(d);
      scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll).forEach(s => {
        if (!sessionHasStarted(d, s, now)) return;
        const key = markKeyFor(iso, s);
        // Same fix as script.js: which way an unmarked session counts
        // depends on the student's own attendance-mode preference —
        // 'auto' (auto-present) defaults to present, everything else
        // (conventional) defaults to absent.
        const val = attendanceMarks[key] || (attendanceMode === 'auto' ? 'p' : 'a');
        if (val === 'c') return;
        const statKey = statKeyForSession(s.code, s.type);
        // Same fix as script.js: ignore sessions that don't belong to a
        // currently-active course (e.g. a since-switched HSS elective) so
        // this total always matches what's shown on the attendance cards.
        if (!activeKeys.has(statKey)) return;
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

  const [hssRow, attRow, ovRow, govRow, namesRow, announceRows, pyqFiles, bookFiles, settingsRow] = await Promise.all([
    roll && supabase ? safeSingle(supabase.from('cbe_hss').select('code').eq('roll', roll).maybeSingle()) : null,
    roll && supabase ? safeSingle(supabase.from('cbe_attendance').select('attendance').eq('roll', roll).maybeSingle()) : null,
    roll && supabase ? safeSingle(supabase.from('cbe_day_overrides').select('overrides').eq('roll', roll).maybeSingle()) : null,
    supabase ? safeSingle(supabase.from('cbe_global_overrides').select('overrides').eq('id', 1).maybeSingle()) : null,
    supabase ? safeSingle(supabase.from('cbe_course_names').select('names').eq('id', 1).maybeSingle()) : null,
    supabase ? safeSingle(supabase.from('cbe_announcements').select('id,message,created_at').gte('created_at', cutoffISO).order('created_at', { ascending: false }).limit(5)) : null,
    supabase ? safeSingle(supabase.from('cbe_pyq_files').select('course_code, file_name').order('course_code').limit(300)) : null,
    supabase ? safeSingle(supabase.from('cbe_reference_books').select('course_code, title, author, file_name').order('course_code').limit(300)) : null,
    roll && supabase ? safeSingle(supabase.from('cbe_settings').select('attendance_mode').eq('roll', roll).maybeSingle()) : null,
  ]);

  const courseNames = Object.assign({}, DEFAULT_COURSE_NAMES, (namesRow && namesRow.names) || {});
  const globalOverrides = (govRow && govRow.overrides) || {};
  const result = { announcements: announceRows || [], now };

  if (roll) {
    const hssCode = hssRow && hssRow.code ? hssRow.code : null;
    const attendanceMarks = (attRow && attRow.attendance) || {};
    const dayOverrides = (ovRow && ovRow.overrides) || {};
    const attendanceMode = (settingsRow && settingsRow.attendance_mode === 'auto') ? 'auto' : 'conventional';
    const weekSchedule = buildPersonalWeekSchedule(hssCode, roll);

    // Today's sessions with live status.
    const todaysList = scheduleForDate(weekSchedule, globalOverrides, dayOverrides, now, roll);
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
      const list = scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll);
      const candidate = list.find(s => dayOffset > 0 || (now.getHours() * 60 + now.getMinutes()) < s.start);
      if (candidate) {
        nextClass = {
          code: candidate.code, name: courseNames[candidate.code] || candidate.code,
          type: candidate.type, room: candidate.room, start: fmtHM(candidate.start),
          when: dayOffset === 0 ? 'today' : dayOffset === 1 ? 'tomorrow' : DAY_NAMES[d.getDay()],
        };
      }
    }

    // Full schedule for today plus the next 8 days, so the assistant can
    // correctly answer "what do I have on Wednesday" / "next Tuesday" etc.
    // instead of only knowing about today and a single "next class".
    // Includes any day-specific overrides (added/removed sessions, both
    // admin-wide and personal) that are already scheduled for that date.
    const upcomingDays = [];
    for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
      const d = addDays(now, dayOffset);
      const list = scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll);
      upcomingDays.push({
        label: dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()],
        date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
        sessions: list.map(s => ({
          code: s.code, name: courseNames[s.code] || s.code, type: s.type,
          room: s.room, start: fmtHM(s.start), end: fmtHM(s.end), extra: !!(s.isExtra || s.isGlobalExtra),
          note: s.note || null,
        })),
      });
    }

    // Attendance stats.
    const { stats, totalPresent, totalMarked } = computeStats(weekSchedule, globalOverrides, dayOverrides, attendanceMarks, hssCode, roll, now, attendanceMode);
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
    result.fluidLabGroup = fluidLabGroupOf(roll);
    result.todaysSessions = todaysSessions;
    result.nextClass = nextClass;
    result.upcomingDays = upcomingDays;
    result.attendance = { overallPct, totalPresent, totalMarked, perCourse, mode: attendanceMode };
  }

  // Group PYQ/reference-book files by course so the assistant can answer
  // "what PYQs do we have for X" / "any reference books for Y" precisely.
  function groupByCourse(rows, mapFn) {
    const grouped = {};
    (rows || []).forEach(r => {
      const code = r.course_code || 'Unsorted';
      if (!grouped[code]) grouped[code] = [];
      grouped[code].push(mapFn(r));
    });
    return grouped;
  }
  result.resourcesByCourse = {
    pyq: groupByCourse(pyqFiles, r => r.file_name),
    books: groupByCourse(bookFiles, r => (r.title ? `${r.title}${r.author ? ' — ' + r.author : ''}` : r.file_name)),
  };
  result.resourceCounts = {
    pyq: pyqFiles ? pyqFiles.length : null,
    books: bookFiles ? bookFiles.length : null,
  };

  return result;
}

function formatSiteContext(site) {
  if (!site) return '';
  const lines = [];
  const dayLabel = DAY_NAMES[site.now.getDay()];
  const dateLabel = `${dayLabel} ${site.now.getDate()}/${site.now.getMonth() + 1}/${site.now.getFullYear()}`;
  lines.push(`Current date/time (IST): ${dateLabel}, ${fmtHM(site.now.getHours() * 60 + site.now.getMinutes())}`);

  lines.push(`Course catalog (core CB courses, all students take all of these; credits shown as L-T-P-C = lecture-tutorial-practical hours/week and total credit points): ${COURSE_CODES.map(c => {
    const cr = COURSE_CREDITS[c];
    return `${c} (${DEFAULT_COURSE_NAMES[c] || c}${cr ? `, ${cr.l}-${cr.t}-${cr.p}-${cr.c}` : ''})`;
  }).join(', ')}.`);
  lines.push(`HSS elective options (student picks exactly one; credits shown the same way): ${HSS_ELECTIVES.map(h => {
    const cr = COURSE_CREDITS[h.code];
    return `${h.code} (${DEFAULT_COURSE_NAMES[h.code] || h.code}${cr ? `, ${cr.l}-${cr.t}-${cr.p}-${cr.c}` : ''})`;
  }).join(', ')}.`);
  lines.push(`Attendance policy: ${ATT_THRESHOLD}% is the minimum required; "can skip next N and stay ≥${ATT_THRESHOLD}%" / "needs to attend next N straight" figures below are computed against this threshold.`);

  if (site.roll) {
    if (site.studentName) lines.push(`Student: ${site.studentName} (${site.roll})`);
    lines.push(`HSS elective: ${site.hssName ? `${site.hssCode} — ${site.hssName}` : 'not yet selected'}`);
    if (site.isMba) {
      const cr = COURSE_CREDITS[MBA_COURSE.code];
      lines.push(`Also enrolled in the MBA-track course (HS2101 Mathematical Statistics${cr ? `, ${cr.l}-${cr.t}-${cr.p}-${cr.c}` : ''}).`);
    }
    if (site.fluidLabGroup) {
      lines.push(`CB2102 (Fluid Mechanics) lab group: Group ${site.fluidLabGroup}. This lab is NOT weekly — it alternates between two sets of groups (1-8 and 9-16) every other week, normally on Friday 10:00-11:55 AM, and there was a one-off exception on 24 Aug 2026 where Groups 1-8 had it moved to Monday 11:00 AM-1:00 PM instead. The exact upcoming occurrences for this student's group are already correctly included in "Full schedule" below — trust that over trying to reason about the rotation yourself.`);
    }

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

    if (site.upcomingDays && site.upcomingDays.length) {
      lines.push(`Full schedule for today and the next 8 days (this is the complete, exhaustive session list for each of these dates, already accounting for this student's HSS elective, MBA course if applicable, CB2102 lab rotation, and any admin/personal schedule changes for those dates — if a day has no lines under it, they genuinely have zero classes that day; never say "no other sessions" for any day unless it's listed here with nothing under it):`);
      site.upcomingDays.forEach(day => {
        lines.push(`${day.label} (${day.date}):`);
        if (!day.sessions.length) {
          lines.push(`  - no classes`);
        } else {
          day.sessions.forEach(s => {
            lines.push(`  - ${s.start}-${s.end} ${s.code} (${s.name}) ${s.type} @ ${s.room}${s.extra ? ' [added for this day]' : ''}${s.note ? ' — ' + s.note : ''}`);
          });
        }
      });
    }

    const att = site.attendance;
    if (att.totalMarked) {
      lines.push(`Attendance mode: ${att.mode === 'auto' ? 'Auto-present (unmarked sessions count as PRESENT by default; the student only marks Absent/Cancelled)' : 'Conventional (unmarked sessions count as ABSENT by default; the student marks Present/Absent/Cancelled)'}.`);
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

  const pyqByCourse = (site.resourcesByCourse && site.resourcesByCourse.pyq) || {};
  const booksByCourse = (site.resourcesByCourse && site.resourcesByCourse.books) || {};
  const pyqCourses = Object.keys(pyqByCourse);
  const bookCourses = Object.keys(booksByCourse);
  if (pyqCourses.length || bookCourses.length) {
    lines.push(`Resources available in the app (student can browse/download these in the Resources tab; list file names exactly as given if asked "what PYQs/books do we have for X"):`);
    if (pyqCourses.length) {
      lines.push(`Previous-year question papers (${site.resourceCounts.pyq} files total):`);
      pyqCourses.forEach(code => {
        const files = pyqByCourse[code];
        const shown = files.slice(0, 15).join(', ') + (files.length > 15 ? `, +${files.length - 15} more` : '');
        lines.push(`- ${code} (${DEFAULT_COURSE_NAMES[code] || code}): ${shown}`);
      });
    } else {
      lines.push(`Previous-year question papers: none uploaded yet.`);
    }
    if (bookCourses.length) {
      lines.push(`Reference books (${site.resourceCounts.books} total):`);
      bookCourses.forEach(code => {
        const files = booksByCourse[code];
        const shown = files.slice(0, 15).join(', ') + (files.length > 15 ? `, +${files.length - 15} more` : '');
        lines.push(`- ${code} (${DEFAULT_COURSE_NAMES[code] || code}): ${shown}`);
      });
    } else {
      lines.push(`Reference books: none uploaded yet.`);
    }
  }

  return lines.join('\n');
}

function buildSystemPrompt(context, references, site) {
  let prompt = `You are the in-app assistant for a CBE (Chemical & Biochemical Engineering) 2nd-year student timetable app at IIT Patna, built and maintained by Aarsh Jain (roll 2501CB23).

What this app does, for context (answer confidently about these features when asked "how do I..." or "what can this app do"):
- Timetable & attendance: shows each student's personal weekly schedule (core CB courses + their chosen HSS elective + MBA-track course if applicable), lets them mark each session present/absent/cancelled, and tracks running attendance % per course and overall against a ${ATT_THRESHOLD}% threshold.
- PYQ (previous-year questions) and Reference Books tabs: browse/download files uploaded per course.
- Announcements: admin can post short-lived announcements students see as a bell notification.
- This AI chat assistant (you).
- Admin-only actions (schedule overrides, uploading PYQs/books, announcements) are restricted to the developer's login and are not something a regular student can do from their own account.

Rules:
- Be direct and to the point. 1-3 sentences for most answers. Only go longer if the student explicitly asks for detail, a list, or steps.
- No filler openers like "Great question!" or "I'd be happy to help." Just answer.
- Plain text only — no markdown headers, no bullet-heavy formatting unless the answer is genuinely a list.
- You DO have access to this student's live schedule, attendance, HSS elective, and app announcements — it's given to you below as ground truth. Use it directly and confidently; never say you don't have access to the site's data.
- The data below includes an exhaustive day-by-day schedule for today plus the next 8 days. When asked about any specific day within that range, list everything shown for that day and nothing more — never state or imply a day has "no other sessions" unless the listed sessions for that exact day are already complete (which they always are, within this range). If asked about a day further out than what's listed, say you only have the schedule for the next 8 days and don't guess beyond it.
- For attendance totals/percentages, always use the precomputed "Overall attendance" and "Per-course attendance" figures given below — never recompute them yourself from the day-by-day schedule, to avoid arithmetic mistakes.
- If asked for a course's "credits", give the total credit points (the last number, C, in L-T-P-C) unless the student specifically asks for the L-T-P breakdown too.
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
      max_tokens: 700,
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