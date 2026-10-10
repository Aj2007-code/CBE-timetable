const { createClient } = require('@supabase/supabase-js');

const PRIMARY_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b';

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function tm(h, m) { return h * 60 + m; }
const pad = n => (n < 10 ? '0' + n : '' + n);

/* ==========================================================================
   Refusal guard — refusal-style replies must never be stored, reused or loaded
   ========================================================================== */
const REFUSAL_RE = /(i['’]?m sorry,? but i can['’]?t (share|help|assist|provide|comply)|i can['’]?t (share|provide) that information|i['’]?m unable to (share|help with that|assist)|i cannot (share|help with|assist with) (that|this))/i;
function isBadReply(text) {
  return typeof text === 'string' && REFUSAL_RE.test(text);
}

/* ==========================================================================
   Static data — kept identical to the site (script.js)
   ========================================================================== */
const SEMESTER_START = new Date(2026, 6, 28); // 28 Jul 2026
// Mid-sem exams (21-26 Sep) + break (27 Sep - 4 Oct) 2026: no classes / labs / attendance; classes resume Mon 5 Oct.
const BREAK_START_ISO = "2026-09-21";
const BREAK_END_ISO = "2026-10-04";
function isBreakIso(iso) { return iso >= BREAK_START_ISO && iso <= BREAK_END_ISO; }
const ATT_THRESHOLD = 75;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

// Old course codes that may still appear in stored attendance keys / course names
const CODE_MIGRATION = { "CB2201": "CB2101", "CB2202": "CB2102", "CB2203": "CB2103", "CB2204": "CB2104", "CB2205": "CB2105" };

const LAB_SPLIT_COURSES = new Set(["CB2102", "CB2103"]);
const DOUBLE_ATTENDANCE_CODES = new Set(["CB2102", "CB2104"]);

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

function fluidLabSessionForDate(date, groupNum) {
  if (!groupNum) return null;
  const iso = isoDate(date);
  const mySet = fluidLabSetOf(groupNum);
  const isExceptionWeek = isoDate(fluidLabMondayOf(date)) === isoDate(FLUID_LAB_ANCHOR_MONDAY);

  // Set A (groups 1–8): Fri 23 Oct lab is held Mon 12 Oct, 10 AM–12 PM instead
  if (mySet === "A") {
    if (iso === "2026-10-23") return null;
    if (iso === "2026-10-12") {
      return { day: 1, start: tm(10, 0), end: tm(12, 0), code: "CB2102", type: "lab", room: "Lab", note: "Shifted from Fri 23 Oct" };
    }
  }

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
  { code: "HS2110", slot: 6, sessions: [{ day: 3, room: "LT103" }, { day: 4, room: "LT103" }, { day: 5, room: "LT103" }] },
  { code: "HS2111", slot: 32, sessions: [{ day: 2, room: "LT001" }, { day: 3, room: "LT001" }, { day: 4, room: "LT001" }] },
  { code: "HS2112", slot: 1, sessions: [{ day: 2, room: "LT103" }, { day: 3, room: "LT003" }, { day: 4, room: "LT003" }] },
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

// CPC (CB2104): Tuesday class moved to Monday 2:30–4:00 PM (counts as 2 attendance) from Mon 12 Oct onwards
const CPC_RESHUFFLE_FROM_ISO = "2026-10-12";

/* ---- Mid-semester exam datesheet (20–28 Sep 2026) ---- */
const MIDSEM_SLOT_MORNING = "10:30 AM – 12:30 PM";
const MIDSEM_SLOT_EVENING = "3:30 PM – 5:30 PM";
const MIDSEM_CORE = [
  { code: "CB2101", date: "2026-09-21", day: "Monday" },
  { code: "CB2102", date: "2026-09-23", day: "Wednesday" },
  { code: "CB2105", date: "2026-09-24", day: "Thursday" },
  { code: "CB2103", date: "2026-09-25", day: "Friday" },
  { code: "CB2104", date: "2026-09-26", day: "Saturday" },
];
const MIDSEM_HSS_DATE = "2026-09-22", MIDSEM_HSS_DAY = "Tuesday";
const MIDSEM_MBA_DATE = "2026-09-20", MIDSEM_MBA_DAY = "Sunday";

const MIDSEM_FULL = [
  { date: "2026-09-20", day: "Sunday",
    morning: "CH001, CH4101, CS1101, EC5105, HS2101, MA4107, MA5101, PH4101, PH5101",
    evening: "CE6133, EC4105, HS3102, HS5111, HS7101, HS7103, MA7102" },
  { date: "2026-09-21", day: "Monday",
    morning: "CB2101, CE2101, CH1101, CH2101, CH4102, CS2101, EC2101, EP2101, HS2102, MA2101, MA4108, ME2103, MM2101, PH1101",
    evening: "CB3101, CE3101, CH3101, CS3101, CS6112, EC3101, EP3101, EP4105, HS3101, HS7104, MA3101, MA6109, ME3101, ME6113, MM3101, MM4102, MM6105, PH6124" },
  { date: "2026-09-22", day: "Tuesday",
    morning: "CB4107, HS001, HS2110, HS2111, HS2112, HS4111, MA5102, PH4107, PH5102",
    evening: "CB3106, CB5101, CE5101, CE5104, CE5107, CE5108/CE4104/CE6119, CE5111, CE6135, CS3106, CS5102, EC5102, EC5106, HS3108, HS7105, MC5102, ME3106, ME5101, MM3106, MM4105, MM5101, PH4109, PH7104" },
  { date: "2026-09-23", day: "Wednesday",
    morning: "CB2102/CH2104, CB6104, CE2102, CH4103, CH5102, CS2102, EC2102, EP2102, MA1101, MA2102/HS2105, MA4109, MA5103, ME2102, MM2102, PH4103",
    evening: "CB3102, CE3102, CE5106, CE6116/CE4101, CH3102, CH4108, CH7103, CS3102, EC3102, EC5101, EE3102, EE5101, EP3102, HS3111, HS7106, MA3102, MC5101/CS5101, ME3102, ME5103, ME6104, MH5101, MM3102, MM5102" },
  { date: "2026-09-24", day: "Thursday",
    morning: "CB2105, CH2102, CH5103, CS2103, CS4110/CS6101/MA5104, EE2102, HS2104, HS2114, MA4106/MA5106, PH4102, PH5105, PH5111, PH5113/PH6119",
    evening: "CB3103, CB5102, CE3103, CE5102, CE5105, CE5109/CE6124, CE5112, CH3103, CH4109, CS3103, EC3103, EC5104, EC6101, EE3101, EE5103, HS3103, MA3103, ME3103, ME5106, MM3103, MM5103" },
  { date: "2026-09-25", day: "Friday",
    morning: "CB2103, CE2103, CH2103, CH4104, CH5105, EC2103, EE1101, EE2103, EP2103, HS2103, MA001, MA2103, MA4110, ME1102, ME2101, MM2103, PH4104",
    evening: "CB3104, CB4108, CB5103, CE3104, CE5103, CE5110/CE6120, CE5113, CH3104, CS3104, CS3105, CS4113, EC3104, EC5103, EE5102, EP3104, HS3104, MA3104, MA6106, ME3104, ME4103, ME5102, ME5105, ME5108, MM3104, MM4107, MM5104, PH4110" },
  { date: "2026-09-26", day: "Saturday",
    morning: "CB2104/CH2105, CE2104, CH4105, CS2104, EE2101, EP2104, HS1101, HS2108, MA2104, MA4111, ME2104, MM2104, PH4105",
    evening: "CB3105, CE6109, EC5116/EC5110, EE6103, EP3105, HS4118, HS4119, MA3105, ME3105" },
  { date: "2026-09-27", day: "Sunday",
    morning: "CE1101, CE6128, CS2105, EC3105, HS4123, MA2105, MM2105, PH001",
    evening: "CB4103, CB6105, CE4106, CE6130, CS6109, EC5113/EC5119, EE6104, EP3103, ME4105, ME4106, ME6109, ME6111" },
  { date: "2026-09-28", day: "Monday",
    morning: "HS2115, HS4109",
    evening: "CE6101, CE6125, CS4101/CS6103, EC4102, EC5114, EE6117, MA4103, ME4101, ME6102/ME4102, ME6106, ME6107, MM6101" },
];

/* ---- SPI calculator ---- */
const GRADE_POINTS = { AA: 10, AB: 9, BB: 8, BC: 7, CC: 6, CD: 5, DD: 4, F: 0 };
function spiLabel(s) {
  if (s >= 9) return 'Outstanding';
  if (s >= 8) return 'Excellent';
  if (s >= 7) return 'Very Good';
  if (s >= 6) return 'Good';
  if (s >= 5) return 'Average';
  return 'Below Avg';
}

const STUDENTS = [{"roll":"2501CB23","name":"AARSH JAIN"},{"roll":"2501CB49","name":"ABHI RAJ"},{"roll":"2501CB13","name":"ABHINAV B"},{"roll":"2501CB33","name":"ABHISHEK BANSAL"},{"roll":"2501CB58","name":"ADWAIT VATS"},{"roll":"2501CB42","name":"AHAN BHATTACHARJEE"},{"roll":"2501CB39","name":"AMAN SAROJ"},{"roll":"2501CB14","name":"ANGAJ SAHIL SARJERAO"},{"roll":"2501CB34","name":"ANSER AYAAN"},{"roll":"2501CB62","name":"ANSHU VISHWAKARMA"},{"roll":"2501CB37","name":"ANUPAM SHARMA"},{"roll":"2501CB06","name":"ARCHIT SHANKER"},{"roll":"2501CB26","name":"ARYAN DEV"},{"roll":"2501CB41","name":"AVDHESH MEENA"},{"roll":"2501CB16","name":"BIBHAS BIKASH BISWAS"},{"roll":"2501CB32","name":"BIKI BARMAN"},{"roll":"2501CB60","name":"BISWAS MAYANK PRADYUT"},{"roll":"2501CB51","name":"BOYINA SADVIKA"},{"roll":"2501CB46","name":"CHILMAKURI CHARAN"},{"roll":"2501CB24","name":"DHADSE OMESH VASANTRAO"},{"roll":"2501CB19","name":"DHRUV AGNIHOTRI"},{"roll":"2501CB22","name":"DHRUV ARVIND GANATRA"},{"roll":"2501CB03","name":"DIA HALDER"},{"roll":"2501CB04","name":"EMIN PHILIP SAJI"},{"roll":"2501CB40","name":"GAURAV SUKHADIA"},{"roll":"2501CB47","name":"HARIOM SINGH"},{"roll":"2501CB31","name":"HEMANT KUMAR BAIRWA"},{"roll":"2501CB01","name":"J SAMRUTHA"},{"roll":"2501CB07","name":"JARPULA MURALI"},{"roll":"2501CB05","name":"KAJAL BATRA"},{"roll":"2501CB11","name":"KARISHMA"},{"roll":"2501CB10","name":"KATURI VANSHIKA"},{"roll":"2501CB29","name":"KAVYA GUPTA"},{"roll":"2501CB48","name":"MADA AKEERA SRI VARSHAN"},{"roll":"2501CB43","name":"MADHUR SRIVASTAVA"},{"roll":"2501CB08","name":"MANAV RATHORE"},{"roll":"2501CB21","name":"NASREEN FATIMA"},{"roll":"2501CB20","name":"OSHI MALVIYA"},{"roll":"2501CB45","name":"PILLI SRI VAISHNAVI"},{"roll":"2501CB02","name":"PRIYANSHI PATEL"},{"roll":"2501CB12","name":"PUSHPENDRA SHARMA"},{"roll":"2501CB57","name":"RAGHVENDRA MEENA"},{"roll":"2501CB56","name":"RAJ ARYAN"},{"roll":"2501CB50","name":"RAUSHAN KUMAR"},{"roll":"2501CB54","name":"RIDDHI PATEL"},{"roll":"2501CB35","name":"S ADITYA"},{"roll":"2501CB55","name":"SACHIN"},{"roll":"2501CB38","name":"SAI SUBRAT JENA"},{"roll":"2501CB44","name":"SAKALA SATHWIK"},{"roll":"2501CB15","name":"SAMIT SARDAR"},{"roll":"2501CB53","name":"SANKET YADAV JADHAV"},{"roll":"2501CB09","name":"SAPTARSHI BOSE"},{"roll":"2501CB52","name":"SARTHAK ANUSIMI"},{"roll":"2501CB61","name":"SATISH KUMAR YADAV"},{"roll":"2501CB28","name":"SHANTANU SARDAR"},{"roll":"2501CB64","name":"SHORYA PRATAP SINGH"},{"roll":"2501CB59","name":"SNEHADIP GHOSH"},{"roll":"2501CB30","name":"SWARNAVA KUNDU"},{"roll":"2501CB63","name":"TANIYA KUMARI GUPTA"},{"roll":"2501CB25","name":"VAANYA VERMA"},{"roll":"2501CB36","name":"VADAVELLI KAMALI HARSHITHA"},{"roll":"2501CB65","name":"VADITHYA UPENDAR"},{"roll":"2501CB17","name":"VAIBHAV SANJAY BHAGURE"},{"roll":"2501CB27","name":"VAISHNAV KRISHNA DURGASI"},{"roll":"2501CB18","name":"VANSH KHURANA"},{"roll":"2503CB01","name":"ADARSH CHOUDHARY"},{"roll":"2503CB02","name":"AMOOLYA SHARAN"},{"roll":"2503CB05","name":"DHEERAJ KUMAR"},{"roll":"2503CB03","name":"TEJVEER"},{"roll":"2503CB04","name":"YASH MADHOK"}];
const STUDENT_MAP = {};
STUDENTS.forEach(s => STUDENT_MAP[s.roll.toUpperCase()] = s.name);

const ANNOUNCE_TTL_HOURS = 6;

/* ==========================================================================
   Date helpers
   ========================================================================== */
function getISTNow() {
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
function fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${m} min`;
}
function fmtShortDate(d) { return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; }
function fmtFullDate(d) { return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; }
function fmtIsoNice(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/* ==========================================================================
   Schedule logic — mirrors script.js exactly
   ========================================================================== */
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

function baseScheduleForDate(weekSchedule, date) {
  const dow = date.getDay();
  const iso = isoDate(date);
  let list = weekSchedule.filter(s => s.day === dow);
  if (iso >= CPC_RESHUFFLE_FROM_ISO) {
    if (dow === 2) {
      list = list.filter(s => !(s.code === "CB2104" && s.type === "lecture"));
    } else if (dow === 1) {
      list = list.concat([{ day: 1, start: tm(14, 30), end: tm(16, 0), code: "CB2104", type: "lecture", room: "R102", weight: 2, tag: "rescheduled" }]);
    }
  }
  return list;
}

function roundedSessionMinutes(s) {
  const mins = Math.max(0, (s.end || 0) - (s.start || 0));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem >= 55 ? (hours + 1) * 60 : hours * 60 + rem;
}
function sessionAttendanceWeight(s) {
  if (s.weight) return s.weight;
  return (DOUBLE_ATTENDANCE_CODES.has(s.code) && s.type === "lecture" && roundedSessionMinutes(s) === 120) ? 2 : 1;
}

function scheduleForDate(weekSchedule, globalOverrides, dayOverrides, date, roll) {
  const dow = date.getDay();
  const iso = isoDate(date);
  const onBreak = isBreakIso(iso);
  let list = onBreak ? [] : baseScheduleForDate(weekSchedule, date);
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
  if (roll && !onBreak) {
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

function migrateAttendanceKeys(marks) {
  const out = {};
  Object.keys(marks || {}).forEach(key => {
    const parts = key.split("|");
    if (parts.length === 3 && CODE_MIGRATION[parts[1]]) parts[1] = CODE_MIGRATION[parts[1]];
    out[parts.join("|")] = marks[key];
  });
  return out;
}

/** Same rules as the Attendance tab: only sessions that have started, cancelled ones excluded,
 *  unmarked sessions follow the student's mode, 2-hr CB2102/CB2104 lectures count double. */
function computeStats(weekSchedule, globalOverrides, dayOverrides, attendanceMarks, hssCode, roll, now, attendanceMode) {
  const stats = {};
  const activeKeys = new Set(statGroupsForActiveCourses(hssCode, roll).map(g => g.key));
  activeKeys.forEach(k => stats[k] = { present: 0, total: 0, markedPresent: 0, markedAbsent: 0, unmarked: 0, cancelled: 0 });
  const missed = {};
  let totalPresent = 0, totalMarked = 0;

  const start = startOfDay(SEMESTER_START);
  const end = startOfDay(now);
  if (start.getTime() <= end.getTime()) {
    for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      const iso = isoDate(d);
      scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll).forEach(s => {
        if (!sessionHasStarted(d, s, now)) return;
        const key = markKeyFor(iso, s);
        const explicit = attendanceMarks[key];
        const val = explicit || (attendanceMode === 'auto' ? 'p' : 'a');
        const statKey = statKeyForSession(s.code, s.type);
        if (!activeKeys.has(statKey)) return;
        const weight = sessionAttendanceWeight(s);
        if (val === 'c') { stats[statKey].cancelled += weight; return; }
        stats[statKey].total += weight;
        totalMarked += weight;
        if (val === 'p') { stats[statKey].present += weight; totalPresent += weight; }
        if (explicit === 'p') stats[statKey].markedPresent += weight;
        else if (explicit === 'a') stats[statKey].markedAbsent += weight;
        else stats[statKey].unmarked += weight;
        if (val === 'a') {
          (missed[statKey] = missed[statKey] || []).push({ date: new Date(d), s, explicit: explicit === 'a', weight });
        }
      });
    }
  }
  Object.keys(missed).forEach(k => missed[k].sort((a, b) => b.date - a.date));
  return { stats, totalPresent, totalMarked, missed };
}

// Wording identical to the Attendance tab
function attendanceProjection(present, total) {
  if (!total) return null;
  const T = ATT_THRESHOLD / 100;
  const pct = present / total;
  if (pct >= T) {
    const canSkip = Math.floor(present / T - total);
    return canSkip > 0
      ? `can skip next ${canSkip} and stay ≥${ATT_THRESHOLD}%`
      : `no room left — next miss drops you below ${ATT_THRESHOLD}%`;
  }
  const need = Math.max(1, Math.ceil((T * total - present) / (1 - T)));
  return `attend next ${need} straight to reach ${ATT_THRESHOLD}%`;
}

function markStatusText(d, s, now, marks, mode) {
  if (!sessionHasStarted(d, s, now)) return 'not started yet';
  const explicit = marks[markKeyFor(isoDate(d), s)];
  if (explicit === 'p') return 'marked Present';
  if (explicit === 'a') return 'marked Absent';
  if (explicit === 'c') return 'marked Cancelled (not counted)';
  return mode === 'auto' ? 'unmarked → counted as Present' : 'unmarked → counted as Absent';
}

function sessionNote(s) {
  const bits = [];
  if (s.note) bits.push(s.note);
  if (s.tag) bits.push(s.tag);
  const w = sessionAttendanceWeight(s);
  if (w > 1) bits.push(`counts as ${w} attendance`);
  return bits.join('; ');
}

/* ==========================================================================
   Question intents (so we only send heavy blocks when they matter)
   ========================================================================== */
function detectIntents(question, activeCodes) {
  const q = String(question || '');
  const knownCodes = new Set(activeCodes.concat(Object.keys(DEFAULT_COURSE_NAMES)));
  const codesInQ = (q.toUpperCase().match(/\b[A-Z]{2,3}\d{3,4}\b/g) || []);
  const foreignCode = codesInQ.some(c => !knownCodes.has(c));
  return {
    exam: /exam|date ?sheet|mid.?sem|end.?sem|invigilat|test|slot/i.test(q) || foreignCode,
    resources: /pyq|previous.?year|question paper|old paper|past paper|book|reference|resource|material|textbook|pdf|download|notes/i.test(q),
    spi: /\b(spi|cpi|cgpa|sgpa|gpa|grades?|grade points?)\b/i.test(q),
    attendanceDetail: /attend|present|absent|miss|marked|unmarked|yesterday|last (week|class|lecture|few)|did i|was i|skip|bunk|cancel|log|history|percent|%/i.test(q),
    missedList: /miss|absent|skipp|bunk|which (class|lecture|session)|wrong|incorrect|fix|correct|list/i.test(q),
  };
}

// Questions about "me" / "now" — answered from live data, never from shared stored Q&A
function isPersonalQuestion(q) {
  return /\b(my|me|mine|i|i'm|im|i've|am i|do i|can i|should i|today|tomorrow|tonight|yesterday|next class|attendance|skip|spi|group|elective|schedule|timetable|class(es)?|lab|lecture|exam|marked|present|absent)\b/i.test(String(q || ''));
}

/* ==========================================================================
   SPI helper — grades given in the chat, computed exactly like the site's calculator
   ========================================================================== */
function parseGradesFromText(text, codes) {
  const upper = String(text || '').toUpperCase();
  const G = '(AA|AB|BB|BC|CC|CD|DD|F)';
  const found = {};
  codes.forEach(code => {
    const a = new RegExp(`${code}[\\s:=\\-–(]*${G}\\b`).exec(upper);
    if (a) found[code] = a[1];
  });
  codes.forEach(code => {
    if (found[code]) return;
    const b = new RegExp(`\\b${G}\\s*(?:IN|FOR|-|:)?\\s*${code}\\b`).exec(upper);
    if (b) found[code] = b[1];
  });
  return found;
}

function computeSpi(gradesByCode, codes) {
  let totalCr = 0, weighted = 0;
  codes.forEach(code => {
    const cr = COURSE_CREDITS[code];
    const g = gradesByCode[code];
    if (!cr || !g) return;
    totalCr += cr.c;
    weighted += cr.c * GRADE_POINTS[g];
  });
  if (!totalCr) return null;
  return Math.round((weighted / totalCr) * 100) / 100;
}

/* ==========================================================================
   Data fetching
   ========================================================================== */
async function safeSingle(query) {
  try {
    const { data, error } = await query;
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function fetchSiteContext(rollNumber, recentUserText) {
  const roll = rollNumber ? String(rollNumber).toUpperCase() : null;
  const now = getISTNow();
  const cutoffISO = new Date(Date.now() - ANNOUNCE_TTL_HOURS * 3600 * 1000).toISOString();

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

  // Same precedence as the site: built-in names win, DB names only fill gaps (and old codes are migrated)
  const dbNames = {};
  Object.keys((namesRow && namesRow.names) || {}).forEach(code => {
    const nc = CODE_MIGRATION[code] || code;
    if (!(nc in dbNames)) dbNames[nc] = namesRow.names[code];
  });
  const courseNames = Object.assign({}, dbNames, DEFAULT_COURSE_NAMES);
  const globalOverrides = (govRow && govRow.overrides) || {};
  const result = { announcements: announceRows || [], now, courseNames, globalOverrides };

  if (roll) {
    const hssCode = hssRow && hssRow.code ? hssRow.code : null;
    const attendanceMarks = migrateAttendanceKeys((attRow && attRow.attendance) || {});
    const dayOverrides = (ovRow && ovRow.overrides) || {};
    const attendanceMode = (settingsRow && settingsRow.attendance_mode === 'auto') ? 'auto' : 'conventional';
    const weekSchedule = buildPersonalWeekSchedule(hssCode, roll);
    const nameOf = s => s.name || courseNames[s.code] || s.code;
    const activeCodes = activeCourseCodes(hssCode, roll);
    const intents = detectIntents(recentUserText && recentUserText.latest, activeCodes);

    const mkSession = (d, s) => ({
      code: s.code, name: nameOf(s), type: s.type, room: s.room,
      start: fmtHM(s.start), end: fmtHM(s.end), duration: fmtDuration(roundedSessionMinutes(s)),
      extra: !!(s.isExtra || s.isGlobalExtra), extraKind: s.isExtra ? 'added by the student for this day' : (s.isGlobalExtra ? 'added by admin for everyone' : null),
      note: sessionNote(s), mark: markStatusText(d, s, now, attendanceMarks, attendanceMode),
      raw: s,
    });

    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todaysList = scheduleForDate(weekSchedule, globalOverrides, dayOverrides, now, roll);
    const todaysSessions = todaysList.map(s => {
      let status = 'upcoming';
      if (nowMin >= s.end) status = 'finished';
      else if (nowMin >= s.start) status = 'in progress';
      return Object.assign(mkSession(now, s), { status });
    });

    let nextClass = null;
    for (let dayOffset = 0; dayOffset <= 21 && !nextClass; dayOffset++) {
      const d = addDays(now, dayOffset);
      const list = scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll);
      const candidate = list.find(s => dayOffset > 0 || nowMin < s.start);
      if (candidate) {
        nextClass = {
          code: candidate.code, name: nameOf(candidate),
          type: candidate.type, room: candidate.room, start: fmtHM(candidate.start), end: fmtHM(candidate.end),
          when: dayOffset === 0 ? 'today' : dayOffset === 1 ? 'tomorrow' : fmtShortDate(d),
        };
      }
    }

    // Upcoming 14 days (covers every weekday twice and both lab-rotation weeks)
    const upcomingDays = [];
    for (let dayOffset = 0; dayOffset <= 13; dayOffset++) {
      const d = addDays(now, dayOffset);
      const list = scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll);
      upcomingDays.push({
        label: dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : DAY_FULL[d.getDay()],
        date: fmtFullDate(d),
        totalMins: list.reduce((sum, s) => sum + roundedSessionMinutes(s), 0),
        sessions: list.map(s => mkSession(d, s)),
        breakDay: isBreakIso(isoDate(d)),
      });
    }

    // Past 7 days log with marks (for "did I attend…", "what did I mark yesterday")
    const pastDays = [];
    for (let dayOffset = -7; dayOffset <= -1; dayOffset++) {
      const d = addDays(now, dayOffset);
      const list = scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll);
      pastDays.push({ date: fmtFullDate(d), sessions: list.map(s => mkSession(d, s)), breakDay: isBreakIso(isoDate(d)) });
    }

    // Upcoming fluid-lab dates for this student's group (so lab-rotation questions are exact)
    const upcomingLabs = [];
    for (let dayOffset = 0; dayOffset <= 70 && upcomingLabs.length < 4; dayOffset++) {
      const d = addDays(now, dayOffset);
      scheduleForDate(weekSchedule, globalOverrides, dayOverrides, d, roll).forEach(s => {
        if (s.code === 'CB2102' && s.type === 'lab' && (dayOffset > 0 || nowMin < s.end)) {
          upcomingLabs.push(`${fmtShortDate(d)} ${fmtHM(s.start)}-${fmtHM(s.end)}${s.note ? ' (' + s.note + ')' : ''}`);
        }
      });
    }

    const { stats, totalPresent, totalMarked, missed } = computeStats(weekSchedule, globalOverrides, dayOverrides, attendanceMarks, hssCode, roll, now, attendanceMode);
    const overallPct = totalMarked ? Math.round((totalPresent / totalMarked) * 100) : null;
    const perCourse = statGroupsForActiveCourses(hssCode, roll).map(g => {
      const st = stats[g.key] || { present: 0, total: 0, markedPresent: 0, markedAbsent: 0, unmarked: 0, cancelled: 0 };
      const pct = st.total ? Math.round((st.present / st.total) * 100) : null;
      return {
        key: g.key, code: g.code, label: g.label, name: courseNames[g.code] || g.code,
        present: st.present, total: st.total, pct,
        markedPresent: st.markedPresent, markedAbsent: st.markedAbsent, unmarked: st.unmarked, cancelled: st.cancelled,
        projection: st.total ? attendanceProjection(st.present, st.total) : null,
      };
    });

    // Student's credits + SPI helper
    let totalCredits = 0;
    activeCodes.forEach(c => { if (COURSE_CREDITS[c]) totalCredits += COURSE_CREDITS[c].c; });
    totalCredits = Math.round(totalCredits * 100) / 100;
    let spiHelper = null;
    if (intents.spi) {
      const spiCodes = activeCodes.filter(c => COURSE_CREDITS[c]);
      const grades = parseGradesFromText(recentUserText && recentUserText.joined, spiCodes);
      const covered = spiCodes.filter(c => grades[c]);
      spiHelper = {
        spiCodes, grades, missing: spiCodes.filter(c => !grades[c]),
        spi: covered.length ? computeSpi(grades, spiCodes) : null,
        complete: covered.length === spiCodes.length,
      };
    }

    result.roll = roll;
    result.studentName = STUDENT_MAP[roll] || null;
    result.hssCode = hssCode;
    result.hssName = hssCode ? (courseNames[hssCode] || hssCode) : null;
    result.isMba = isMbaRoll(roll);
    result.fluidLabGroup = fluidLabGroupOf(roll);
    result.activeCodes = activeCodes;
    result.todaysSessions = todaysSessions;
    result.nextClass = nextClass;
    result.upcomingDays = upcomingDays;
    result.pastDays = pastDays;
    result.upcomingLabs = upcomingLabs;
    result.missed = missed;
    result.totalCredits = totalCredits;
    result.spiHelper = spiHelper;
    result.intents = intents;
    result.attendance = { overallPct, totalPresent, totalMarked, perCourse, mode: attendanceMode };
  } else {
    result.intents = detectIntents(recentUserText && recentUserText.latest, COURSE_CODES);
  }

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

/* ==========================================================================
   Context formatting
   ========================================================================== */
function formatExamBlock(site) {
  const lines = [];
  const today = startOfDay(site.now);
  const until = iso => Math.round((new Date(iso + "T00:00:00") - today) / 86400000);
  const rel = n => n < 0 ? 'done' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;

  lines.push(`Mid-sem exam datesheet (20–28 Sep 2026). Two slots a day: Morning ${MIDSEM_SLOT_MORNING}, Evening ${MIDSEM_SLOT_EVENING}. Every CB 2nd-year core exam is in the Morning slot. (Mid-sem is over unless a date below says otherwise; classes resumed Mon 5 Oct.)`);
  if (site.roll) {
    const items = MIDSEM_CORE.map(c => ({ code: c.code, day: c.day, date: c.date }));
    if (site.hssCode && HSS_MAP[site.hssCode]) items.push({ code: site.hssCode, day: MIDSEM_HSS_DAY, date: MIDSEM_HSS_DATE });
    if (site.isMba) items.push({ code: MBA_COURSE.code, day: MIDSEM_MBA_DAY, date: MIDSEM_MBA_DATE });
    items.sort((a, b) => a.date.localeCompare(b.date));
    lines.push(`This student's own mid-sem exams (all ${MIDSEM_SLOT_MORNING}):`);
    items.forEach(it => lines.push(`- ${it.code} (${site.courseNames[it.code] || it.code}): ${it.day} ${fmtIsoNice(it.date)} — ${rel(until(it.date))}`));
    if (!site.hssCode) lines.push(`(HSS elective not selected yet — HS2110, HS2111 and HS2112 all have their exam on ${MIDSEM_HSS_DAY} ${fmtIsoNice(MIDSEM_HSS_DATE)}, ${MIDSEM_SLOT_MORNING}.)`);
  }
  lines.push(`Full datesheet (all branches; "A/B" means those courses share a paper):`);
  MIDSEM_FULL.forEach(d => {
    lines.push(`${d.day} ${fmtIsoNice(d.date)}:`);
    lines.push(`  Morning (${MIDSEM_SLOT_MORNING}): ${d.morning}`);
    lines.push(`  Evening (${MIDSEM_SLOT_EVENING}): ${d.evening}`);
  });
  return lines.join('\n');
}

function formatSiteContext(site) {
  if (!site) return '';
  const intents = site.intents || {};
  const names = site.courseNames || DEFAULT_COURSE_NAMES;
  const lines = [];
  lines.push(`Current date/time (IST): ${fmtFullDate(site.now)}, ${fmtHM(site.now.getHours() * 60 + site.now.getMinutes())}`);
  lines.push(`Semester: started 28 Jul 2026. Mid-sem exams 20–26 Sep, mid-sem break 27 Sep–4 Oct 2026 (no classes/labs and nothing counts toward attendance on 21 Sep–4 Oct); classes resumed Monday 5 Oct 2026.`);

  lines.push(`Course catalog (core CB courses, all students take all of these; credits shown as L-T-P-C = lecture-tutorial-practical hours/week and total credit points): ${COURSE_CODES.map(c => {
    const cr = COURSE_CREDITS[c];
    return `${c} (${names[c] || c}${cr ? `, ${cr.l}-${cr.t}-${cr.p}-${cr.c}` : ''})`;
  }).join(', ')}.`);
  lines.push(`HSS elective options (student picks exactly one; all in the 2–3 PM slot; credits shown the same way): ${HSS_ELECTIVES.map(h => {
    const cr = COURSE_CREDITS[h.code];
    const days = h.sessions.map(s => `${DAY_NAMES[s.day]} ${s.room}`).join(', ');
    return `${h.code} (${names[h.code] || h.code}${cr ? `, ${cr.l}-${cr.t}-${cr.p}-${cr.c}` : ''}; slot ${h.slot}; ${days})`;
  }).join('; ')}.`);
  lines.push(`Attendance rules: ${ATT_THRESHOLD}% is the minimum. Cancelled sessions are excluded. CB2102 (Fluid Mechanics) and CB2103 (Heat Transfer) are tracked as two separate lines — Theory and Lab. Two-hour CB2102/CB2104 lectures (and the rescheduled Monday CB2104 class) count as 2 attendance, so all counts are in "attendance units", not class meetings. A session only counts once it has started.`);
  lines.push(`Schedule changes in force: from Mon 12 Oct 2026 the CB2104 Tuesday class moved to Monday 2:30–4:00 PM (counts as 2 attendance). Fluid-lab Set A (groups 1–8): the Fri 23 Oct lab is held Mon 12 Oct 10:00 AM–12:00 PM instead.`);
  lines.push(`Grading (SPI): grade points AA=10, AB=9, BB=8, BC=7, CC=6, CD=5, DD=4, F=0. SPI = Σ(credit × grade point) ÷ Σ(credits), rounded to 2 decimals. Labels: ≥9 Outstanding, ≥8 Excellent, ≥7 Very Good, ≥6 Good, ≥5 Average, below 5 Below Avg.`);

  if (site.roll) {
    if (site.studentName) lines.push(`Student: ${site.studentName} (${site.roll})`);
    lines.push(`HSS elective: ${site.hssName ? `${site.hssCode} — ${site.hssName}` : 'not yet selected'}`);
    if (site.isMba) {
      const cr = COURSE_CREDITS[MBA_COURSE.code];
      lines.push(`Also enrolled in the MBA-track course (HS2101 Mathematical Statistics${cr ? `, ${cr.l}-${cr.t}-${cr.p}-${cr.c}` : ''}); Mon 3:00 PM, Wed 10:00 AM, Fri 10:00 AM and a Fri 3:00 PM tutorial, all in B1/202.`);
    }
    lines.push(`This student's total credits this semester: ${site.totalCredits} (courses: ${site.activeCodes.filter(c => COURSE_CREDITS[c]).join(', ')}).`);
    if (site.fluidLabGroup) {
      lines.push(`CB2102 (Fluid Mechanics) lab: this student is in Group ${site.fluidLabGroup} (Set ${fluidLabSetOf(site.fluidLabGroup)}). The lab is NOT weekly — Set A (groups 1-8) and Set B (groups 9-16) alternate every other week, normally Friday 10:00-11:55 AM. One-off exceptions: 24 Aug 2026 Set A was moved to Monday 11:00 AM-1:00 PM; Set A's Fri 23 Oct lab is held Mon 12 Oct 10:00 AM-12:00 PM. CB2103 (Heat Transfer) lab is weekly, Thursday 10:00 AM-12:55 PM. Next CB2102 lab dates for this student: ${site.upcomingLabs.length ? site.upcomingLabs.join('; ') : 'none found in the next 10 weeks'}.`);
    }

    const sessLine = s => `${s.start}-${s.end} ${s.code} (${s.name}) ${s.type} @ ${s.room}${s.extraKind ? ` [${s.extraKind}]` : ''}${s.note ? ' — ' + s.note : ''}`;

    if (site.todaysSessions.length) {
      lines.push(`Today's schedule:`);
      site.todaysSessions.forEach(s => lines.push(`- ${sessLine(s)} — ${s.status}; ${s.mark}`));
    } else {
      lines.push(`Today's schedule: no classes today.`);
    }

    if (site.nextClass) {
      const nc = site.nextClass;
      lines.push(`Next class: ${nc.code} (${nc.name}) ${nc.type} ${nc.start}-${nc.end} in ${nc.room}, ${nc.when}.`);
    } else {
      lines.push(`Next class: none found in the coming 3 weeks.`);
    }

    lines.push(`Full schedule for today and the next 13 days (complete and exhaustive for each date; already accounts for this student's HSS elective, MBA course, lab rotation, the schedule changes above, and any admin/personal day edits. A day with nothing listed genuinely has no classes):`);
    site.upcomingDays.forEach(day => {
      const head = day.sessions.length ? ` — ${day.sessions.length} session${day.sessions.length !== 1 ? 's' : ''}, ${fmtDuration(day.totalMins)}` : '';
      lines.push(`${day.label} (${day.date})${head}:`);
      if (!day.sessions.length) {
        lines.push(day.breakDay ? `  - no classes (mid-sem exams/break)` : `  - no classes`);
      } else {
        day.sessions.forEach(s => lines.push(`  - ${sessLine(s)}`));
      }
    });

    if (intents.attendanceDetail) {
      lines.push(`Last 7 days (with how each session is recorded):`);
      site.pastDays.forEach(day => {
        lines.push(`${day.date}:`);
        if (!day.sessions.length) lines.push(day.breakDay ? `  - no classes (mid-sem exams/break)` : `  - no classes`);
        else day.sessions.forEach(s => lines.push(`  - ${sessLine(s)} — ${s.mark}`));
      });
    }

    const att = site.attendance;
    lines.push(`Attendance mode: ${att.mode === 'auto' ? 'Auto-present (every session the student has not tapped counts as PRESENT; they only tap Absent/Cancelled)' : 'Conventional (every session the student has not tapped counts as ABSENT; they tap Present/Absent/Cancelled)'}.`);
    if (att.totalMarked) {
      lines.push(`ATTENDANCE — these figures are exactly what the Attendance tab shows. Quote them verbatim, never recompute:`);
      const overallProj = attendanceProjection(att.totalPresent, att.totalMarked);
      lines.push(`Overall attendance: ${att.overallPct}% (${att.totalPresent} present of ${att.totalMarked} sessions held so far)${overallProj ? ' — ' + overallProj : ''}.`);
      lines.push(`Per-course attendance:`);
      att.perCourse.forEach(c => {
        const title = `${c.code}${c.label ? ' ' + c.label : ''} (${c.name})`;
        if (!c.total) { lines.push(`- ${title}: no sessions held yet.`); return; }
        const status = c.pct >= ATT_THRESHOLD ? `at/above ${ATT_THRESHOLD}%` : `BELOW ${ATT_THRESHOLD}%`;
        lines.push(`- ${title}: ${c.pct}% (${c.present}/${c.total} sessions) — ${c.projection}. [${status}; of the ${c.total}: ${c.markedPresent} marked Present, ${c.markedAbsent} marked Absent, ${c.unmarked} untouched (counted as ${att.mode === 'auto' ? 'Present' : 'Absent'}); ${c.cancelled} cancelled and not counted]`);
      });
      if (intents.missedList) {
        lines.push(`Sessions currently counted as ABSENT, newest first (tapping a course card in the Attendance tab shows the same list; the student can fix a wrong one from the Attendance tab):`);
        att.perCourse.forEach(c => {
          const list = site.missed[c.key] || [];
          if (!c.total) return;
          if (!list.length) { lines.push(`- ${c.code}${c.label ? ' ' + c.label : ''}: nothing counted absent.`); return; }
          const shown = list.slice(0, 40).map(m => `${fmtShortDate(m.date)} ${fmtHM(m.s.start)}${m.weight > 1 ? ' (x' + m.weight + ')' : ''}${m.explicit ? ' [marked absent]' : ' [untouched]'}`);
          lines.push(`- ${c.code}${c.label ? ' ' + c.label : ''} (${list.length} sessions): ${shown.join('; ')}${list.length > 40 ? `; +${list.length - 40} older` : ''}`);
        });
      }
    } else {
      lines.push(`Attendance: no sessions have been held yet this semester.`);
    }

    if (intents.spi && site.spiHelper) {
      const h = site.spiHelper;
      lines.push(`SPI calculator — this student's courses and credits: ${h.spiCodes.map(c => `${c} ${COURSE_CREDITS[c].c}cr`).join(', ')} (total ${site.totalCredits}).`);
      const given = h.spiCodes.filter(c => h.grades[c]).map(c => `${c}=${h.grades[c]}`);
      if (given.length) {
        lines.push(`Grades found in the student's recent messages: ${given.join(', ')}.${h.missing.length ? ` Still missing: ${h.missing.join(', ')}.` : ''}`);
        if (h.complete) lines.push(`PRE-COMPUTED SPI (use this exact value): ${h.spi.toFixed(2)} — ${spiLabel(h.spi)}.`);
        else lines.push(`SPI cannot be final until all grades are given; partial SPI over the given courses only is ${h.spi.toFixed(2)}.`);
      }
      lines.push(`The site's SPI tab needs a grade for every course, then shows the SPI and saves it. For "what grade do I need" questions, work from Σ(credit×gp) over total credits.`);
    }
  } else {
    lines.push(`No valid roll number for this session — personal schedule/attendance/HSS data cannot be looked up. If the student asks about their own attendance or schedule, tell them to log in again.`);
  }

  if (intents.exam) lines.push(formatExamBlock(site));

  if (site.announcements && site.announcements.length) {
    lines.push(`Active announcements (last ${ANNOUNCE_TTL_HOURS}h, newest first):`);
    site.announcements.forEach(a => lines.push(`- ${a.message}`));
  } else {
    lines.push(`Active announcements: none right now (they expire ${ANNOUNCE_TTL_HOURS} hours after posting).`);
  }

  const pyqByCourse = (site.resourcesByCourse && site.resourcesByCourse.pyq) || {};
  const booksByCourse = (site.resourcesByCourse && site.resourcesByCourse.books) || {};
  const pyqCourses = Object.keys(pyqByCourse);
  const bookCourses = Object.keys(booksByCourse);
  const rc = site.resourceCounts || {};
  lines.push(`Resources in the app: ${rc.pyq == null ? 'PYQ count unavailable' : rc.pyq + ' previous-year question paper file(s)'} and ${rc.books == null ? 'book count unavailable' : rc.books + ' reference book file(s)'} uploaded.`);
  if (intents.resources) {
    if (pyqCourses.length) {
      lines.push(`Previous-year question papers by course (list file names exactly as given):`);
      pyqCourses.forEach(code => {
        const files = pyqByCourse[code];
        lines.push(`- ${code} (${names[code] || code}): ${files.slice(0, 20).join(', ')}${files.length > 20 ? `, +${files.length - 20} more` : ''}`);
      });
    } else lines.push(`Previous-year question papers: none uploaded yet.`);
    if (bookCourses.length) {
      lines.push(`Reference books by course:`);
      bookCourses.forEach(code => {
        const files = booksByCourse[code];
        lines.push(`- ${code} (${names[code] || code}): ${files.slice(0, 20).join(', ')}${files.length > 20 ? `, +${files.length - 20} more` : ''}`);
      });
    } else lines.push(`Reference books: none uploaded yet.`);
  }

  return lines.join('\n');
}

/* ==========================================================================
   System prompt
   ========================================================================== */
function buildSystemPrompt(context, references, site) {
  let prompt = `You are the in-app assistant for the CBE (Chemical & Biochemical Engineering) 2nd-year timetable app at IIT Patna, built and maintained by Aarsh Jain (roll 2501CB23).

Everything the app does (answer confidently when asked "how do I…" or "what can this app do"):
- Login: students sign in with their roll number; "Remember me" keeps them signed in on that device. There is a dark/light mode toggle, an About button, an announcements bell, and this chat assistant.
- Now tab: live countdown to the next/ongoing class, today's sessions and a day picker (Mon–Fri) for the week. Marking Present/Absent/Cancelled from here works only for today's sessions that have already started.
- Week view: the Mon–Fri timetable with session counts and total hours per day.
- Attendance tab: overall % and a card per course (CB2102 and CB2103 each split into Theory and Lab), each with a projection ("can skip next N and stay ≥75%", "no room left", or "attend next N straight to reach 75%"). Tapping a course card lists the sessions counted absent so the student can jump to that day and fix it. "Mark a day" lets them mark any session that has already started, on any past date. Marks can be toggled off by tapping the same button again.
- Attendance modes: Conventional (untapped = absent) or Auto-present (untapped = present). Switching modes changes only the untapped sessions, not ones already marked. Auto-backup of attendance (a snapshot every time it changes) can be switched on/off; the student can also export a JSON backup and import it back, and the page shows when the last backup was. Attendance syncs to the cloud so it follows them across devices.
- Day edits: a student can add an extra class on one day or remove a class for one day only (their own timetable only). The admin can add, cancel or reschedule classes for everyone.
- HSS button: pick one elective (HS2110, HS2111 or HS2112) or skip; it adds that elective's sessions and an exam entry.
- Exams tab: "Mid-Sem TimeTable" — the student's own exams plus the full datesheet with a code search.
- Credits tab: L-T-P-C per course and the total.
- SPI tab: pick a grade per course, calculate SPI, and the result is saved.
- PYQ and Reference Books tabs: browse/view/download PDFs per course. Only the admin can upload or delete files.
- Announcements: admin posts short messages that last ${ANNOUNCE_TTL_HOURS} hours; students can react 👍/👎.
- Admin-only: global schedule overrides, uploading/deleting PYQs and books, posting announcements. Regular students can't do these.

Rules:
- Be direct. 1–3 sentences for most answers; go longer only when the student asks for detail, a list, or steps. No filler openers.
- Plain text only. No markdown headers, no bullets unless the answer is genuinely a list. Dates like "Mon 12/10", times like "10:00 AM".
- Greetings and small talk are always fine — reply briefly and naturally. Never answer an ordinary message with "I can't share that information". The student is asking about their own data, which you may share with them.
- The live app data below is ground truth. Use it confidently; never say you lack access to it. If it conflicts with anything else (including earlier chat turns), the live data wins.
- ATTENDANCE: quote the "Overall attendance" and "Per-course attendance" figures exactly as given (same percentage, same present/total, same projection wording) — they are identical to what the Attendance tab shows. Never recompute or round them differently, and say that numbers are in attendance units when the student asks why a count differs from the number of classes.
- If the student asks about a date shown in the schedule, list everything shown for that date and nothing more. For dates beyond the 14 days given, say you only have the next 14 days and don't guess.
- Credits: give the total credit points (the last number, C) unless they ask for L-T-P too.
- SPI: if a "PRE-COMPUTED SPI" line is given use it exactly; otherwise calculate with the formula given, to 2 decimals.
- You only have THIS student's data. For anything about another student (attendance, marks, group, schedule), say plainly that you can only see their own data. Never reveal the admin password, tokens, keys or how admin login works.
- If something is genuinely missing from the data (e.g. an exam for a code that isn't on the datesheet), say so rather than guessing. Never invent timings, rooms, dates or figures.
- You may answer any other question (coursework, general knowledge, advice) like a knowledgeable general assistant. Only steer back to the app when the question is about the app and the data above doesn't cover it.`;

  const siteBlock = formatSiteContext(site);
  if (siteBlock) {
    prompt += `\n\nLive app data for this student right now (ground truth):\n${siteBlock}`;
  }

  if (context && typeof context === 'object') {
    const parts = [];
    if (context.currentClass) parts.push(`Frontend-reported current/next class: ${context.currentClass}`);
    if (context.day) parts.push(`Frontend-reported day: ${context.day}`);
    if (context.time) parts.push(`Frontend-reported time: ${context.time}`);
    if (parts.length) {
      prompt += `\n\nAdditional UI state reported by the frontend (only use if it fills a gap in the live data above — the live data wins on any conflict):\n` + parts.map(p => `- ${p}`).join('\n');
    }
  }

  if (references && references.length) {
    prompt += `\n\nGeneral (non-personal) answers given to other students earlier (reuse only if they genuinely apply; live data above always wins; don't mention where they came from):\n` +
      references.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n');
  }

  return prompt;
}

/* ==========================================================================
   Knowledge base / history
   ========================================================================== */
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
  // Personal/live questions are answered from live data only — stored answers can be stale or someone else's
  if (isPersonalQuestion(question)) return [];

  const embedding = await getEmbedding(question);
  if (embedding) {
    try {
      const { data, error } = await supabase.rpc('match_ai_knowledge_semantic', {
        query_embedding: embedding,
        match_count: 5
      });
      if (!error && data && data.length) {
        const clean = data.filter(r => !isBadReply(r.answer));
        if (clean.length) return clean;
      }
    } catch (e) {
    }
  }

  try {
    const { data, error } = await supabase
      .from('cbe_ai_knowledge')
      .select('question, answer')
      .textSearch('search_vector', question, { type: 'plain', config: 'english' })
      .limit(5);

    if (!error && data && data.length) {
      const clean = data.filter(r => !isBadReply(r.answer));
      if (clean.length) return clean;
    }

    const { data: fuzzyData, error: fuzzyError } = await supabase.rpc('match_ai_knowledge', {
      search_query: question,
      match_count: 5
    });

    if (fuzzyError || !fuzzyData) return [];
    return fuzzyData.filter(r => !isBadReply(r.answer));
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
    // drop stored refusals, and the user turn that triggered each one, so they can't prime the model
    const rows = data.reverse();
    const clean = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.role === 'assistant' && isBadReply(r.content)) {
        if (clean.length && clean[clean.length - 1].role === 'user') clean.pop();
        continue;
      }
      clean.push(r);
    }
    return clean;
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
  }
}

async function saveQA(question, answer, rollNumber) {
  if (!supabase || !question || !answer) return;
  if (isBadReply(answer)) return;
  // Never put personal/live answers (attendance, schedule, groups…) in the shared knowledge base
  if (isPersonalQuestion(question)) return;
  try {
    const embedding = await getEmbedding(question);
    await supabase.from('cbe_ai_knowledge').insert({
      question: question.slice(0, 2000),
      answer: answer.slice(0, 4000),
      roll_number: rollNumber || null,
      embedding: embedding || null
    });
  } catch (e) {
  }
}

/* ==========================================================================
   LLM call
   ========================================================================== */
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
      // generous: reasoning tokens count against this, and long schedules/lists need room
      max_tokens: 1800,
      temperature: 0.2,
      top_p: 0.9
    })
  });
}

function extractReply(data) {
  return data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content.trim()
      : '';
}

async function askModel(apiKey, systemPrompt, messages) {
  let upstream = await callGroq(apiKey, PRIMARY_MODEL, systemPrompt, messages);
  if (!upstream.ok && (upstream.status === 429 || upstream.status >= 500)) {
    upstream = await callGroq(apiKey, FALLBACK_MODEL, systemPrompt, messages);
  }
  if (!upstream.ok) {
    const errText = await upstream.text();
    const err = new Error('upstream');
    err.status = upstream.status;
    err.detail = errText.slice(0, 500);
    throw err;
  }
  return extractReply(await upstream.json());
}

async function handler(req, res) {
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

  // Only known students get personal data
  let rollNumber = body && body.context && body.context.rollNumber ? String(body.context.rollNumber).trim().toUpperCase() : null;
  if (rollNumber && !STUDENT_MAP[rollNumber]) rollNumber = null;

  let effectiveMessages = trimmed;
  if (rollNumber && trimmed.length <= 2) {
    const history = await loadChatHistory(rollNumber, 30);
    if (history.length) {
      effectiveMessages = [...history, ...trimmed].slice(-30);
    }
  }

  const latestQuestion = getLatestUserQuestion(trimmed);
  const recentUserText = {
    latest: latestQuestion,
    joined: trimmed.filter(m => m.role === 'user').slice(-4).map(m => m.content).join(' \n '),
  };
  const [references, site] = await Promise.all([
    getRelevantReferences(latestQuestion),
    fetchSiteContext(rollNumber, recentUserText),
  ]);
  const systemPrompt = buildSystemPrompt(body && body.context, references, site);

  try {
    let reply = await askModel(apiKey, systemPrompt, effectiveMessages);

    // Empty or refusal-style → retry once with a clean slate (no stored history, no references)
    if (!reply || isBadReply(reply)) {
      const cleanPrompt = buildSystemPrompt(body && body.context, [], site);
      try {
        const retry = await askModel(apiKey, cleanPrompt, trimmed);
        if (retry && !isBadReply(retry)) reply = retry;
      } catch (e) { /* fall through to the friendly message */ }
    }

    if (!reply || isBadReply(reply)) {
      res.status(200).json({ reply: "Hmm, I didn't get a clear answer for that — try rephrasing?" });
      return;
    }

    await saveQA(latestQuestion, reply, rollNumber);
    if (rollNumber) {
      await saveChatTurn(rollNumber, 'user', latestQuestion);
      await saveChatTurn(rollNumber, 'assistant', reply);
    }

    res.status(200).json({ reply });
  } catch (e) {
    if (e && e.status) {
      res.status(e.status).json({ error: 'Upstream error', detail: e.detail });
      return;
    }
    res.status(500).json({ error: 'Request failed', detail: String((e && e.message) || e) });
  }
}

module.exports = handler;
// exposed for offline parity tests only
module.exports.__internals = {
  buildPersonalWeekSchedule, scheduleForDate, computeStats, attendanceProjection,
  migrateAttendanceKeys, parseGradesFromText, computeSpi, fluidLabGroupOf, detectIntents, isPersonalQuestion,
};