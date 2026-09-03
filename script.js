(function(){
  "use strict";

  const STUDENTS = [{"roll":"2501CB23","name":"AARSH JAIN"},{"roll":"2501CB49","name":"ABHI RAJ"},{"roll":"2501CB13","name":"ABHINAV B"},{"roll":"2501CB33","name":"ABHISHEK BANSAL"},{"roll":"2501CB58","name":"ADWAIT VATS"},{"roll":"2501CB42","name":"AHAN BHATTACHARJEE"},{"roll":"2501CB39","name":"AMAN SAROJ"},{"roll":"2501CB14","name":"ANGAJ SAHIL SARJERAO"},{"roll":"2501CB34","name":"ANSER AYAAN"},{"roll":"2501CB62","name":"ANSHU VISHWAKARMA"},{"roll":"2501CB37","name":"ANUPAM SHARMA"},{"roll":"2501CB06","name":"ARCHIT SHANKER"},{"roll":"2501CB26","name":"ARYAN DEV"},{"roll":"2501CB41","name":"AVDHESH MEENA"},{"roll":"2501CB16","name":"BIBHAS BIKASH BISWAS"},{"roll":"2501CB32","name":"BIKI BARMAN"},{"roll":"2501CB60","name":"BISWAS MAYANK PRADYUT"},{"roll":"2501CB51","name":"BOYINA SADVIKA"},{"roll":"2501CB46","name":"CHILMAKURI CHARAN"},{"roll":"2501CB24","name":"DHADSE OMESH VASANTRAO"},{"roll":"2501CB19","name":"DHRUV AGNIHOTRI"},{"roll":"2501CB22","name":"DHRUV ARVIND GANATRA"},{"roll":"2501CB03","name":"DIA HALDER"},{"roll":"2501CB04","name":"EMIN PHILIP SAJI"},{"roll":"2501CB40","name":"GAURAV SUKHADIA"},{"roll":"2501CB47","name":"HARIOM SINGH"},{"roll":"2501CB31","name":"HEMANT KUMAR BAIRWA"},{"roll":"2501CB01","name":"J SAMRUTHA"},{"roll":"2501CB07","name":"JARPULA MURALI"},{"roll":"2501CB05","name":"KAJAL BATRA"},{"roll":"2501CB11","name":"KARISHMA"},{"roll":"2501CB10","name":"KATURI VANSHIKA"},{"roll":"2501CB29","name":"KAVYA GUPTA"},{"roll":"2501CB48","name":"MADA AKEERA SRI VARSHAN"},{"roll":"2501CB43","name":"MADHUR SRIVASTAVA"},{"roll":"2501CB08","name":"MANAV RATHORE"},{"roll":"2501CB21","name":"NASREEN FATIMA"},{"roll":"2501CB20","name":"OSHI MALVIYA"},{"roll":"2501CB45","name":"PILLI SRI VAISHNAVI"},{"roll":"2501CB02","name":"PRIYANSHI PATEL"},{"roll":"2501CB12","name":"PUSHPENDRA SHARMA"},{"roll":"2501CB57","name":"RAGHVENDRA MEENA"},{"roll":"2501CB56","name":"RAJ ARYAN"},{"roll":"2501CB50","name":"RAUSHAN KUMAR"},{"roll":"2501CB54","name":"RIDDHI PATEL"},{"roll":"2501CB35","name":"S ADITYA"},{"roll":"2501CB55","name":"SACHIN"},{"roll":"2501CB38","name":"SAI SUBRAT JENA"},{"roll":"2501CB44","name":"SAKALA SATHWIK"},{"roll":"2501CB15","name":"SAMIT SARDAR"},{"roll":"2501CB53","name":"SANKET YADAV JADHAV"},{"roll":"2501CB09","name":"SAPTARSHI BOSE"},{"roll":"2501CB52","name":"SARTHAK ANUSIMI"},{"roll":"2501CB61","name":"SATISH KUMAR YADAV"},{"roll":"2501CB28","name":"SHANTANU SARDAR"},{"roll":"2501CB64","name":"SHORYA PRATAP SINGH"},{"roll":"2501CB59","name":"SNEHADIP GHOSH"},{"roll":"2501CB30","name":"SWARNAVA KUNDU"},{"roll":"2501CB63","name":"TANIYA KUMARI GUPTA"},{"roll":"2501CB25","name":"VAANYA VERMA"},{"roll":"2501CB36","name":"VADAVELLI KAMALI HARSHITHA"},{"roll":"2501CB65","name":"VADITHYA UPENDAR"},{"roll":"2501CB17","name":"VAIBHAV SANJAY BHAGURE"},{"roll":"2501CB27","name":"VAISHNAV KRISHNA DURGASI"},{"roll":"2501CB18","name":"VANSH KHURANA"},{"roll":"2503CB01","name":"ADARSH CHOUDHARY"},{"roll":"2503CB02","name":"AMOOLYA SHARAN"},{"roll":"2503CB05","name":"DHEERAJ KUMAR"},{"roll":"2503CB03","name":"TEJVEER"},{"roll":"2503CB04","name":"YASH MADHOK"}];
  const STUDENT_MAP = {};
  STUDENTS.forEach(s => STUDENT_MAP[s.roll.toUpperCase()] = s.name);

  // Roll numbers that are blocked from logging in / using the app.
  // (empty by default — add roll numbers here, e.g. ["2501CB99"], to block them.)
  const BLOCKED_ROLLS = [];

  function isBlockedRoll(roll){
    return BLOCKED_ROLLS.includes(String(roll).toUpperCase());
  }

  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DAY_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  // ===== Session activity logging → Google Sheet =====
  // Paste your Apps Script Web App URL here (see SHEET_SETUP.md).
  const SESSION_LOG_URL = "https://script.google.com/macros/s/AKfycbyU7zwzJ-IMB0JHVxlinK9Modtbp8NG7W_YC6b4F6Via_8RJUgVdz_JE4QDPxF4wIjd/exec";
  // Roll numbers that should never be logged (e.g. your own, while testing).
  const SESSION_LOG_EXCLUDE = ["2501CB23","2501CB04","2501CB49","2501CB15","2501CB53","2501CB39","2501CB43","2501CB47","2503CB01","2501CB09","2501CB35","2501CB41","2503CB03","2501CB06","2501CB55","2501CB33","2501CB61","2501CB48","2503CB05","2501CB28","2501CB22","2501CB64","2501CB34","2501CB30","2501CB27","2501CB29","2501CB40","2501CB31","2501CB60","2501CB42"];

  const SessionTracker = (function(){
    let sessionId = null;
    let activeSeconds = 0;
    let idleTimer = null;
    let tickTimer = null;
    let heartbeatTimer = null;
    let isIdle = false;
    const IDLE_LIMIT_MS = 60 * 1000;   // no interaction for 60s = idle, stop counting
    const TICK_MS = 5 * 1000;          // add to active time every 5s while active+visible
    const HEARTBEAT_MS = 30 * 1000;    // push active_seconds to the sheet every 30s

    function configured(){
      return !!SESSION_LOG_URL && !SESSION_LOG_URL.includes("PASTE_");
    }

    function send(payload){
      if(!configured()) return;
      try{
        const body = JSON.stringify(payload);
        if(navigator.sendBeacon){
          navigator.sendBeacon(SESSION_LOG_URL, new Blob([body], { type: "text/plain;charset=utf-8" }));
        } else {
          fetch(SESSION_LOG_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body,
            keepalive: true
          }).catch(()=>{});
        }
      }catch(e){ /* logging must never break the app */ }
    }

    function markActive(){
      isIdle = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(()=>{ isIdle = true; }, IDLE_LIMIT_MS);
    }

    function tick(){
      if(document.visibilityState === "visible" && !isIdle){
        activeSeconds += TICK_MS / 1000;
      }
    }

    function start(user){
      if(!configured() || sessionId) return;
      if(SESSION_LOG_EXCLUDE.includes(user.roll)) return;
      sessionId = user.roll + "_" + Date.now();
      activeSeconds = 0;
      markActive();

      send({ type: "start", session_id: sessionId, roll: user.roll, name: user.name, login_time: new Date().toISOString() });

      ["mousemove","keydown","touchstart","scroll","click"].forEach(evt=>{
        document.addEventListener(evt, markActive, { passive: true });
      });

      tickTimer = setInterval(tick, TICK_MS);
      heartbeatTimer = setInterval(()=>{
        send({ type: "heartbeat", session_id: sessionId, active_seconds: Math.round(activeSeconds), last_seen: new Date().toISOString() });
      }, HEARTBEAT_MS);
    }

    function end(){
      if(!sessionId) return;
      send({ type: "end", session_id: sessionId, logout_time: new Date().toISOString(), active_seconds: Math.round(activeSeconds) });
      clearInterval(tickTimer);
      clearInterval(heartbeatTimer);
      clearTimeout(idleTimer);
      sessionId = null;
    }

    return { start, end };
  })();

  window.addEventListener("pagehide", ()=> SessionTracker.end());

  function tm(h,m){ return h*60+m; }

  const SEMESTER_START = new Date(2026, 6, 28); // 28 Jul 2026 (Tue)

  const SCHEDULE = [
    // Monday
    { day:1, start:tm(16,0), end:tm(16,55), code:"CB2102", type:"lecture", room:"R102" },
    { day:1, start:tm(17,0), end:tm(17,55), code:"CB2103", type:"lecture", room:"R307" },

    // Tuesday
    { day:2, start:tm(9,0),  end:tm(9,55),  code:"CB2105", type:"lecture", room:"R106" },
    { day:2, start:tm(10,0), end:tm(10,55), code:"CB2104", type:"lecture", room:"R102" },
    { day:2, start:tm(15,0), end:tm(16,55), code:"CB2101", type:"lecture", room:"R105" },

    // Wednesday
    { day:3, start:tm(9,0),  end:tm(9,55),  code:"CB2105", type:"lecture", room:"R307" },
    { day:3, start:tm(10,0), end:tm(10,55), code:"CB2103", type:"lecture", room:"R307" },
    { day:3, start:tm(15,0), end:tm(16,55), code:"CB2102", type:"lecture", room:"R102" },
    { day:3, start:tm(17,0), end:tm(17,55), code:"CB2104", type:"lecture", room:"LT001" },

    // Thursday
    { day:4, start:tm(10,0), end:tm(12,55), code:"CB2103", type:"lab",     room:"Lab"  },
    { day:4, start:tm(15,0), end:tm(15,55), code:"CB2103", type:"lecture", room:"R102" },
    { day:4, start:tm(16,0), end:tm(18,0),  code:"CB2104", type:"lecture", room:"LT001"  },

    // Friday
    { day:5, start:tm(9,0),  end:tm(9,55),  code:"CB2105", type:"lecture", room:"R110" },
    { day:5, start:tm(15,0), end:tm(15,55), code:"CB2102", type:"lecture", room:"R102" },
 
  ].sort((a,b)=> a.day-b.day || a.start-b.start);

  const COURSE_CODES = [...new Set(SCHEDULE.map(s=>s.code))].sort();

  const COURSE_NAMES = {
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
    CB2101: { l:2, t:0, p:0, c:2 },
    CB2102: { l:3, t:1, p:2, c:5 },
    CB2103: { l:3, t:0, p:3, c:4.5 },
    CB2104: { l:3, t:1, p:0, c:4 },
    CB2105: { l:3, t:0, p:0, c:3 },
    HS2101: { l:3, t:1, p:0, c:4 },
    HS2110: { l:3, t:0, p:0, c:3 },
    HS2111: { l:3, t:0, p:0, c:3 },
    HS2112: { l:3, t:0, p:0, c:3 },
  };
  function courseCategory(code){
    if(code === MBA_COURSE.code) return "mba";
    if(HSS_MAP[code]) return "hss";
    return "lecture";
  }

  const LAB_SPLIT_COURSES = new Set(["CB2102", "CB2103"]); 

  // ---- CB2102 Fluid Mechanics Lab: 16 groups, alternating weeks ----
  // Groups 1-8 ("set A") and Groups 9-16 ("set B") take the lab on
  // alternating weeks. Roster sourced from CB2102_LAB_Group_list.pdf.
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
  Object.keys(FLUID_LAB_GROUPS).forEach(g=>{
    FLUID_LAB_GROUPS[g].forEach(roll=>{ FLUID_LAB_GROUP_OF[roll] = Number(g); });
  });
  function fluidLabGroupOf(roll){
    return FLUID_LAB_GROUP_OF[String(roll||"").toUpperCase()] || null;
  }
  function fluidLabSetOf(groupNum){
    if(!groupNum) return null;
    return groupNum <= 8 ? "A" : "B";
  }
  function fluidLabMondayOf(date){
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay(); // 0 Sun..6 Sat
    const diffToMon = (dow === 0 ? -6 : 1) - dow;
    d.setDate(d.getDate() + diffToMon);
    return d;
  }
  // Week of Mon 24 Aug 2026 confirmed as Set A's (Groups 1-8) turn.
  // That week's lab was moved from its usual Friday slot to a one-off
  // Monday 24 Aug 10:00-12:00 session, for Groups 1-8 only.
  const FLUID_LAB_ANCHOR_MONDAY = fluidLabMondayOf(new Date(2026,7,24));
  const FLUID_LAB_EXCEPTION_ISO = "2026-08-24";
  function fluidLabActiveSetForWeek(date){
    const wkMon = fluidLabMondayOf(date);
    const diffWeeks = Math.round((wkMon - FLUID_LAB_ANCHOR_MONDAY) / (7*24*60*60*1000));
    const parity = ((diffWeeks % 2) + 2) % 2;
    return parity === 0 ? "A" : "B";
  }
  // Returns a CB2102 lab session object for this date/group, or null.
  function fluidLabSessionForDate(date, groupNum){
    if(!groupNum) return null;
    const iso = isoDate(date);
    const mySet = fluidLabSetOf(groupNum);
    const isExceptionWeek = isoDate(fluidLabMondayOf(date)) === isoDate(FLUID_LAB_ANCHOR_MONDAY);

    // One-off: Monday 24 Aug 2026, Groups 1-8 only.
    if(iso === FLUID_LAB_EXCEPTION_ISO && mySet === "A"){
      return { day:1, start:tm(11,0), end:tm(13,0), code:"CB2102", type:"lab", room:"Lab", note:"Shifted from Friday — this week only" };
    }
    // During the exception week, nobody gets the normal Friday slot
    // (Set A already had theirs on Monday; it's not Set B's turn).
    if(isExceptionWeek) return null;

    // Normal alternating pattern: whichever set is "on" gets Friday's slot.
    if(date.getDay() === 5 && fluidLabActiveSetForWeek(date) === mySet){
      return { day:5, start:tm(10,0), end:tm(11,55), code:"CB2102", type:"lab", room:"Lab" };
    }
    return null;
  }


  const HSS_START = tm(14,0), HSS_END = tm(15,0);
  const HSS_ELECTIVES = [
    { code:"HS2110", slot:6,  sessions:[{day:3,room:"LT103"},{day:4,room:"LT103"},{day:5,room:"LT103"}] }, // Wed/Thu/Fri
    { code:"HS2111", slot:32, sessions:[{day:2,room:"LT001"},{day:3,room:"LT001"},{day:4,room:"LT001"}] }, // Tue/Wed/Thu
    { code:"HS2112", slot:1,  sessions:[{day:2,room:"LT103"},{day:3,room:"LT003"},{day:4,room:"LT003"}] }, // Tue/Wed/Thu
  ];
  const HSS_MAP = {};
  HSS_ELECTIVES.forEach(h => HSS_MAP[h.code] = h);

  const MBA_ROLL_PREFIX = "2503CB";
  function isMbaRoll(roll){ return typeof roll === "string" && roll.toUpperCase().startsWith(MBA_ROLL_PREFIX); }
  const MBA_COURSE = {
    code: "HS2101",
    sessions: [
      { day:1, start:tm(15,0), end:tm(15,55), room:"B1/202" },                    // Mon 3:00–3:55 PM
      { day:3, start:tm(10,0), end:tm(10,55), room:"B1/202" },                    // Wed 10:00–10:55 AM
      { day:5, start:tm(10,0), end:tm(10,55), room:"B1/202" },                    // Fri 10:00–10:55 AM
      { day:5, start:tm(15,0), end:tm(15,55), room:"B1/202", tag:"tutorial" },    // Fri 3:00–3:55 PM (Tutorial)
    ]
  };

  // ===== Mid-semester exam datesheet (20–28 Sep 2026) =====
  const MIDSEM_SLOT_MORNING = "10:30 AM – 12:30 PM";
  const MIDSEM_SLOT_EVENING = "3:30 PM – 5:30 PM";

  const MIDSEM_CORE = [
    { code:"CB2101", date:"2026-09-21", day:"Monday" },
    { code:"CB2102", date:"2026-09-23", day:"Wednesday" },
    { code:"CB2105", date:"2026-09-24", day:"Thursday" },
    { code:"CB2103", date:"2026-09-25", day:"Friday" },
    { code:"CB2104", date:"2026-09-26", day:"Saturday",
      note:"" },
  ];

  // HS2110 / HS2111 / HS2112 all sit in the same exam slot — only the code differs by section.
  const MIDSEM_HSS_DATE = "2026-09-22";
  const MIDSEM_HSS_DAY = "Tuesday";

  // Full week, both slots, every branch — for spotting a friend's exam or a room clash.
 // ============================================================
// MIDSEM — HS2110 / HS2111 / HS2112
// These courses share the same exam slot; only the section/code differs.
// ============================================================

const MIDSEM_HS_DATE = "2026-09-22";
const MIDSEM_HS_DAY = "Tuesday";


// ============================================================
// FULL MIDSEM SCHEDULE
// Both slots, every branch
// Used for spotting a friend's exam / room clash.
// ============================================================

const MIDSEM_FULL = [

  {
    date: "2026-09-20",
    day: "Sunday",

    morning: "CH001, CH4101, CS1101, EC5105, HS2101, MA4107, MA5101, PH4101, PH5101",

    evening: "CE6133, EC4105, HS3102, HS5111, HS7101, HS7103, MA7102"
  },


  {
    date: "2026-09-21",
    day: "Monday",

    morning: "CB2101, CE2101, CH1101, CH2101, CH4102, CS2101, EC2101, EP2101, HS2102, MA2101, MA4108, ME2103, MM2101, PH1101",

    evening: "CB3101, CE3101, CH3101, CS3101, CS6112, EC3101, EP3101, EP4105, HS3101, HS7104, MA3101, MA6109, ME3101, ME6113, MM3101, MM4102, MM6105, PH6124"
  },


  {
    date: "2026-09-22",
    day: "Tuesday",

    morning: "CB4107, HS001, HS2110, HS2111, HS2112, HS4111, MA5102, PH4107, PH5102",

    evening: "CB3106, CB5101, CE5101, CE5104, CE5107, CE5108/CE4104/CE6119, CE5111, CE6135, CS3106, CS5102, EC5102, EC5106, HS3108, HS7105, MC5102, ME3106, ME5101, MM3106, MM4105, MM5101, PH4109, PH7104"
  },


  {
    date: "2026-09-23",
    day: "Wednesday",

    morning: "CB2102/CH2104, CB6104, CE2102, CH4103, CH5102, CS2102, EC2102, EP2102, MA1101, MA2102/HS2105, MA4109, MA5103, ME2102, MM2102, PH4103",

    evening: "CB3102, CE3102, CE5106, CE6116/CE4101, CH3102, CH4108, CH7103, CS3102, EC3102, EC5101, EE3102, EE5101, EP3102, HS3111, HS7106, MA3102, MC5101/CS5101, ME3102, ME5103, ME6104, MH5101, MM3102, MM5102"
  },


  {
    date: "2026-09-24",
    day: "Thursday",

    morning: "CB2105, CH2102, CH5103, CS2103, CS4110/CS6101/MA5104, EE2102, HS2104, HS2114, MA4106/MA5106, PH4102, PH5105, PH5111, PH5113/PH6119",

    evening: "CB3103, CB5102, CE3103, CE5102, CE5105, CE5109/CE6124, CE5112, CH3103, CH4109, CS3103, EC3103, EC5104, EC6101, EE3101, EE5103, HS3103, MA3103, ME3103, ME5106, MM3103, MM5103"
  },


  {
    date: "2026-09-25",
    day: "Friday",

    morning: "CB2103, CE2103, CH2103, CH4104, CH5105, EC2103, EE1101, EE2103, EP2103, HS2103, MA001, MA2103, MA4110, ME1102, ME2101, MM2103, PH4104",

    evening: "CB3104, CB4108, CB5103, CE3104, CE5103, CE5110/CE6120, CE5113, CH3104, CS3104, CS3105, CS4113, EC3104, EC5103, EE5102, EP3104, HS3104, MA3104, MA6106, ME3104, ME4103, ME5102, ME5105, ME5108, MM3104, MM4107, MM5104, PH4110"
  },


  {
    date: "2026-09-26",
    day: "Saturday",

    morning: "CB2104/CH2105, CE2104, CH4105, CS2104, EE2101, EP2104, HS1101, HS2108, MA2104, MA4111, ME2104, MM2104, PH4105",

    evening: "CB3105, CE6109, EC5116/EC5110, EE6103, EP3105, HS4118, HS4119, MA3105, ME3105"
  },


  {
    date: "2026-09-27",
    day: "Sunday",

    morning: "CE1101, CE6128, CS2105, EC3105, HS4123, MA2105, MM2105, PH001",

    evening: "CB4103, CB6105, CE4106, CE6130, CS6109, EC5113/EC5119, EE6104, EP3103, ME4105, ME4106, ME6109, ME6111"
  },


  {
    date: "2026-09-28",
    day: "Monday",

    morning: "HS2115, HS4109",

    evening: "CE6101, CE6125, CS4101/CS6103, EC4102, EC5114, EE6117, MA4103, ME4101, ME6102/ME4102, ME6106, ME6107, MM6101"
  }

];

  let hssCode = null; 
  let PERSONAL_SCHEDULE = SCHEDULE.slice();

  function rebuildPersonalSchedule(){
    let list = SCHEDULE.slice();
    if(hssCode && HSS_MAP[hssCode]){
      HSS_MAP[hssCode].sessions.forEach(sess=>{
        list.push({ day:sess.day, start:HSS_START, end:HSS_END, code:hssCode, type:"hss", room:sess.room });
      });
    }
    if(currentUser && isMbaRoll(currentUser.roll)){
      MBA_COURSE.sessions.forEach(sess=>{
        list.push({ day:sess.day, start:sess.start, end:sess.end, code:MBA_COURSE.code, type:"mba", room:sess.room, tag:sess.tag });
      });
    }
    PERSONAL_SCHEDULE = list.sort((a,b)=> a.day-b.day || a.start-b.start);
  }

  function activeCourseCodes(){
    let codes = COURSE_CODES.slice();
    if(hssCode && HSS_MAP[hssCode]) codes.push(hssCode);
    if(currentUser && isMbaRoll(currentUser.roll)) codes.push(MBA_COURSE.code);
    return codes;
  }

 
  function statGroupsForActiveCourses(){
    const groups = [];
    activeCourseCodes().forEach(code=>{
      if(LAB_SPLIT_COURSES.has(code)){
        groups.push({ key: code+':theory', code, splitType:'lecture', label:'Theory' });
        groups.push({ key: code+':lab',    code, splitType:'lab',     label:'Lab' });
      } else {
        groups.push({ key: code, code, splitType:null, label:null });
      }
    });
    return groups;
  }

  function statKeyForSession(code, sessionType){
    if(LAB_SPLIT_COURSES.has(code)) return sessionType==='lab' ? code+':lab' : code+':theory';
    return code;
  }

  const GRADE_POINTS = { AA:10, AB:9, BB:8, BC:7, CC:6, CD:5, DD:4, F:0 };
  const GRADE_COLOR_VARS = {
    AA:'var(--teal)', AB:'var(--teal)', BB:'var(--green)', BC:'var(--green)',
    CC:'var(--amber)', CD:'var(--amber)', DD:'var(--rose)', F:'var(--rose)'
  };
  const SPI_SHEET_URL = "https://script.google.com/macros/s/AKfycbyZzh5TVusLQDYL6rOn9xVhpinAEqIty9dUS3qRAcgK4KmWqkXj9WFUA-qWacSoTbSB/exec";

  function spiTheme(s){
    if(s >= 9) return { color:'var(--teal)',  label:'Outstanding' };
    if(s >= 8) return { color:'var(--green)', label:'Excellent' };
    if(s >= 7) return { color:'var(--blue)',  label:'Very Good' };
    if(s >= 6) return { color:'var(--amber)', label:'Good' };
    if(s >= 5) return { color:'var(--amber)', label:'Average' };
    return       { color:'var(--rose)',  label:'Below Avg' };
  }
  
  const SUPABASE_URL = "https://ektzrezmwzhautdmbrwf.supabase.co";       
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdHpyZXptd3poYXV0ZG1icndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTY1MzksImV4cCI6MjEwMDQ3MjUzOX0.IoVDIWNNqMzFFZUk_C2LV8Wm-cxBs3OM6Cp5bP2GTr4";  

  // ===== Admin login gate =====
  // The password check now happens server-side in /api/admin-login.js — the
  // password itself lives only in a Vercel environment variable, never in
  // this file. A successful check returns a short-lived signed token, which
  // is what actually proves admin status to the server (see ADMIN_TOKEN below
  // and requireAdmin() in api/_adminAuth.js).
  const ADMIN_LOGIN_ROLL = "2501CB23";
  let ADMIN_TOKEN = null; // { token, expiresAt } — kept in memory only, never persisted
  async function verifyAdminPassword(pw){
    if(!pw) return false;
    try{
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll: ADMIN_LOGIN_ROLL, password: pw })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok || !data.token) return false;
      ADMIN_TOKEN = { token: data.token, expiresAt: data.expiresAt };
      return true;
    }catch(e){
      return false;
    }
  }
  function adminTokenValid(){
    return !!(ADMIN_TOKEN && ADMIN_TOKEN.expiresAt && Date.now() < ADMIN_TOKEN.expiresAt);
  }
  // Attach this to any fetch() that hits an admin-only /api endpoint.
  function adminAuthHeader(){
    return adminTokenValid() ? { 'x-admin-token': ADMIN_TOKEN.token } : {};
  }

  const PYQ_BUCKET = "pyq";
  const PYQ_ADMIN_ROLL = "2501CB23";
  function pyqPublicUrl(storagePath){
    return `${SUPABASE_URL}/storage/v1/object/public/${PYQ_BUCKET}/${storagePath}`;
  }
  function pyqIsAdmin(){
    return !!(currentUser && currentUser.roll === PYQ_ADMIN_ROLL && adminTokenValid());
  }

  const BOOKS_BUCKET = "books";
  const BOOKS_ADMIN_ROLL = "2501CB23";
  function booksPublicUrl(storagePath){
    return `${SUPABASE_URL}/storage/v1/object/public/${BOOKS_BUCKET}/${storagePath}`;
  }
  function booksIsAdmin(){
    return !!(currentUser && currentUser.roll === BOOKS_ADMIN_ROLL && adminTokenValid());
  }

  // ===== Timetable admin (reschedule / cancel classes for everyone) =====
  const TIMETABLE_ADMIN_ROLL = "2501CB23";
  function timetableIsAdmin(){
    return !!(currentUser && currentUser.roll === TIMETABLE_ADMIN_ROLL && adminTokenValid());
  }

  // ===== Announcements =====
  const ANNOUNCE_ADMIN_ROLL = "2501CB23";
  const ANNOUNCE_TTL_HOURS = 6;
  function announceIsAdmin(){
    return !!(currentUser && currentUser.roll === ANNOUNCE_ADMIN_ROLL && adminTokenValid());
  }
  function announceHeaders(){
    return { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  }
  function escapeHtml(str){
    return String(str == null ? '' : str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  const Store = (function(){
    const hasRemote = !!(window.storage && typeof window.storage.get === 'function');
    const hasSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    const NS = 'cbe-timetable:';

    function lsRead(key){
      try{
        const raw = localStorage.getItem(NS + key);
        return raw === null ? null : { key, value: raw };
      }catch(e){ return null; }
    }
    function lsWrite(key, value){
      try{ localStorage.setItem(NS + key, value); return { key, value }; }
      catch(e){ return null; }
    }
    function lsRemove(key){
      try{ localStorage.removeItem(NS + key); return { key, deleted:true }; }
      catch(e){ return null; }
    }

    function sbHeaders(){
      return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      };
    }
    
    async function sbGetAttendance(roll){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_attendance?roll=eq.${encodeURIComponent(roll)}&select=attendance`, { headers: sbHeaders() });
      if(!res.ok) throw new Error('supabase get failed: ' + res.status);
      const rows = await res.json();
      return rows[0] ? JSON.stringify(rows[0].attendance || {}) : null;
    }
    async function sbSetAttendance(roll, name, valueStr){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_attendance`, {
        method: 'POST',
        headers: Object.assign(sbHeaders(), { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify([{ roll, name, attendance: JSON.parse(valueStr), updated_at: new Date().toISOString() }])
      });
      if(!res.ok) throw new Error('supabase set failed: ' + res.status);
    }
    async function sbGetHss(roll){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_hss?roll=eq.${encodeURIComponent(roll)}&select=code`, { headers: sbHeaders() });
      if(!res.ok) throw new Error('supabase get failed: ' + res.status);
      const rows = await res.json();
      return rows[0] ? (rows[0].code || "") : null;
    }
    async function sbSetHss(roll, code){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_hss`, {
        method: 'POST',
        headers: Object.assign(sbHeaders(), { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify([{ roll, code, updated_at: new Date().toISOString() }])
      });
      if(!res.ok) throw new Error('supabase set failed: ' + res.status);
    }
    async function sbGetDayOverrides(roll){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_day_overrides?roll=eq.${encodeURIComponent(roll)}&select=overrides`, { headers: sbHeaders() });
      if(!res.ok) throw new Error('supabase get failed: ' + res.status);
      const rows = await res.json();
      return rows[0] ? JSON.stringify(rows[0].overrides || {}) : null;
    }
    async function sbSetDayOverrides(roll, name, valueStr){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_day_overrides`, {
        method: 'POST',
        headers: Object.assign(sbHeaders(), { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify([{ roll, name, overrides: JSON.parse(valueStr), updated_at: new Date().toISOString() }])
      });
      if(!res.ok) throw new Error('supabase set failed: ' + res.status);
    }
    async function sbGetGlobalOverrides(){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_global_overrides?id=eq.1&select=overrides`, { headers: sbHeaders() });
      if(!res.ok) throw new Error('supabase get failed: ' + res.status);
      const rows = await res.json();
      return rows[0] ? JSON.stringify(rows[0].overrides || {}) : null;
    }
    async function sbSetGlobalOverrides(valueStr, updatedBy){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_global_overrides`, {
        method: 'POST',
        headers: Object.assign(sbHeaders(), { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify([{ id: 1, overrides: JSON.parse(valueStr), updated_by: updatedBy || '', updated_at: new Date().toISOString() }])
      });
      if(!res.ok) throw new Error('supabase set failed: ' + res.status);
    }
    async function sbGetCourseNames(){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_course_names?id=eq.1&select=names`, { headers: sbHeaders() });
      if(!res.ok) throw new Error('supabase get failed: ' + res.status);
      const rows = await res.json();
      return rows[0] ? JSON.stringify(rows[0].names || {}) : null;
    }
    async function sbSetCourseNames(valueStr){
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_course_names`, {
        method: 'POST',
        headers: Object.assign(sbHeaders(), { Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify([{ id: 1, names: JSON.parse(valueStr), updated_at: new Date().toISOString() }])
      });
      if(!res.ok) throw new Error('supabase set failed: ' + res.status);
    }

    return {
      isRemote: hasRemote,
      isCloud: hasRemote || hasSupabase,
      async get(key, shared){
        if(hasRemote){
          try{ return await window.storage.get(key, shared); }
          catch(e){ return null; }
        }
        if(hasSupabase){
          if(key.indexOf('attendance:') === 0 || key === 'course-names' || key === 'global-overrides' || key.indexOf('hss:') === 0 || key.indexOf('dayoverrides:') === 0){
            try{
              const raw = key.indexOf('attendance:') === 0
                ? await sbGetAttendance(key.slice('attendance:'.length))
                : key.indexOf('hss:') === 0
                ? await sbGetHss(key.slice('hss:'.length))
                : key.indexOf('dayoverrides:') === 0
                ? await sbGetDayOverrides(key.slice('dayoverrides:'.length))
                : key === 'global-overrides'
                ? await sbGetGlobalOverrides()
                : await sbGetCourseNames();
              if(raw !== null) lsWrite(key, raw); 
              return raw === null ? lsRead(key) : { key, value: raw };
            }catch(e){
              console.warn('Supabase unreachable, using local cache', e);
              return lsRead(key);
            }
          }
        }
        return lsRead(key);
      },
      async set(key, value, shared){
        lsWrite(key, value); 
        if(hasRemote){
          try{ const r = await window.storage.set(key, value, shared); return r ? { key, value, synced:true } : { key, value, synced:false }; }
          catch(e){ return { key, value, synced:false }; }
        }
        if(hasSupabase && (key.indexOf('attendance:') === 0 || key === 'course-names' || key === 'global-overrides' || key.indexOf('hss:') === 0 || key.indexOf('dayoverrides:') === 0)){
          try{
            if(key.indexOf('attendance:') === 0) await sbSetAttendance(key.slice('attendance:'.length), currentUser ? currentUser.name : '', value);
            else if(key.indexOf('hss:') === 0) await sbSetHss(key.slice('hss:'.length), value);
            else if(key.indexOf('dayoverrides:') === 0) await sbSetDayOverrides(key.slice('dayoverrides:'.length), currentUser ? currentUser.name : '', value);
            else if(key === 'global-overrides') await sbSetGlobalOverrides(value, currentUser ? currentUser.roll : '');
            else await sbSetCourseNames(value);
            return { key, value, synced:true };
          }catch(e){
            console.warn('Supabase save failed, kept in local cache only', e);
            return { key, value, synced:false };
          }
        }
        return { key, value, synced:true };
      },
      async delete(key, shared){
        lsRemove(key);
        if(hasRemote){
          try{ return await window.storage.delete(key, shared); }
          catch(e){ return null; }
        }
        return { key, deleted:true };
      }
    };
  })();

  let attendance = {};
  let courseNames = {};
  let dayOverrides = {}; 
  let globalOverrides = {};
  let currentUser = null; 

  const loginScreen = document.getElementById('loginScreen');
  const appScreen = document.getElementById('appScreen');
  const rollInput = document.getElementById('rollInput');
  const rollSuggest = document.getElementById('rollSuggest');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  const rememberMe = document.getElementById('rememberMe');
  const adminPassField = document.getElementById('adminPassField');
  const adminPassInput = document.getElementById('adminPassInput');

  function syncAdminPassVisibility(){
    const roll = rollInput.value.trim().toUpperCase();
    if(adminPassField) adminPassField.style.display = (roll === ADMIN_LOGIN_ROLL) ? 'block' : 'none';
    if(roll !== ADMIN_LOGIN_ROLL && adminPassInput) adminPassInput.value = '';
  }

  function showSuggestions(q){
    q = q.trim().toUpperCase();
    if(!q){ rollSuggest.classList.remove('show'); rollSuggest.innerHTML=''; return; }
    const matches = STUDENTS.filter(s => !isBlockedRoll(s.roll) && (s.roll.includes(q) || s.name.toUpperCase().includes(q))).slice(0,8);
    if(!matches.length){ rollSuggest.classList.remove('show'); rollSuggest.innerHTML=''; return; }
    rollSuggest.innerHTML = matches.map(s => `<div class="login-suggest-item" data-roll="${s.roll}"><span class="r">${s.roll}</span><span class="n">${s.name}</span></div>`).join('');
    rollSuggest.classList.add('show');
    rollSuggest.querySelectorAll('.login-suggest-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        rollInput.value = el.dataset.roll;
        rollSuggest.classList.remove('show');
        syncAdminPassVisibility();
        if(adminPassField && adminPassField.style.display === 'block'){
          adminPassInput.focus();
        } else {
          rollInput.focus();
        }
      });
    });
  }

  rollInput.addEventListener('input', ()=>{
    loginError.classList.remove('show');
    showSuggestions(rollInput.value);
    syncAdminPassVisibility();
  });
  rollInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); if(adminPassField && adminPassField.style.display === 'block'){ adminPassInput.focus(); } else { attemptLogin(); } }
  });
  if(adminPassInput){
    adminPassInput.addEventListener('input', ()=> loginError.classList.remove('show'));
    adminPassInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); attemptLogin(); }
    });
  }
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.login-field')) rollSuggest.classList.remove('show');
  });

  async function attemptLogin(){
    const roll = rollInput.value.trim().toUpperCase();
    if(!roll){ loginError.textContent = "Please enter your roll number."; loginError.classList.add('show'); return; }
    const name = STUDENT_MAP[roll];
    if(!name){
      loginError.textContent = "Roll number not found. Please check and try again.";
      loginError.classList.add('show');
      return;
    }
    if(isBlockedRoll(roll)){
      loginError.textContent = "This roll number is not permitted to access the app.";
      loginError.classList.add('show');
      return;
    }
    if(roll === ADMIN_LOGIN_ROLL){
      syncAdminPassVisibility();
      if(adminPassField && adminPassField.style.display !== 'block'){
        // Password field wasn't visible yet (e.g. roll was filled via
        // autofill or the suggestion list) — show it and stop here instead
        // of silently failing with an empty password.
        if(adminPassInput) adminPassInput.focus();
        return;
      }
      const pw = adminPassInput ? adminPassInput.value : '';
      loginBtn.disabled = true;
      const prevLabel = loginBtn.textContent;
      loginBtn.textContent = 'Checking…';
      let ok = false;
      try{
        ok = await verifyAdminPassword(pw);
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = prevLabel;
      }
      if(!ok){
        loginError.textContent = "Incorrect admin password.";
        loginError.classList.add('show');
        if(adminPassInput){ adminPassInput.value = ''; adminPassInput.focus(); }
        return;
      }
    }
    currentUser = { roll, name };
    // Never remember the admin roll across sessions — the password must be
    // re-entered every time, even with "remember me" checked.
    if(rememberMe.checked && roll !== ADMIN_LOGIN_ROLL){
      await Store.set('remembered-roll', roll, false);
    } else {
      await Store.delete('remembered-roll', false);
    }
    if(adminPassInput) adminPassInput.value = '';
    await enterApp();
  }

  loginBtn.addEventListener('click', attemptLogin);

  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    SessionTracker.end();
    currentUser = null;
    ADMIN_TOKEN = null;
    attendance = {};
    await Store.delete('remembered-roll', false);
    appScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    rollInput.value = '';
    loginError.classList.remove('show');
    rollInput.focus();
    if(chatFab) chatFab.style.display = 'none';
    if(chatPanel) chatPanel.style.display = 'none';
    chatHistory = [];
    announcements = [];
    announceReactions = {};
    announceLoaded = false;
    if(announceOverlay) announceOverlay.style.display = 'none';
    if(announceBanner) announceBanner.style.display = 'none';
    if(document.getElementById('announceBellDot')) document.getElementById('announceBellDot').style.display = 'none';
  });

  async function tryAutoLogin(){
    try{
      const r = await Store.get('remembered-roll', false);
      if(r && r.value && r.value.toUpperCase() === ADMIN_LOGIN_ROLL){
        // Old/previously-remembered admin session — never auto-login the admin
        // roll. Clear it and require the password on the login screen instead.
        await Store.delete('remembered-roll', false);
        rollInput.value = ADMIN_LOGIN_ROLL;
        syncAdminPassVisibility();
        return;
      }
      if(r && r.value && STUDENT_MAP[r.value.toUpperCase()] && !isBlockedRoll(r.value)){
        currentUser = { roll: r.value.toUpperCase(), name: STUDENT_MAP[r.value.toUpperCase()] };
        await enterApp();
      } else if(r && r.value && isBlockedRoll(r.value)){
        await Store.delete('remembered-roll', false);
      }
    }catch(e){ /* no remembered roll yet — fine, just show the login screen */ }
  }

  async function enterApp(){
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    document.getElementById('helloName').textContent = currentUser.name;
    document.getElementById('helloRoll').textContent = currentUser.roll;
    SessionTracker.start(currentUser);
    await loadUserData();
    renderAll();
    updateStorageBanner();
    updateSyncBadge();
    updateBackupCopy();
    updateBackupMeta();
    updateHssButton();
    if(chatFab) chatFab.style.display = 'flex';
    announceBannerDismissed = false;
    announceLoaded = false;
    fetchAnnouncements().then(renderAnnounceBell);
    openDayEditAnnounceModal();
  }

  const DAYEDIT_DISMISS_KEY = 'cbe-timetable:hideDayEditAnnounce';
  function isDayEditAnnounceDismissed(){
    try{ return localStorage.getItem(DAYEDIT_DISMISS_KEY) === '1'; }
    catch(e){ return false; }
  }
  function setDayEditAnnounceDismissed(){
    try{ localStorage.setItem(DAYEDIT_DISMISS_KEY, '1'); }catch(e){}
  }

  const dayEditAnnounceOverlay = document.getElementById('dayEditAnnounceOverlay');
  function openDayEditAnnounceModal(){
    if(isDayEditAnnounceDismissed() || !dayEditAnnounceOverlay){ openPyqAnnounceModal(); return; }
    dayEditAnnounceOverlay.style.display = 'flex';
  }
  function closeDayEditAnnounceModal(){
    setDayEditAnnounceDismissed();
    if(dayEditAnnounceOverlay) dayEditAnnounceOverlay.style.display = 'none';
    openPyqAnnounceModal();
  }
  const dayEditAnnounceGotItBtn = document.getElementById('dayEditAnnounceGotItBtn');
  if(dayEditAnnounceGotItBtn) dayEditAnnounceGotItBtn.addEventListener('click', closeDayEditAnnounceModal);
  if(dayEditAnnounceOverlay) dayEditAnnounceOverlay.addEventListener('click', (e)=>{ if(e.target === dayEditAnnounceOverlay) closeDayEditAnnounceModal(); });

  const PYQ_ANNOUNCE_DISMISS_KEY = 'cbe-timetable:hidePyqAnnounce';
  function isPyqAnnounceDismissed(){
    try{ return localStorage.getItem(PYQ_ANNOUNCE_DISMISS_KEY) === '1'; }
    catch(e){ return false; }
  }
  function setPyqAnnounceDismissed(){
    try{ localStorage.setItem(PYQ_ANNOUNCE_DISMISS_KEY, '1'); }catch(e){}
  }
  const pyqAnnounceOverlay = document.getElementById('pyqAnnounceOverlay');
  function openPyqAnnounceModal(){
    if(isPyqAnnounceDismissed() || !pyqAnnounceOverlay){ if(hssCode === null) openHssModal(); return; }
    pyqAnnounceOverlay.style.display = 'flex';
  }
  function closePyqAnnounceModal(){
    setPyqAnnounceDismissed();
    if(pyqAnnounceOverlay) pyqAnnounceOverlay.style.display = 'none';
    if(hssCode === null) openHssModal();
  }
  const pyqAnnounceGotItBtn = document.getElementById('pyqAnnounceGotItBtn');
  if(pyqAnnounceGotItBtn) pyqAnnounceGotItBtn.addEventListener('click', closePyqAnnounceModal);
  if(pyqAnnounceOverlay) pyqAnnounceOverlay.addEventListener('click', (e)=>{ if(e.target === pyqAnnounceOverlay) closePyqAnnounceModal(); });

  const aboutOverlay = document.getElementById('aboutModalOverlay');
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutCloseBtn = document.getElementById('aboutCloseBtn');
  function openAboutModal(){ if(aboutOverlay) aboutOverlay.style.display = 'flex'; }
  function closeAboutModal(){ if(aboutOverlay) aboutOverlay.style.display = 'none'; }
  if(aboutBtn) aboutBtn.addEventListener('click', openAboutModal);
  if(aboutCloseBtn) aboutCloseBtn.addEventListener('click', closeAboutModal);
  if(aboutOverlay) aboutOverlay.addEventListener('click', (e)=>{ if(e.target === aboutOverlay) closeAboutModal(); });

  const hssOverlay = document.getElementById('hssModalOverlay');
  const hssOptionsWrap = document.getElementById('hssOptions');
  const DAY_FULL = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  function updateHssButton(){
    const lbl = document.getElementById('hssBtnLabel');
    if(!lbl) return;
    lbl.textContent = hssCode ? hssCode : (hssCode === "" ? "skipped" : "not set");
  }

  function renderHssOptions(){
    hssOptionsWrap.innerHTML = HSS_ELECTIVES.map(h=>{
      const days = h.sessions.map(s=>DAY_FULL[s.day]+" ("+s.room+")").join(", ");
      const selected = hssCode === h.code;
      return `
      <div class="hss-option ${selected?'selected':''}" data-code="${h.code}">
        <div class="hop-top">
          <span class="hop-code">${h.code}</span>
          <span class="hop-slot">Slot ${h.slot} · 2–3 PM</span>
        </div>
        <div class="hop-meta">${days}</div>
      </div>`;
    }).join("");
    hssOptionsWrap.querySelectorAll('.hss-option').forEach(el=>{
      el.addEventListener('click', async ()=>{
        hssCode = el.dataset.code;
        rebuildPersonalSchedule();
        await persistHss();
        updateHssButton();
        closeHssModal();
        renderAll();
      });
    });
  }

  function openHssModal(){
    renderHssOptions();
    hssOverlay.style.display = 'flex';
  }
  function closeHssModal(){ hssOverlay.style.display = 'none'; }

  document.getElementById('hssBtn').addEventListener('click', openHssModal);
  document.getElementById('hssSkipBtn').addEventListener('click', async ()=>{
    if(hssCode === null) hssCode = ""; 
    await persistHss();
    updateHssButton();
    closeHssModal();
    renderAll();
  });
  hssOverlay.addEventListener('click', (e)=>{ if(e.target === hssOverlay) closeHssModal(); });

  const addClassOverlay = document.getElementById('addClassModalOverlay');
  let addClassTargetDate = null;

  function timeStrToMinutes(str){
    if(!str) return null;
    const parts = str.split(':');
    if(parts.length !== 2) return null;
    const h = Number(parts[0]), m = Number(parts[1]);
    if(isNaN(h) || isNaN(m)) return null;
    return h*60+m;
  }
  function minutesToTimeStr(mins){
    if(mins===null || mins===undefined || isNaN(mins)) return '';
    const h = Math.floor(mins/60), m = mins%60;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  }

  let addClassIsGlobal = false;
  let addClassRescheduleSig = null;

  function openAddClassModal(date, opts){
    opts = opts || {};
    addClassTargetDate = date;
    addClassIsGlobal = !!opts.global;
    addClassRescheduleSig = opts.reschedule ? opts.reschedule.sig : null;
    const { main } = fmtDayLabel(date);

    const titleEl = document.querySelector('#addClassModalOverlay .modal-title');
    if(titleEl) titleEl.textContent = opts.reschedule ? 'Reschedule this class' : (addClassIsGlobal ? 'Add a class for everyone' : 'Add a class for this day');
    document.getElementById('addClassDateLabel').textContent = addClassIsGlobal
      ? `For ${main} · this updates the SHARED timetable — every student will see this change.`
      : `For ${main} · only visible on your own timetable, the shared schedule doesn't change.`;

    const sel = document.getElementById('addClassCourseSelect');
    const codes = [...new Set(activeCourseCodes())];
    sel.innerHTML = codes.map(c=>`<option value="${c}">${c} — ${courseLabel(c)}</option>`).join('')
      + `<option value="__custom__">Other / custom…</option>`;

    if(opts.reschedule){
      const r = opts.reschedule;
      const knownCode = codes.includes(r.code);
      sel.value = knownCode ? r.code : '__custom__';
      document.getElementById('addClassCustomWrap').style.display = knownCode ? 'none' : 'block';
      document.getElementById('addClassCustomCode').value = knownCode ? '' : (r.code || '');
      document.getElementById('addClassCustomName').value = '';
      document.getElementById('addClassStart').value = minutesToTimeStr(r.start);
      document.getElementById('addClassEnd').value = minutesToTimeStr(r.end);
      document.getElementById('addClassRoom').value = r.room || '';
      document.getElementById('addClassType').value = r.type || 'lecture';
      document.getElementById('addClassNote').value = 'Rescheduled';
    } else {
      document.getElementById('addClassCustomWrap').style.display = 'none';
      document.getElementById('addClassCustomCode').value = '';
      document.getElementById('addClassCustomName').value = '';
      document.getElementById('addClassStart').value = '';
      document.getElementById('addClassEnd').value = '';
      document.getElementById('addClassRoom').value = '';
      document.getElementById('addClassType').value = 'lecture';
      document.getElementById('addClassNote').value = '';
    }
    document.getElementById('addClassError').classList.remove('show');
    const saveBtn = document.getElementById('addClassSaveBtn');
    if(saveBtn) saveBtn.textContent = opts.reschedule ? 'Save & update for everyone' : (addClassIsGlobal ? 'Add for everyone' : 'Add class');

    addClassOverlay.style.display = 'flex';
  }
  function closeAddClassModal(){ addClassOverlay.style.display = 'none'; }

  const addClassCourseSelect = document.getElementById('addClassCourseSelect');
  if(addClassCourseSelect){
    addClassCourseSelect.addEventListener('change', (e)=>{
      document.getElementById('addClassCustomWrap').style.display = e.target.value==='__custom__' ? 'block' : 'none';
    });
  }
  const addClassCancelBtn = document.getElementById('addClassCancelBtn');
  if(addClassCancelBtn) addClassCancelBtn.addEventListener('click', closeAddClassModal);
  if(addClassOverlay) addClassOverlay.addEventListener('click', (e)=>{ if(e.target === addClassOverlay) closeAddClassModal(); });

  const addClassSaveBtn = document.getElementById('addClassSaveBtn');
  if(addClassSaveBtn){
    addClassSaveBtn.addEventListener('click', ()=>{
      const sel = document.getElementById('addClassCourseSelect');
      const isCustom = sel.value === '__custom__';
      const customCode = document.getElementById('addClassCustomCode').value.trim().toUpperCase();
      const customName = document.getElementById('addClassCustomName').value.trim();
      const code = isCustom ? customCode : sel.value;
      const start = timeStrToMinutes(document.getElementById('addClassStart').value);
      const end = timeStrToMinutes(document.getElementById('addClassEnd').value);
      const room = document.getElementById('addClassRoom').value.trim();
      const type = document.getElementById('addClassType').value;
      const note = document.getElementById('addClassNote').value.trim();

      const errEl = document.getElementById('addClassError');
      let errMsg = '';
      if(!code) errMsg = 'Pick a course, or enter a custom code.';
      else if(start===null || end===null) errMsg = 'Please set a start and end time.';
      else if(end<=start) errMsg = 'End time must be after the start time.';
      else if(!room) errMsg = 'Please enter a room (or "Online").';
      if(errMsg){ errEl.textContent = errMsg; errEl.classList.add('show'); return; }

      const session = {
        id: 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        code, start, end, room, type
      };
      if(note) session.tag = note;
      if(isCustom && customName) session.name = customName;

      if(addClassIsGlobal){
        if(!timetableIsAdmin()){ closeAddClassModal(); return; }
        if(addClassRescheduleSig) cancelSessionForEveryone(addClassTargetDate, addClassRescheduleSig);
        addExtraSessionForEveryone(addClassTargetDate, session);
      } else {
        addExtraSessionForDate(addClassTargetDate, session);
      }
      closeAddClassModal();
      renderAll();
    });
  }


  const chatFab = document.getElementById('chatFab');
  const chatPanel = document.getElementById('chatPanel');
  const chatCloseBtn = document.getElementById('chatCloseBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  let chatHistory = [];
  let chatBusy = false;

  const CHAT_WELCOME_KEY = 'cbe-timetable:chatWelcomeShown';
  function hasSeenChatWelcome(){
    try{ return localStorage.getItem(CHAT_WELCOME_KEY) === '1'; }
    catch(e){ return false; }
  }
  function markChatWelcomeSeen(){
    try{ localStorage.setItem(CHAT_WELCOME_KEY, '1'); }catch(e){}
  }

  function openChatPanel(){
    if(!chatPanel) return;
    chatPanel.style.display = 'flex';
    if(chatFab) chatFab.style.display = 'none';
    if(chatInput) chatInput.focus();
    if(!hasSeenChatWelcome()){
      appendChatBubble('bot', "New here — I can answer quick questions about your schedule, attendance, or electives. Keep it short and I'll do the same.");
      markChatWelcomeSeen();
    }
  }
  function closeChatPanel(){
    if(!chatPanel) return;
    chatPanel.style.display = 'none';
    if(chatFab) chatFab.style.display = 'flex';
  }
  if(chatFab) chatFab.addEventListener('click', openChatPanel);
  if(chatCloseBtn) chatCloseBtn.addEventListener('click', closeChatPanel);

  function appendChatBubble(role, text){
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (role==='user' ? 'user' : 'bot');
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  async function sendChatMessage(){
    const text = chatInput.value.trim();
    if(!text || chatBusy) return;
    chatInput.value = '';
    appendChatBubble('user', text);
    chatHistory.push({ role:'user', content:text });
    chatBusy = true;
    chatSendBtn.disabled = true;

    const typingEl = appendChatBubble('bot', 'thinking…');
    typingEl.classList.add('typing');

    try{
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          context: {
            rollNumber: currentUser ? currentUser.roll : null
          }
        })
      });
      const data = await res.json().catch(()=>null);
      typingEl.classList.remove('typing');
      if(!res.ok || !data || !data.reply){
        typingEl.textContent = "Couldn't get a reply — try again in a bit.";
      } else {
        typingEl.textContent = data.reply;
        chatHistory.push({ role:'assistant', content:data.reply });
      }
    }catch(e){
      typingEl.classList.remove('typing');
      typingEl.textContent = "Network error — check your connection.";
    }

    chatBusy = false;
    chatSendBtn.disabled = false;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  if(chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
  if(chatInput){
    chatInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); sendChatMessage(); }
    });
  }

  function updateStorageBanner(){
    const banner = document.getElementById('storageBanner');
    if(!banner) return;
    if(Store.isCloud){ banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    banner.innerHTML = ` Saved to this browser only — clearing browser data or switching device/browser will lose it. <b>Back up from the Attendance tab.</b>`;
  }

  let lastSyncOk = null;   
  let lastSyncAt = null;

  function timeAgoShort(d){
    const s = Math.floor((Date.now() - d.getTime())/1000);
    if(s < 5) return 'just now';
    if(s < 60) return s+'s ago';
    const m = Math.floor(s/60);
    if(m < 60) return m+'m ago';
    const h = Math.floor(m/60);
    return h+'h ago';
  }

  function updateSyncBadge(){
    const badge = document.getElementById('syncBadge');
    if(!badge) return;
    if(!Store.isCloud){
      badge.textContent = ' Local only';
      badge.className = 'sync-badge local';
      return;
    }
    if(lastSyncOk === null){
      badge.textContent = ' Cloud enabled';
      badge.className = 'sync-badge cloud';
      return;
    }
    if(lastSyncOk){
      badge.textContent = '✓ Synced ' + timeAgoShort(lastSyncAt);
      badge.className = 'sync-badge cloud';
    } else {
      badge.textContent = ' Not synced — saved locally';
      badge.className = 'sync-badge local';
    }
  }

  function updateBackupCopy(){
    const el = document.querySelector('.backup-text');
    if(!el) return;
    el.textContent = Store.isCloud
      ? 'Your attendance syncs to the cloud automatically, so it follows you across devices. This export is just an extra personal copy.'
      : "This is saved to your browser only. Clearing browser data, going private/incognito, or opening the site on a different phone or laptop will not have it — download a backup regularly, it takes two seconds.";
  }

  async function updateBackupMeta(){
    const el = document.getElementById('backupMeta');
    if(!el) return;
    let last = null;
    try{
      const r = await Store.get('last-backup-at', true);
      if(r && r.value) last = r.value;
    }catch(e){ /* no backup taken yet — fine */ }
    if(last){
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      el.textContent = days<=0 ? 'Last backup: today' : `Last backup: ${days} day${days!==1?'s':''} ago`;
      el.className = 'backup-meta' + (days>=14 ? ' due' : '');
    } else {
      el.textContent = 'No backup yet — make one now, it only takes a second.';
      el.className = 'backup-meta due';
    }
  }

  function downloadJSON(filename, obj){
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportBackup(){
    if(!currentUser) return;
    const payload = {
      app: 'cbe-timetable-backup',
      version: 1,
      roll: currentUser.roll,
      name: currentUser.name,
      exportedAt: new Date().toISOString(),
      attendance,
      courseNames
    };
    downloadJSON(`cbe-attendance-${currentUser.roll}-${isoDate(new Date())}.json`, payload);
    try{ await Store.set('last-backup-at', new Date().toISOString(), true); }catch(e){}
    updateBackupMeta();
    flashSaveToast(true, 'Backup downloaded');
  }

  async function importBackupFile(file){
    let data;
    try{
      data = JSON.parse(await file.text());
    }catch(e){
      alert("That file doesn't look like a valid backup (couldn't read it as JSON).");
      return;
    }
    if(!data || typeof data.attendance !== 'object'){
      alert("That file doesn't look like a valid backup.");
      return;
    }
    if(data.roll && data.roll.toUpperCase() !== currentUser.roll){
      const proceed = confirm(`This backup was made for roll number ${data.roll}, but you're signed in as ${currentUser.roll}. Import into your account anyway?`);
      if(!proceed) return;
    }
    const proceed2 = confirm('This will merge the backup into your current attendance (the backup file wins if a session is marked differently in both). Continue?');
    if(!proceed2) return;
    attendance = Object.assign({}, attendance, data.attendance || {});
    if(data.courseNames) courseNames = Object.assign({}, courseNames, data.courseNames);
    await persistAttendance();
    await persistNames();
    renderAll();
    flashSaveToast(true, 'Backup restored');
  }

  document.getElementById('exportBtn').addEventListener('click', exportBackup);
  document.getElementById('importBtn').addEventListener('click', ()=>{
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(file) importBackupFile(file);
    e.target.value = '';
  });

  function attKey(){ return 'attendance:' + currentUser.roll; }

  const CODE_MIGRATION = { "CB2201":"CB2101", "CB2202":"CB2102", "CB2203":"CB2103", "CB2204":"CB2104", "CB2205":"CB2105" };

  function migrateOldCodes(){
    let changed = false;
    const migratedAttendance = {};
    Object.keys(attendance).forEach(key=>{
      const parts = key.split("|");
      if(parts.length === 3 && CODE_MIGRATION[parts[1]]){
        parts[1] = CODE_MIGRATION[parts[1]];
        changed = true;
      }
      migratedAttendance[parts.join("|")] = attendance[key];
    });
    if(changed) attendance = migratedAttendance;

    const migratedNames = {};
    Object.keys(courseNames).forEach(code=>{
      const newCode = CODE_MIGRATION[code] || code;
      if(newCode !== code) changed = true;
      if(!(newCode in migratedNames)) migratedNames[newCode] = courseNames[code];
    });
    courseNames = migratedNames;

    return changed;
  }

  function hssKey(){ return 'hss:' + currentUser.roll; }
  function dayOverridesKey(){ return 'dayoverrides:' + currentUser.roll; }

  async function loadUserData(){
    attendance = {};
    courseNames = {};
    hssCode = null;
    dayOverrides = {};
    try{
      const a = await Store.get(attKey(), true);
      if(a && a.value) attendance = JSON.parse(a.value);
    }catch(e){ /* no records yet for this student — fine */ }
    try{
      const n = await Store.get('course-names', true);
      if(n && n.value) courseNames = JSON.parse(n.value);
    }catch(e){ /* no custom names yet — fine */ }
    try{
      const h = await Store.get(hssKey(), true);
      if(h && typeof h.value === 'string') hssCode = h.value; 
    }catch(e){ /* never chosen yet — fine, stays null */ }
    try{
      const o = await Store.get(dayOverridesKey(), true);
      if(o && o.value) dayOverrides = JSON.parse(o.value);
    }catch(e){ /* no personal day edits yet — fine */ }
    try{
      const g = await Store.get('global-overrides', true);
      if(g && g.value) globalOverrides = JSON.parse(g.value);
    }catch(e){ /* no admin reschedules yet — fine */ }
    rebuildPersonalSchedule();
    if(migrateOldCodes()){
      await persistAttendance();
      await persistNames();
    }
  }

  async function persistHss(){
    if(!currentUser) return;
    try{
      const res = await Store.set(hssKey(), hssCode || "", true);
      if(res && res.synced === false) flashSaveToast(true, 'Saved locally — will sync when online');
      else flashSaveToast(true, 'HSS elective saved');
    }catch(e){ console.warn('hss save failed', e); flashSaveToast(false); }
  }

  let announcements = [];
  let announceReactions = {};
  let announceLoaded = false;
  let announceRevealId = null;

  function announceCutoffISO(){
    return new Date(Date.now() - ANNOUNCE_TTL_HOURS*3600*1000).toISOString();
  }
  function announceTimeLeft(createdAt){
    const expires = new Date(createdAt).getTime() + ANNOUNCE_TTL_HOURS*3600*1000;
    const msLeft = expires - Date.now();
    if(msLeft <= 0) return 'expiring…';
    const hrs = Math.floor(msLeft/3600000);
    const mins = Math.floor((msLeft%3600000)/60000);
    return hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
  }
  function announceReactionCounts(id){
    const rows = announceReactions[id] || [];
    return { likes: rows.filter(r=>r.reaction==='like'), dislikes: rows.filter(r=>r.reaction==='dislike') };
  }
  function announceMyReaction(id){
    if(!currentUser) return null;
    const rows = announceReactions[id] || [];
    const mine = rows.find(r=>r.roll === currentUser.roll);
    return mine ? mine.reaction : null;
  }

  async function fetchAnnouncements(){
    try{
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_announcements?select=*&created_at=gte.${encodeURIComponent(announceCutoffISO())}&order=created_at.desc`, { headers: announceHeaders() });
      if(!res.ok) throw new Error('fetch failed: ' + res.status);
      announcements = await res.json();
      const ids = announcements.map(a=>a.id);
      if(ids.length){
        const res2 = await fetch(`${SUPABASE_URL}/rest/v1/cbe_announcement_reactions?select=*&announcement_id=in.(${ids.join(',')})`, { headers: announceHeaders() });
        const rows = res2.ok ? await res2.json() : [];
        const grouped = {};
        rows.forEach(r=>{ (grouped[r.announcement_id] = grouped[r.announcement_id] || []).push(r); });
        announceReactions = grouped;
      } else {
        announceReactions = {};
      }
    }catch(e){
      console.warn('announcements fetch failed', e);
    }
    announceLoaded = true;
  }

  function renderAnnounceBell(){
    const dot = document.getElementById('announceBellDot');
    if(dot) dot.style.display = announcements.length ? 'block' : 'none';
    const banner = document.getElementById('announceBanner');
    const bannerText = document.getElementById('announceBannerText');
    if(banner && bannerText){
      if(announcements.length && !announceBannerDismissed){
        bannerText.textContent = announcements[0].message;
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }
  }

  let announceBannerDismissed = false;

  async function renderAnnouncePanel(){
    const wrap = document.getElementById('announceList');
    if(!wrap) return;
    if(!announceLoaded) await fetchAnnouncements();
    renderAnnounceBell();

    const isAdmin = announceIsAdmin();
    const composer = document.getElementById('announceComposerWrap');
    if(composer) composer.style.display = isAdmin ? 'block' : 'none';

    wrap.innerHTML = announcements.length ? announcements.map(a=>{
      const { likes, dislikes } = announceReactionCounts(a.id);
      const mine = announceMyReaction(a.id);
      const showWho = isAdmin && announceRevealId === a.id;
      const whoBlock = showWho ? `
        <div class="announce-who">
          ${likes.length ? `<div><b>👍 ${likes.length}</b>${likes.map(r=>escapeHtml(STUDENT_MAP[r.roll]||r.roll)).join(', ')}</div>` : ''}
          ${dislikes.length ? `<div><b>👎 ${dislikes.length}</b>${dislikes.map(r=>escapeHtml(STUDENT_MAP[r.roll]||r.roll)).join(', ')}</div>` : ''}
          ${(!likes.length && !dislikes.length) ? `<div class="announce-who-empty">No reactions yet</div>` : ''}
        </div>` : '';
      return `
      <div class="announce-item">
        <div class="announce-item-top">
          <span class="announce-time">${announceTimeLeft(a.created_at)}</span>
          ${isAdmin ? `<button class="announce-del" data-del-id="${a.id}" title="Delete">🗑</button>` : ''}
        </div>
        <div class="announce-msg">${escapeHtml(a.message)}</div>
        <div class="announce-actions">
          <button class="announce-react like ${mine==='like'?'active':''}" data-react-id="${a.id}" data-react-type="like">👍 <span>${likes.length}</span></button>
          <button class="announce-react dislike ${mine==='dislike'?'active':''}" data-react-id="${a.id}" data-react-type="dislike">👎 <span>${dislikes.length}</span></button>
          ${isAdmin ? `<button class="announce-who-toggle" data-who-id="${a.id}">${showWho?'Hide':'Who reacted?'}</button>` : ''}
        </div>
        ${whoBlock}
      </div>`;
    }).join('') : `<div class="announce-empty">No active announcements right now.</div>`;

    wrap.querySelectorAll('[data-react-id]').forEach(btn=>{
      btn.addEventListener('click', ()=> toggleAnnounceReaction(btn.dataset.reactId, btn.dataset.reactType));
    });
    wrap.querySelectorAll('[data-del-id]').forEach(btn=>{
      btn.addEventListener('click', ()=> deleteAnnouncement(btn.dataset.delId));
    });
    wrap.querySelectorAll('[data-who-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        announceRevealId = announceRevealId === btn.dataset.whoId ? null : btn.dataset.whoId;
        renderAnnouncePanel();
      });
    });
  }

  async function toggleAnnounceReaction(id, type){
    if(!currentUser) return;
    const rows = announceReactions[id] || [];
    const existing = rows.find(r=>r.roll === currentUser.roll);
    try{
      if(existing && existing.reaction === type){
        await fetch(`${SUPABASE_URL}/rest/v1/cbe_announcement_reactions?announcement_id=eq.${id}&roll=eq.${encodeURIComponent(currentUser.roll)}`, {
          method:'DELETE', headers: announceHeaders()
        });
      } else if(existing){
        await fetch(`${SUPABASE_URL}/rest/v1/cbe_announcement_reactions?announcement_id=eq.${id}&roll=eq.${encodeURIComponent(currentUser.roll)}`, {
          method:'PATCH', headers: announceHeaders(), body: JSON.stringify({ reaction: type })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/cbe_announcement_reactions`, {
          method:'POST', headers: Object.assign(announceHeaders(), { Prefer:'resolution=merge-duplicates' }),
          body: JSON.stringify([{ announcement_id: id, roll: currentUser.roll, reaction: type }])
        });
      }
      announceLoaded = false;
      await renderAnnouncePanel();
    }catch(e){
      console.warn('reaction failed', e);
      flashSaveToast(false, 'Could not save reaction');
    }
  }

  async function deleteAnnouncement(id){
    if(!announceIsAdmin()) return;
    if(!confirm('Delete this announcement for everyone?')) return;
    try{
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_announcements?id=eq.${id}`, { method:'DELETE', headers: announceHeaders() });
      if(!res.ok) throw new Error('delete failed: ' + res.status);
      announceLoaded = false;
      await renderAnnouncePanel();
      flashSaveToast(true, 'Announcement removed');
    }catch(e){
      console.warn('announcement delete failed', e);
      flashSaveToast(false, 'Delete failed');
    }
  }

  async function postAnnouncement(){
    if(!announceIsAdmin()) return;
    const input = document.getElementById('announceComposerInput');
    if(!input) return;
    const msg = input.value.trim();
    if(!msg) return;
    const btn = document.getElementById('announceComposerBtn');
    if(btn) btn.disabled = true;
    try{
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_announcements`, {
        method:'POST', headers: announceHeaders(),
        body: JSON.stringify([{ message: msg, created_by: currentUser.roll }])
      });
      if(!res.ok) throw new Error('post failed: ' + res.status);
      input.value = '';
      announceLoaded = false;
      announceBannerDismissed = false;
      await renderAnnouncePanel();
      flashSaveToast(true, 'Announcement posted');
    }catch(e){
      console.warn('announcement post failed', e);
      flashSaveToast(false, 'Post failed');
    }finally{
      if(btn) btn.disabled = false;
    }
  }

  const announceBellBtn = document.getElementById('announceBellBtn');
  const announceOverlay = document.getElementById('announceModalOverlay');
  const announceCloseBtn = document.getElementById('announceCloseBtn');
  const announceComposerBtn = document.getElementById('announceComposerBtn');
  const announceBanner = document.getElementById('announceBanner');
  const announceBannerClose = document.getElementById('announceBannerClose');

  function openAnnouncePanel(){
    if(!announceOverlay) return;
    announceOverlay.style.display = 'flex';
    announceLoaded = false;
    renderAnnouncePanel();
  }
  function closeAnnouncePanel(){
    if(announceOverlay) announceOverlay.style.display = 'none';
    announceRevealId = null;
  }
  if(announceBellBtn) announceBellBtn.addEventListener('click', openAnnouncePanel);
  if(announceCloseBtn) announceCloseBtn.addEventListener('click', closeAnnouncePanel);
  if(announceOverlay) announceOverlay.addEventListener('click', (e)=>{ if(e.target === announceOverlay) closeAnnouncePanel(); });
  if(announceComposerBtn) announceComposerBtn.addEventListener('click', postAnnouncement);
  if(announceBanner) announceBanner.addEventListener('click', (e)=>{
    if(e.target === announceBannerClose) return;
    openAnnouncePanel();
  });
  if(announceBannerClose) announceBannerClose.addEventListener('click', (e)=>{
    e.stopPropagation();
    announceBannerDismissed = true;
    renderAnnounceBell();
  });

  let saveToastTimer = null;
  function flashSaveToast(ok, msg){
    const t = document.getElementById('saveToast');
    t.textContent = msg || (ok ? 'Saved' : 'Save failed — check connection');
    t.classList.toggle('err', !ok);
    t.classList.add('show');
    clearTimeout(saveToastTimer);
    saveToastTimer = setTimeout(()=> t.classList.remove('show'), 1400);
  }

  async function persistAttendance(){
    if(!currentUser){ flashSaveToast(false, 'Not saved — no user'); return; }
    try{
      const res = await Store.set(attKey(), JSON.stringify(attendance), true);
      if(!res){ flashSaveToast(false, 'Save failed — storage unavailable'); lastSyncOk = false; lastSyncAt = new Date(); }
      else if(res.synced === false){ flashSaveToast(true, 'Saved locally — will sync when online'); lastSyncOk = false; lastSyncAt = new Date(); }
      else{ flashSaveToast(true); lastSyncOk = true; lastSyncAt = new Date(); }
      updateSyncBadge();
    }
    catch(e){ console.warn("save failed", e); flashSaveToast(false); lastSyncOk = false; lastSyncAt = new Date(); updateSyncBadge(); }
  }
  async function persistNames(){
    try{
      const res = await Store.set('course-names', JSON.stringify(courseNames), true);
      if(!res){ flashSaveToast(false, 'Save failed — storage unavailable'); lastSyncOk = false; lastSyncAt = new Date(); }
      else if(res.synced === false){ flashSaveToast(true, 'Saved locally — will sync when online'); lastSyncOk = false; lastSyncAt = new Date(); }
      else{ lastSyncOk = true; lastSyncAt = new Date(); }
      updateSyncBadge();
    }
    catch(e){ console.warn("save failed", e); lastSyncOk = false; lastSyncAt = new Date(); updateSyncBadge(); }
  }

  async function persistDayOverrides(){
    if(!currentUser){ flashSaveToast(false, 'Not saved — no user'); return; }
    try{
      const res = await Store.set(dayOverridesKey(), JSON.stringify(dayOverrides), true);
      if(!res){ flashSaveToast(false, 'Save failed — storage unavailable'); }
      else if(res.synced === false){ flashSaveToast(true, 'Saved locally — will sync when online'); }
      else{ flashSaveToast(true, 'Day updated'); }
    }catch(e){ console.warn('day override save failed', e); flashSaveToast(false); }
  }

  async function persistGlobalOverrides(){
    if(!timetableIsAdmin()){ flashSaveToast(false, 'Not saved — admin only'); return; }
    try{
      const res = await Store.set('global-overrides', JSON.stringify(globalOverrides), true);
      if(!res){ flashSaveToast(false, 'Save failed — storage unavailable'); }
      else if(res.synced === false){ flashSaveToast(true, 'Saved locally — will sync when online'); }
      else{ flashSaveToast(true, 'Timetable updated for everyone'); }
    }catch(e){ console.warn('global override save failed', e); flashSaveToast(false); }
  }

  function courseLabel(code){ return COURSE_NAMES[code] || courseNames[code] || code; }
  function tileCode(code){ return code.replace(/^CB|^HS/, ''); }

  function nameSpan(codeOrSession, cls){
    const isObj = codeOrSession && typeof codeOrSession === 'object';
    const code = isObj ? codeOrSession.code : codeOrSession;
    const label = (isObj && codeOrSession.name) ? codeOrSession.name : courseLabel(code);
    return `<span class="${cls}">${label}</span>`;
  }

  function pad(n){ return n<10 ? "0"+n : ""+n; }
  function isoDate(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function startOfDay(d){ const r=new Date(d); r.setHours(0,0,0,0); return r; }
  function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
  function fmtHM(mins){
    let h=Math.floor(mins/60), m=mins%60;
    const ap = h>=12 ? "PM":"AM";
    let h12 = h%12; if(h12===0) h12=12;
    return h12+":"+pad(m)+" "+ap;
  }
  // Rounds a session's raw duration so a near-hour slot (e.g. 55 min) reads as a clean hour.
  function roundedSessionMinutes(s){
    const mins = Math.max(0, (s.end||0) - (s.start||0));
    const hours = Math.floor(mins/60);
    const rem = mins % 60;
    return rem >= 55 ? (hours+1)*60 : hours*60 + rem;
  }
  function fmtDuration(mins){
    const h = Math.floor(mins/60), m = mins % 60;
    if(h>0 && m>0) return `${h}h ${m}m`;
    if(h>0) return `${h} hr${h>1?'s':''}`;
    return `${m} min`;
  }
  function fmtDayLabel(d){
    const today = new Date();
    const sameDay = isoDate(d)===isoDate(today);
    const isYesterday = isoDate(d)===isoDate(addDays(today,-1));
    const isTomorrow = isoDate(d)===isoDate(addDays(today,1));
    let rel = sameDay?"Today":isYesterday?"Yesterday":isTomorrow?"Tomorrow":DAY_NAMES[d.getDay()];
    return { main: d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'}), rel };
  }

  let now = new Date();

  function scheduleForDay(dow){ return PERSONAL_SCHEDULE.filter(s=>s.day===dow); }

  function sessionSig(s){ return s.code+"|"+s.start+"|"+s.room; }

  function ensureDayOverride(iso){
    if(!dayOverrides[iso]) dayOverrides[iso] = { removed:[], extra:[] };
    if(!dayOverrides[iso].removed) dayOverrides[iso].removed = [];
    if(!dayOverrides[iso].extra) dayOverrides[iso].extra = [];
    return dayOverrides[iso];
  }
  function cleanupDayOverride(iso){
    const ov = dayOverrides[iso];
    if(ov && (!ov.removed || !ov.removed.length) && (!ov.extra || !ov.extra.length)) delete dayOverrides[iso];
  }

  // ===== Global (admin) day overrides — apply to EVERYONE's timetable =====
  function ensureGlobalOverride(iso){
    if(!globalOverrides[iso]) globalOverrides[iso] = { removed:[], extra:[] };
    if(!globalOverrides[iso].removed) globalOverrides[iso].removed = [];
    if(!globalOverrides[iso].extra) globalOverrides[iso].extra = [];
    return globalOverrides[iso];
  }
  function cleanupGlobalOverride(iso){
    const ov = globalOverrides[iso];
    if(ov && (!ov.removed || !ov.removed.length) && (!ov.extra || !ov.extra.length)) delete globalOverrides[iso];
  }

  function scheduleForDate(date){
    const dow = date.getDay();
    const iso = isoDate(date);
    const base = scheduleForDay(dow);
    const gov = globalOverrides[iso];
    const ov = dayOverrides[iso];
    let list = base;
    if(gov && gov.removed && gov.removed.length){
      const removedSet = new Set(gov.removed);
      list = list.filter(s => !removedSet.has(sessionSig(s)));
    }
    if(ov && ov.removed && ov.removed.length){
      const removedSet = new Set(ov.removed);
      list = list.filter(s => !removedSet.has(sessionSig(s)));
    }
    if(gov && gov.extra && gov.extra.length){
      list = list.concat(gov.extra.map(e => Object.assign({}, e, { day: dow, isGlobalExtra: true })));
    }
    if(ov && ov.extra && ov.extra.length){
      list = list.concat(ov.extra.map(e => Object.assign({}, e, { day: dow, isExtra: true })));
    }
    if(currentUser){
      const grp = fluidLabGroupOf(currentUser.roll);
      const labSession = fluidLabSessionForDate(date, grp);
      if(labSession) list = list.concat([labSession]);
    }
    return list.slice().sort((a,b)=> a.start-b.start);
  }

  // Returns base-schedule sessions removed for this date, tagged with who removed them
  // (admin, for everyone — `_global:true` — and/or the current user personally — `_personal:true`).
  function removedBaseSessionsForDate(date){
    const dow = date.getDay();
    const iso = isoDate(date);
    const gov = globalOverrides[iso];
    const ov = dayOverrides[iso];
    const gSet = new Set((gov && gov.removed) || []);
    const pSet = new Set((ov && ov.removed) || []);
    if(!gSet.size && !pSet.size) return [];
    return scheduleForDay(dow)
      .filter(s => gSet.has(sessionSig(s)) || pSet.has(sessionSig(s)))
      .map(s => Object.assign({}, s, { _global: gSet.has(sessionSig(s)), _personal: pSet.has(sessionSig(s)) }));
  }

  function removeSessionForDateBySig(date, sig){
    const ov = ensureDayOverride(isoDate(date));
    if(!ov.removed.includes(sig)) ov.removed.push(sig);
    persistDayOverrides();
  }
  function restoreSessionForDate(date, sig){
    const iso = isoDate(date);
    const ov = dayOverrides[iso];
    if(!ov) return;
    ov.removed = (ov.removed||[]).filter(x=>x!==sig);
    cleanupDayOverride(iso);
    persistDayOverrides();
  }
  function addExtraSessionForDate(date, session){
    const ov = ensureDayOverride(isoDate(date));
    ov.extra.push(session);
    persistDayOverrides();
  }
  function deleteExtraSessionForDate(date, id){
    const iso = isoDate(date);
    const ov = dayOverrides[iso];
    if(!ov) return;
    ov.extra = (ov.extra||[]).filter(e=>e.id!==id);
    cleanupDayOverride(iso);
    persistDayOverrides();
  }

  // Admin-only: cancel/restore/add/delete classes on the SHARED timetable (affects every student).
  function cancelSessionForEveryone(date, sig){
    if(!timetableIsAdmin()) return;
    const ov = ensureGlobalOverride(isoDate(date));
    if(!ov.removed.includes(sig)) ov.removed.push(sig);
    persistGlobalOverrides();
  }
  function restoreSessionForEveryone(date, sig){
    if(!timetableIsAdmin()) return;
    const iso = isoDate(date);
    const ov = globalOverrides[iso];
    if(!ov) return;
    ov.removed = (ov.removed||[]).filter(x=>x!==sig);
    cleanupGlobalOverride(iso);
    persistGlobalOverrides();
  }
  function addExtraSessionForEveryone(date, session){
    if(!timetableIsAdmin()) return;
    const ov = ensureGlobalOverride(isoDate(date));
    ov.extra.push(session);
    persistGlobalOverrides();
  }
  function deleteExtraSessionForEveryone(date, id){
    if(!timetableIsAdmin()) return;
    const iso = isoDate(date);
    const ov = globalOverrides[iso];
    if(!ov) return;
    ov.extra = (ov.extra||[]).filter(e=>e.id!==id);
    cleanupGlobalOverride(iso);
    persistGlobalOverrides();
  }

  function findNext(){
    const nowMin = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
    const todays = scheduleForDate(now);
    for(const s of todays){
      if(nowMin >= s.start && nowMin < s.end){
        return { s, offsetDays:0, status:"ongoing" };
      }
    }
    let upcoming = todays.filter(s=>s.start > nowMin).sort((a,b)=>a.start-b.start)[0];
    if(upcoming) return { s:upcoming, offsetDays:0, status:"upcoming" };
    for(let off=1; off<=7; off++){
      const list = scheduleForDate(addDays(now, off)).sort((a,b)=>a.start-b.start);
      if(list.length) return { s:list[0], offsetDays:off, status:"upcoming" };
    }
    return null;
  }

  function countdownParts(targetMs){
    let diff = Math.max(0, targetMs - now.getTime());
    const h = Math.floor(diff/3600000);
    const m = Math.floor((diff%3600000)/60000);
    const s = Math.floor((diff%60000)/1000);
    return {h,m,s};
  }

  function renderHero(){
    const heroContent = document.getElementById('heroContent');
    const burette = document.getElementById('burette');
    const next = findNext();
    if(!next){
      heroContent.innerHTML = `<div class="hero-empty">No 2nd-year classes on the books. Enjoy the Day.</div>`;
      burette.style.display="none";
      return;
    }
    const { s, offsetDays, status } = next;
    const dayLabel = offsetDays===0 ? "Today" : offsetDays===1 ? "Tomorrow" : DAY_NAMES[(now.getDay()+offsetDays)%7];

    let targetDate;
    if(status==="ongoing"){
      targetDate = new Date(startOfDay(now).getTime() + s.end*60000);
    } else {
      targetDate = new Date(addDays(startOfDay(now), offsetDays).getTime() + s.start*60000);
    }
    const {h,m,s:sec} = countdownParts(targetDate.getTime());
    const cd = (h>0? pad(h)+":":"") + pad(m)+":"+pad(sec);

    heroContent.innerHTML = `
      <div class="hero-main">
        <div class="hero-tile ${s.type}">
          <div class="code">${tileCode(s.code)}</div>
          <div class="kind">${s.tag || s.type}</div>
        </div>
        <div class="hero-info">
          <div class="hero-title"><span class="hero-code">${s.code}</span>${nameSpan(s,'hero-name')}</div>
          <div class="hero-meta">${dayLabel} · ${fmtHM(s.start)}–${fmtHM(s.end)} · <b>${s.room}</b></div>
        </div>
        <div class="hero-countdown ${status==='ongoing'?'ongoing':''}">
          <span class="lbl">${status==='ongoing' ? 'ends in' : 'starts in'}</span>
          ${cd}
        </div>
      </div>
    `;

    if(offsetDays===0){
      burette.style.display="block";
      const dayStart=8*60, dayEnd=19*60;
      const nowMin = now.getHours()*60+now.getMinutes();
      let pct = ((nowMin-dayStart)/(dayEnd-dayStart))*100;
      pct = Math.max(0, Math.min(100,pct));
      document.getElementById('buretteFill').style.width = pct+"%";
      const marksWrap = document.getElementById('buretteMarks');
      marksWrap.innerHTML = scheduleForDate(now).map(cls=>{
        const p = ((cls.start-dayStart)/(dayEnd-dayStart))*100;
        return `<div class="burette-mark" style="left:${p}%"></div>`;
      }).join("");
    } else {
      burette.style.display="none";
    }
  }
  let selectedDow = null;

  function buildDayRow(){
    const wrap = document.getElementById('dayRow');
    wrap.innerHTML = "";
    for(let d=1; d<=5; d++){
      const dateForDay = d===now.getDay() ? now : dateForWeekday(d);
      const count = scheduleForDate(dateForDay).length;
      const chip=document.createElement('div');
      chip.className='day-chip'+(d===now.getDay()?' today':'')+(d===selectedDow?' selected':'');
      chip.innerHTML = `${DAY_SHORT[d]}<span class="n">${count||'—'}</span>`;
      chip.onclick=()=>{ selectedDow=d; buildDayRow(); renderNowTimeline(); };
      wrap.appendChild(chip);
    }
  }

  function markKeyFor(dateIso, s){ return dateIso+"|"+s.code+"|"+s.start; }

  function sessionHasStarted(d, s){
    const dayStart = startOfDay(d).getTime();
    const todayStart = startOfDay(now).getTime();
    if(dayStart > todayStart) return false;               
    if(dayStart < todayStart) return true;                
    return (now.getHours()*60 + now.getMinutes()) >= s.start; 
  }

  function canMarkFromNowTab(d, s){
    const isToday = startOfDay(d).getTime() === startOfDay(now).getTime();
    return isToday && sessionHasStarted(d, s);
  }

  function canMarkFromAttendanceTab(d, s){
    return sessionHasStarted(d, s);
  }

  function dateForWeekday(dow){
    const diff = dow - now.getDay();
    return addDays(now, diff);
  }

  function renderNowTimeline(){
    const wrap = document.getElementById('nowTimelineWrap');
    const dow = selectedDow===null ? now.getDay() : selectedDow;
    const isToday = dow===now.getDay();
    const dateForDow = isToday ? now : dateForWeekday(dow);
    const list = scheduleForDate(dateForDow);

    if(list.length===0){
      wrap.innerHTML = (dow===0||dow===6)
        ? `<div class="empty-state"><div class="glyph"></div> offline for the weekend.<br>No 2nd-year CBE sessions scheduled.</div>`
        : `<div class="empty-state"><div class="glyph"></div>Clear bench day — no 2nd-year classes.<br>Good day to catch up on notes.</div>`;
      return;
    }

    const dateIso = isoDate(dateForDow);
    const nowMin = now.getHours()*60+now.getMinutes();
    const dayIsOver = !isToday && startOfDay(dateForDow).getTime() < startOfDay(now).getTime();

    const cards = list.map(s=>{
      const isOngoing = isToday && nowMin>=s.start && nowMin<s.end;
      const isDone = isToday && nowMin>=s.end;
      const key = markKeyFor(dateIso, s);
      const status = attendance[key];

      const canMark = canMarkFromNowTab(dateForDow, s);

      let statusLine = "";
      if(isOngoing) statusLine = `<div class="cc-status live">● in progress</div>`;
      else if(isDone) statusLine = `<div class="cc-status">finished</div>`;
      else if(dayIsOver) statusLine = `<div class="cc-status">Locked · can still edit in Attendance tab</div>`;
      else statusLine = `<div class="cc-status">upcoming</div>`;

      return `
      <div class="class-card ${isOngoing?'now':''} ${isDone && !isOngoing?'done':''}">
        <div class="tile ${s.type}"><div class="num">${fmtHM(s.start).split(' ')[0]}</div><div class="code">${tileCode(s.code)}</div></div>
        <div class="cc-body">
          <div class="cc-top">
            <span class="cc-code">${s.code}</span>
            ${nameSpan(s,'cc-name')}
            <span class="cc-tag ${s.type}">${s.tag || s.type}</span>
            ${s.isExtra ? '<span class="cc-tag added">added</span>' : ''}
          </div>
          <div class="cc-meta">${fmtHM(s.start)}–${fmtHM(s.end)} · ${s.room}</div>
          ${statusLine}
        </div>
        <div class="mark-group">
          <button class="mark-btn p ${status==='p'?'active':''}" ${canMark?'':'disabled'} data-key="${key}" data-val="p" title="Present">✓</button>
          <button class="mark-btn a ${status==='a'?'active':''}" ${canMark?'':'disabled'} data-key="${key}" data-val="a" title="Absent">✕</button>
          <button class="mark-btn c ${status==='c'?'active':''}" ${canMark?'':'disabled'} data-key="${key}" data-val="c" title="Cancelled">⊘</button>
        </div>
      </div>`;
    }).join("");

    wrap.innerHTML = `
      <div class="section-label">${isToday?"Today":DAY_NAMES[dow]}'s sessions</div>
      <div class="cards">${cards}</div>
    `;

    wrap.querySelectorAll('.mark-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.disabled) return;
        const key = btn.dataset.key, val = btn.dataset.val;
        if(attendance[key]===val) delete attendance[key];
        else attendance[key] = val;
        persistAttendance();
        renderNowTimeline();
        renderAttendanceView();
      });
    });
  }

  function renderWeek(){
    const wrap = document.getElementById('weekGrid');
    let html = "";
    for(let d=1; d<=5; d++){
      const dateForDay = d===now.getDay() ? now : dateForWeekday(d);
      const list = scheduleForDate(dateForDay);
      const totalMins = list.reduce((sum,s)=> sum + roundedSessionMinutes(s), 0);
      html += `<div class="week-day">
        <div class="week-day-head"><h3>${DAY_NAMES[d]}</h3><span class="count">${list.length} session${list.length!==1?'s':''}${list.length ? ' · '+fmtDuration(totalMins) : ''}</span></div>
        <div class="week-list">
          ${list.length ? list.map(s=>`
            <div class="week-item">
              <span class="t">${fmtHM(s.start)}</span>
              <span class="mid">
                <span class="dot ${s.type}"></span>
                <span class="nm-wrap"><span class="nm-code">${s.code}</span>${nameSpan(s,'nm')}<span class="nm-dur">${fmtDuration(roundedSessionMinutes(s))}</span></span>
              </span>
              <span class="rm">${s.room}${s.isExtra ? ' · added' : ''}</span>
            </div>`).join("") : `<div style="color:var(--text-faint); font-size:12.5px;">— no sessions —</div>`}
        </div>
      </div>`;
    }
    wrap.innerHTML = html;
  }

  let attSelectedDate = new Date();

  function computeStats(){
    const stats = {};
    const activeKeys = new Set(statGroupsForActiveCourses().map(g=> g.key));
    activeKeys.forEach(k=> stats[k] = {present:0, total:0});
    let totalPresent=0, totalMarked=0;

    const start = startOfDay(SEMESTER_START);
    const end = startOfDay(now);
    if(start.getTime() <= end.getTime()){
      for(let d=new Date(start); d.getTime()<=end.getTime(); d=addDays(d,1)){
        const iso = isoDate(d);
        scheduleForDate(d).forEach(s=>{
          if(!sessionHasStarted(d, s)) return; 
          const key = markKeyFor(iso, s);
          const val = attendance[key] || 'a'; 
          if(val==='c') return;
          const statKey = statKeyForSession(s.code, s.type);
          // Only fold this session into the overall total/present count if it
          // belongs to one of the course cards actually shown below — a
          // session under a course that isn't currently active (e.g. a
          // dropped/switched elective) would otherwise inflate "sessions
          // held" without ever appearing on any card, making the header
          // number impossible to reconcile against the cards.
          if(!activeKeys.has(statKey)) return;
          stats[statKey].total++;
          totalMarked++;
          if(val==='p'){ stats[statKey].present++; totalPresent++; }
        });
      }
    }
    return { stats, totalPresent, totalMarked };
  }

  const ATT_THRESHOLD = 75;

  function attendanceProjection(present, total){
    if(!total) return null;
    const T = ATT_THRESHOLD/100;
    const pct = present/total;
    if(pct >= T){
      const canSkip = Math.floor(present/T - total);
      return canSkip>0
        ? { type:'safe', text:`can skip next ${canSkip} and stay ≥${ATT_THRESHOLD}%` }
        : { type:'tight', text:`no room left — next miss drops you below ${ATT_THRESHOLD}%` };
    }
    const need = Math.max(1, Math.ceil((T*total - present)/(1-T)));
    return { type:'risk', text:`attend next ${need} straight to reach ${ATT_THRESHOLD}%` };
  }

  function projColor(type){
    return type==='safe' ? 'var(--green)' : type==='tight' ? 'var(--amber)' : 'var(--rose)';
  }

  function gaugeSVG(pct, color){
    const r=20, c=2*Math.PI*r;
    const off = c*(1-pct/100);
    return `<svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="5"/>
      <circle cx="26" cy="26" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
    </svg>`;
  }

  function renderAttendanceView(){
    const { stats, totalPresent, totalMarked } = computeStats();
    const overallPct = totalMarked ? Math.round(totalPresent/totalMarked*100) : 0;
    const overallColor = overallPct>=75 ? 'var(--green)' : overallPct>=60 ? 'var(--amber)' : 'var(--rose)';

    const overallProj = attendanceProjection(totalPresent, totalMarked);
    document.getElementById('overallBar').innerHTML = `
      <div class="overall-top">
        <div>Overall attendance</div>
        <div class="big" style="color:${overallColor}">${totalMarked? overallPct+'%' : '—'}</div>
      </div>
      <div class="overall-track"><div class="overall-fill" style="width:${overallPct}%; background:${overallColor}"></div></div>
      <div style="font-size:11.5px; color:var(--text-faint); font-family:var(--mono); margin-top:8px;">
        ${totalMarked ? totalPresent+' present of '+totalMarked+' sessions held so far' : 'No sessions held yet — check back once class starts.'}
      </div>
      ${overallProj ? `<div class="overall-proj" style="color:${projColor(overallProj.type)}">${overallProj.text}</div>` : ''}
    `;

    const statGrid = document.getElementById('statGrid');
    statGrid.innerHTML = statGroupsForActiveCourses().map(g=>{
      const st = stats[g.key] || {present:0,total:0};
      const pct = st.total ? Math.round(st.present/st.total*100) : null;
      const color = pct===null ? 'var(--text-faint)' : pct>=75 ? 'var(--green)' : pct>=60 ? 'var(--amber)' : 'var(--rose)';
      const warn = pct!==null && pct<75;
      const proj = attendanceProjection(st.present, st.total);
      const nameHtml = g.label
        ? `<span class="stat-name">${courseLabel(g.code)} <span class="stat-split-tag">${g.label}</span></span>`
        : nameSpan(g.code,'stat-name');
      return `
      <div class="stat-card ${warn?'warn':''}">
        <div class="gauge">${gaugeSVG(pct||0, color)}<div class="pct" style="color:${color}">${pct===null?'–':pct+'%'}</div></div>
        <div>
          <div class="code"><span class="stat-code">${g.code}</span>${nameHtml}</div>
          <div class="sub">${st.present}/${st.total||0} sessions</div>
          ${proj ? `<div class="sub-proj" style="color:${projColor(proj.type)}">${proj.text}</div>` : ''}
        </div>
      </div>`;
    }).join("");

    renderAttendanceDay();
    updateBackupMeta();
  }

  function renderCreditsView(){
    const codes = activeCourseCodes();
    let totalCredits = 0;
    const grid = document.getElementById('creditsGrid');
    if(!grid) return;
    grid.innerHTML = codes.map(code=>{
      const cr = COURSE_CREDITS[code];
      if(cr) totalCredits += cr.c;
      const cat = courseCategory(code);
      const body = cr ? `
        <div class="credit-ltpc">
          <div class="ltpc-box"><span class="v">${cr.l}</span><span class="k">L</span></div>
          <div class="ltpc-box"><span class="v">${cr.t}</span><span class="k">T</span></div>
          <div class="ltpc-box"><span class="v">${cr.p}</span><span class="k">P</span></div>
          <div class="ltpc-box credit"><span class="v">${cr.c}</span><span class="k">Credits</span></div>
        </div>` : `<div class="credit-missing">Credit details not available yet</div>`;
      return `
      <div class="credit-card">
        <div class="credit-top">
          <span class="credit-dot ${cat}"></span>
          <span class="stat-code">${code}</span>
          ${nameSpan(code,'credit-name')}
        </div>
        ${body}
      </div>`;
    }).join("");
    const totalEl = document.getElementById('creditsTotalVal');
    if(totalEl) totalEl.textContent = totalCredits ? (Math.round(totalCredits*100)/100) : '—';
  }

  function midsemDaysUntil(iso){
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(iso+"T00:00:00");
    return Math.round((d-today)/86400000);
  }
  function midsemDaysLabel(n){
    if(n<0) return 'done';
    if(n===0) return 'today';
    if(n===1) return 'tomorrow';
    return 'in '+n+'d';
  }
  function midsemFmtDate(iso){
    const d = new Date(iso+"T00:00:00");
    return d.toLocaleDateString('en-GB',{day:'numeric', month:'short'});
  }

  let examSearchQuery = '';
  let examSheetOpen = false;

  function renderExamsView(){
    const wrap = document.getElementById('examsWrap');
    if(!wrap) return;

    const hasElective = hssCode && HSS_MAP[hssCode];
    const items = MIDSEM_CORE.map(c=>({ code:c.code, day:c.day, date:c.date, delta: midsemDaysUntil(c.date) }));
    if(hasElective) items.push({ code:hssCode, day:MIDSEM_HSS_DAY, date:MIDSEM_HSS_DATE, delta: midsemDaysUntil(MIDSEM_HSS_DATE) });
    items.sort((a,b)=>a.delta-b.delta);
    const next = items.find(c=>c.delta>=0) || items[items.length-1];

    const tickets = MIDSEM_CORE.map(c=>{
      const delta = midsemDaysUntil(c.date);
      const isNext = next && next.code===c.code;
      return `
      <div class="exam-ticket ${isNext?'is-next':''}">
        <div class="exam-code">${c.code}</div>
        ${nameSpan(c.code,'exam-name')}
        ${c.note ? `<div class="exam-flag">${escapeHtml(c.note)}</div>` : ''}
        <div class="exam-time">${MIDSEM_SLOT_MORNING}</div>
        <div class="exam-meta">
          <span>${c.day}, ${midsemFmtDate(c.date)}</span>
          <span class="exam-days">${midsemDaysLabel(delta)}</span>
        </div>
      </div>`;
    }).join('');

    let electiveBlock;
    if(hasElective){
      const delta = midsemDaysUntil(MIDSEM_HSS_DATE);
      const isNext = next && next.code===hssCode;
      electiveBlock = `
      <div class="exam-ticket elective ${isNext?'is-next':''}">
        <div class="exam-code">${hssCode}</div>
        ${nameSpan(hssCode,'exam-name')}
        <div class="exam-time">${MIDSEM_SLOT_MORNING}</div>
        <div class="exam-meta">
          <span>${MIDSEM_HSS_DAY}, ${midsemFmtDate(MIDSEM_HSS_DATE)}</span>
          <span class="exam-days">${midsemDaysLabel(delta)}</span>
        </div>
      </div>`;
    } else {
      electiveBlock = `
      <div class="exam-empty">
        Set your HSS elective from the <b>HSS</b> button above to see its exam date here — HS2110, HS2111 and HS2112 all sit in the same ${MIDSEM_HSS_DAY}, ${midsemFmtDate(MIDSEM_HSS_DATE)} slot, ${MIDSEM_SLOT_MORNING}.
      </div>`;
    }

    const bannerMsg = next
      ? `<b>${next.code}</b> — ${next.day}, ${midsemFmtDate(next.date)}, 10:30&nbsp;am &middot; ${midsemDaysLabel(next.delta)}`
      : '';

    const coreCodes = MIDSEM_CORE.map(c=>c.code);
    const q = examSearchQuery;

    function highlightRow(codesStr){
      return codesStr.split(', ').map(tok=>{
        const bare = tok.split('/')[0];
        const isMine = coreCodes.includes(bare) || (hasElective && bare === hssCode);
        const matches = !q || tok.toUpperCase().includes(q);
        const cls = [isMine ? 'mine' : '', !matches ? 'dim' : ''].filter(Boolean).join(' ');
        return `<span class="${cls}">${escapeHtml(tok)}</span>`;
      }).join(', ');
    }

    const fullRows = MIDSEM_FULL.map(d=>`
      <div class="exam-day-block">
        <div class="exam-day-head">${d.day}<span>${midsemFmtDate(d.date)}</span></div>
        <div class="exam-slot-row"><span class="exam-slot-lbl">Morning<span class="exam-slot-time">10:30–12:30</span></span><span class="exam-codes">${highlightRow(d.morning)}</span></div>
        <div class="exam-slot-row"><span class="exam-slot-lbl">Evening<span class="exam-slot-time">3:30–5:30</span></span><span class="exam-codes">${highlightRow(d.evening)}</span></div>
      </div>`).join('');

    wrap.innerHTML = `
      <div class="exam-intro">
        <div class="pyq-intro-title">Mid-Sem TimeTable</div>
        <div class="pyq-intro-sub">20–28 September 2026</div>
      </div>
      ${next ? `<div class="exam-banner"><span class="exam-banner-tag">Next up</span><span class="exam-banner-msg">${bannerMsg}</span></div>` : ''}

      <div class="section-label">CBE EXAMS</div>
      <div class="exam-tickets">${tickets}</div>

      <div class="section-label">HSS Elective-I</div>
      ${electiveBlock}

      <div class="section-label">Full week, both slots</div>
      <div class="exam-toggle-row">
        <button class="pyq-admin-link" id="examToggleBtn">${examSheetOpen ? 'Hide full datesheet' : 'Show full datesheet'}</button>
        <input type="text" id="examSearch" placeholder="Jump to a code, e.g. ME3104" value="${escapeHtml(examSearchQuery)}" />
      </div>
      <div class="exam-full-sheet ${examSheetOpen ? 'open':''}" id="examFullSheet">${fullRows}</div>
    `;

    const toggleBtn = document.getElementById('examToggleBtn');
    if(toggleBtn) toggleBtn.addEventListener('click', ()=>{
      examSheetOpen = !examSheetOpen;
      renderExamsView();
    });
    const searchInput = document.getElementById('examSearch');
    if(searchInput){
      searchInput.addEventListener('input', (e)=>{
        examSearchQuery = e.target.value.trim().toUpperCase();
        if(examSearchQuery) examSheetOpen = true;
        renderExamsView();
        const el = document.getElementById('examSearch');
        if(el){ el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
      });
    }
  }

  let pyqFiles = {};          
  let pyqOpenCourse = null;   
  let pyqLoaded = false;

  function pyqFmtSize(bytes){
    if(!bytes && bytes !== 0) return '';
    if(bytes < 1024*1024) return Math.max(1, Math.round(bytes/1024)) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
  }

  async function fetchPyqFiles(){
    try{
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_pyq_files?select=*&order=uploaded_at.desc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
      });
      if(!res.ok) throw new Error('fetch failed: ' + res.status);
      const rows = await res.json();
      const grouped = {};
      rows.forEach(r=>{
        if(!grouped[r.course_code]) grouped[r.course_code] = [];
        grouped[r.course_code].push(r);
      });
      pyqFiles = grouped;
    }catch(e){
      console.warn('pyq fetch failed', e);
      pyqFiles = pyqFiles || {};
    }
    pyqLoaded = true;
  }

  async function renderPyqView(){
    const wrap = document.getElementById('pyqList');
    if(!wrap) return;
    if(!pyqLoaded) await fetchPyqFiles();

    const isAdmin = pyqIsAdmin();
    const badge = document.getElementById('pyqAdminBadge');
    if(badge) badge.style.display = isAdmin ? 'inline-block' : 'none';

    const codes = activeCourseCodes();
    wrap.innerHTML = codes.map(code=>{
      const files = (pyqFiles[code] || []).slice().sort((a,b)=> new Date(b.uploaded_at) - new Date(a.uploaded_at));
      const open = pyqOpenCourse === code;
      const fileRows = files.length
        ? files.map(f=>`
          <div class="pyq-file-row">
            <span class="pyq-file-icon"></span>
            <div class="pyq-file-info">
              <div class="pyq-file-name">${f.file_name}</div>
              <div class="pyq-file-meta">${pyqFmtSize(f.size_bytes)}</div>
            </div>
            <div class="pyq-file-actions">
              <a href="${pyqPublicUrl(f.storage_path)}" target="_blank" rel="noopener">View</a>
              <a href="${pyqPublicUrl(f.storage_path)}" download="${f.file_name}">Download</a>
              ${isAdmin ? `<button class="pyq-file-del" data-del-id="${f.id}" data-del-path="${f.storage_path}" title="Delete">🗑</button>` : ''}
            </div>
          </div>`).join("")
        : `<div class="pyq-empty">No PYQ uploaded yet for this course.</div>`;

      const addRow = isAdmin ? `
        <div class="pyq-add-row">
          <button class="pyq-add-btn" data-add-code="${code}">+ Upload PDF for ${code}</button>
          <input type="file" accept="application/pdf" class="pyq-file-input" data-input-code="${code}" style="display:none;" />
          <div class="pyq-uploading" data-uploading-code="${code}" style="display:none;">Uploading…</div>
        </div>` : '';

      return `
      <div class="pyq-course ${open?'open':''}" data-course="${code}">
        <div class="pyq-course-head" data-toggle-code="${code}">
          <div class="pyq-course-title">
            <span class="pyq-course-code">${code}</span>
            ${nameSpan(code,'pyq-course-name')}
          </div>
          <div class="pyq-course-right">
            <span class="pyq-course-count">${files.length} file${files.length===1?'':'s'}</span>
            <span class="pyq-chevron">▶</span>
          </div>
        </div>
        <div class="pyq-course-body">
          ${fileRows}
          ${addRow}
        </div>
      </div>`;
    }).join("") || `<div class="pyq-empty">No courses to show yet.</div>`;

    wrap.querySelectorAll('[data-toggle-code]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const code = el.dataset.toggleCode;
        pyqOpenCourse = (pyqOpenCourse === code) ? null : code;
        renderPyqView();
      });
    });
    wrap.querySelectorAll('[data-del-id]').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        pyqDeleteFile(btn.dataset.delId, btn.dataset.delPath);
      });
    });
    wrap.querySelectorAll('[data-add-code]').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const code = btn.dataset.addCode;
        const input = wrap.querySelector(`.pyq-file-input[data-input-code="${code}"]`);
        if(input) input.click();
      });
    });
    wrap.querySelectorAll('.pyq-file-input').forEach(input=>{
      input.addEventListener('click', ev=> ev.stopPropagation());
      input.addEventListener('change', ()=>{
        const file = input.files && input.files[0];
        if(file) pyqUploadFile(input.dataset.inputCode, file);
        input.value = '';
      });
    });
  }

  function fileToBase64(file){
    return new Promise((resolve, reject)=>{
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(file);
    });
  }

  const PYQ_MAX_BYTES = 3 * 1024 * 1024; 

  async function pyqUploadFile(courseCode, file){
    if(!pyqIsAdmin()) return;
    if(file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)){
      flashSaveToast(false, 'Only PDF files are supported');
      return;
    }
    if(file.size > PYQ_MAX_BYTES){
      flashSaveToast(false, 'File too big — keep PDFs under 3MB');
      return;
    }

    const loadingEl = document.querySelector(`[data-uploading-code="${courseCode}"]`);
    if(loadingEl) loadingEl.style.display = 'block';
    try{
      const fileBase64 = await fileToBase64(file);
      const res = await fetch('/api/pyq-admin', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, adminAuthHeader()),
        body: JSON.stringify({ roll: currentUser.roll, action:'upload', courseCode, fileName: file.name, fileBase64 })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok){
        flashSaveToast(false, data.error || 'Upload failed');
        return;
      }
      flashSaveToast(true, 'PYQ uploaded');
      pyqLoaded = false;
      await renderPyqView();
    }catch(e){
      console.warn('pyq upload failed', e);
      flashSaveToast(false, 'Upload failed');
    }finally{
      if(loadingEl) loadingEl.style.display = 'none';
    }
  }

  async function pyqDeleteFile(id, storagePath){
    if(!pyqIsAdmin()) return;
    if(!confirm('Delete this PYQ file for everyone?')) return;
    try{
      const res = await fetch('/api/pyq-admin', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, adminAuthHeader()),
        body: JSON.stringify({ roll: currentUser.roll, action:'delete', id, storagePath })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok){
        flashSaveToast(false, data.error || 'Delete failed');
        return;
      }
      flashSaveToast(true, 'Deleted');
      pyqLoaded = false;
      await renderPyqView();
    }catch(e){
      console.warn('pyq delete failed', e);
      flashSaveToast(false, 'Delete failed');
    }
  }

  let booksFiles = {};
  let booksOpenCourse = null;
  let booksLoaded = false;

  async function fetchBooksFiles(){
    try{
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cbe_reference_books?select=*&order=created_at.desc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
      });
      if(!res.ok) throw new Error('fetch failed: ' + res.status);
      const rows = await res.json();
      const grouped = {};
      rows.forEach(r=>{
        if(!grouped[r.course_code]) grouped[r.course_code] = [];
        grouped[r.course_code].push(r);
      });
      booksFiles = grouped;
    }catch(e){
      console.warn('books fetch failed', e);
      booksFiles = booksFiles || {};
    }
    booksLoaded = true;
  }

  async function renderBooksView(){
    const wrap = document.getElementById('booksList');
    if(!wrap) return;
    if(!booksLoaded) await fetchBooksFiles();

    const isAdmin = booksIsAdmin();
    const badge = document.getElementById('booksAdminBadge');
    if(badge) badge.style.display = isAdmin ? 'inline-block' : 'none';

    const codes = activeCourseCodes();
    wrap.innerHTML = codes.map(code=>{
      const files = (booksFiles[code] || []).slice().sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
      const open = booksOpenCourse === code;
      const fileRows = files.length
        ? files.map(f=>`
          <div class="pyq-file-row">
            <span class="pyq-file-icon"></span>
            <div class="pyq-file-info">
              <div class="pyq-file-name">${f.title || f.file_name}</div>
              <div class="pyq-file-meta">${pyqFmtSize(f.size_bytes)}</div>
            </div>
            <div class="pyq-file-actions">
              <a href="${booksPublicUrl(f.storage_path)}" target="_blank" rel="noopener">View</a>
              <a href="${booksPublicUrl(f.storage_path)}" download="${f.file_name}">Download</a>
              ${isAdmin ? `<button class="pyq-file-del" data-bdel-id="${f.id}" data-bdel-path="${f.storage_path}" title="Delete">🗑</button>` : ''}
            </div>
          </div>`).join("")
        : `<div class="pyq-empty">No reference material uploaded yet for this course.</div>`;

      const addRow = isAdmin ? `
        <div class="pyq-add-row">
          <button class="pyq-add-btn" data-badd-code="${code}">+ Upload PDF for ${code}</button>
          <input type="file" accept="application/pdf" class="books-file-input" data-binput-code="${code}" style="display:none;" />
          <div class="pyq-uploading" data-buploading-code="${code}" style="display:none;">Uploading…</div>
        </div>` : '';

      return `
      <div class="pyq-course ${open?'open':''}" data-bcourse="${code}">
        <div class="pyq-course-head" data-btoggle-code="${code}">
          <div class="pyq-course-title">
            <span class="pyq-course-code">${code}</span>
            ${nameSpan(code,'pyq-course-name')}
          </div>
          <div class="pyq-course-right">
            <span class="pyq-course-count">${files.length} file${files.length===1?'':'s'}</span>
            <span class="pyq-chevron">▶</span>
          </div>
        </div>
        <div class="pyq-course-body">
          ${fileRows}
          ${addRow}
        </div>
      </div>`;
    }).join("") || `<div class="pyq-empty">No courses to show yet.</div>`;

    wrap.querySelectorAll('[data-btoggle-code]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const code = el.dataset.btoggleCode;
        booksOpenCourse = (booksOpenCourse === code) ? null : code;
        renderBooksView();
      });
    });
    wrap.querySelectorAll('[data-bdel-id]').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        booksDeleteFile(btn.dataset.bdelId, btn.dataset.bdelPath);
      });
    });
    wrap.querySelectorAll('[data-badd-code]').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const code = btn.dataset.baddCode;
        const input = wrap.querySelector(`.books-file-input[data-binput-code="${code}"]`);
        if(input) input.click();
      });
    });
    wrap.querySelectorAll('.books-file-input').forEach(input=>{
      input.addEventListener('click', ev=> ev.stopPropagation());
      input.addEventListener('change', ()=>{
        const file = input.files && input.files[0];
        if(file) booksUploadFile(input.dataset.binputCode, file);
        input.value = '';
      });
    });
  }

  const BOOKS_MAX_BYTES = 50 * 1024 * 1024; // matches Supabase free-plan project-wide cap

  async function booksUploadFile(courseCode, file){
    if(!booksIsAdmin()) return;
    if(file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)){
      flashSaveToast(false, 'Only PDF files are supported');
      return;
    }
    if(file.size > BOOKS_MAX_BYTES){
      flashSaveToast(false, 'File too big — keep PDFs under 50MB');
      return;
    }

    const loadingEl = document.querySelector(`[data-buploading-code="${courseCode}"]`);
    if(loadingEl) loadingEl.style.display = 'block';
    try{
      // Step 1: ask our function for a signed upload URL (tiny request).
      const signRes = await fetch('/api/books-admin', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, adminAuthHeader()),
        body: JSON.stringify({ roll: currentUser.roll, action:'get-upload-url', courseCode, fileName: file.name, fileSize: file.size })
      });
      const signData = await signRes.json().catch(()=>({}));
      if(!signRes.ok || !signData.ok){
        flashSaveToast(false, signData.error || 'Upload failed');
        return;
      }

      // Step 2: browser uploads the file DIRECTLY to Supabase Storage —
      // this bypasses Vercel's function body limit entirely.
      const putRes = await fetch(signData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/pdf', 'x-upsert': 'true' },
        body: file
      });
      if(!putRes.ok){
        flashSaveToast(false, 'Upload to storage failed');
        return;
      }

      // Step 3: confirm — tiny JSON payload, just saves the DB row.
      const confirmRes = await fetch('/api/books-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll: currentUser.roll, action:'confirm', courseCode,
          fileName: signData.cleanName, storagePath: signData.storagePath, sizeBytes: file.size
        })
      });
      const confirmData = await confirmRes.json().catch(()=>({}));
      if(!confirmRes.ok || !confirmData.ok){
        flashSaveToast(false, confirmData.error || 'Could not save book record');
        return;
      }

      flashSaveToast(true, 'Book uploaded');
      booksLoaded = false;
      await renderBooksView();
    }catch(e){
      console.warn('books upload failed', e);
      flashSaveToast(false, 'Upload failed');
    }finally{
      if(loadingEl) loadingEl.style.display = 'none';
    }
  }

  async function booksDeleteFile(id, storagePath){
    if(!booksIsAdmin()) return;
    if(!confirm('Delete this book for everyone?')) return;
    try{
      const res = await fetch('/api/books-admin', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, adminAuthHeader()),
        body: JSON.stringify({ roll: currentUser.roll, action:'delete', id, storagePath })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || !data.ok){
        flashSaveToast(false, data.error || 'Delete failed');
        return;
      }
      flashSaveToast(true, 'Deleted');
      booksLoaded = false;
      await renderBooksView();
    }catch(e){
      console.warn('books delete failed', e);
      flashSaveToast(false, 'Delete failed');
    }
  }

  let spiCourses = []; 

  function renderSpiView(){
    const rows = document.getElementById('spiGradeRows');
    if(!rows) return;
    spiCourses = activeCourseCodes().filter(code => COURSE_CREDITS[code]);
    rows.innerHTML = spiCourses.map((code, i)=>{
      const cr = COURSE_CREDITS[code];
      return `
      <div class="spi-row">
        <div class="spi-row-name">${courseLabel(code)}<small>${code}</small></div>
        <div class="spi-row-credit">${cr.c}cr</div>
        <select id="spiG${i}">
          <option value="">—</option>
          ${Object.keys(GRADE_POINTS).map(g=>`<option value="${g}">${g}</option>`).join('')}
        </select>
      </div>`;
    }).join("");
    rows.querySelectorAll('select').forEach(sel=>{
      sel.addEventListener('change', checkSpiReady);
    });
    document.getElementById('spiResult').classList.remove('show');
    checkSpiReady();
  }

  function checkSpiReady(){
    const btn = document.getElementById('spiCalcBtn');
    if(!btn) return;
    const all = spiCourses.length>0 && spiCourses.every((_, i)=>{
      const el = document.getElementById('spiG'+i);
      return el && el.value !== '';
    });
    btn.disabled = !all;
  }

  async function calculateSpi(){
    if(!currentUser || spiCourses.length===0) return;
    const all = spiCourses.every((_, i)=>{
      const el = document.getElementById('spiG'+i); return el && el.value !== '';
    });
    if(!all) return;

    let totalCr = 0, weighted = 0;
    const grades = {};
    spiCourses.forEach((code, i)=>{
      const g = document.getElementById('spiG'+i).value;
      const cr = COURSE_CREDITS[code];
      grades[code] = g;
      totalCr += cr.c;
      weighted += cr.c * GRADE_POINTS[g];
    });
    const spi = Math.round((weighted/totalCr)*100)/100;
    const theme = spiTheme(spi);

    const scoreEl = document.getElementById('spiScoreVal');
    scoreEl.textContent = spi.toFixed(2);
    scoreEl.style.color = theme.color;

    const badge = document.getElementById('spiGradeBadge');
    badge.textContent = theme.label;
    badge.style.background = 'color-mix(in srgb, ' + theme.color + ' 18%, transparent)';
    badge.style.border = '1px solid color-mix(in srgb, ' + theme.color + ' 40%, transparent)';
    badge.style.color = theme.color;

    const segBar = document.getElementById('spiSegBar');
    segBar.innerHTML = '';
    const filled = Math.round(spi);
    for(let i=0;i<10;i++){
      const seg = document.createElement('div');
      seg.className = 'spi-seg' + (i<filled ? (spi<5 ? ' active-warn' : ' active') : '');
      segBar.appendChild(seg);
    }

    const grid = document.getElementById('spiBreakdownGrid');
    grid.innerHTML = spiCourses.map(code=>{
      const g = grades[code];
      return `
      <div class="spi-brow">
        <span class="spi-brow-name">${code}</span>
        <span class="spi-brow-grade" style="color:${GRADE_COLOR_VARS[g]}">${g}</span>
      </div>`;
    }).join("");

    document.getElementById('spiResult').classList.add('show');
    document.getElementById('spiResult').scrollIntoView({ behavior:'smooth', block:'nearest' });

    const msg = document.getElementById('spiSaveMsg');
    if(!SPI_SHEET_URL){
      msg.textContent = '';
      msg.className = 'spi-save-msg';
      return;
    }
    const btn = document.getElementById('spiCalcBtn');
    btn.disabled = true;
    msg.textContent = 'Saving…'; msg.className = 'spi-save-msg';
    try{
      await fetch(SPI_SHEET_URL, {
        method: 'POST', mode: 'no-cors',
        headers: Object.assign({ 'Content-Type': 'application/json' }, adminAuthHeader()),
        body: JSON.stringify({ roll: currentUser.roll, name: currentUser.name, spi: spi.toFixed(2), grades, submittedAt: new Date().toISOString() })
      });
      msg.textContent = '✓ Result saved'; msg.className = 'spi-save-msg ok';
    }catch(e){
      msg.textContent = ' Could not save — check connection'; msg.className = 'spi-save-msg err';
    }finally{
      checkSpiReady();
    }
  }

  document.getElementById('spiCalcBtn').addEventListener('click', calculateSpi);

  function dayEditControlsHtml(d){
    const removedList = removedBaseSessionsForDate(d);
    const isAdmin = timetableIsAdmin();
    return `
      ${removedList.length ? `
      <div class="removed-list">
        <div class="removed-title">Removed for this day</div>
        ${removedList.map(s=>`
          <div class="removed-item">
            <span>${s.code} · ${fmtHM(s.start)} ${s._global ? '<span class="cc-tag cancelled">cancelled for everyone</span>' : ''}</span>
            ${s._personal ? `<button class="restore-btn" data-scope="personal" data-sig="${sessionSig(s)}">↺ restore</button>` : ''}
            ${(isAdmin && s._global) ? `<button class="restore-btn admin-restore" data-scope="global" data-sig="${sessionSig(s)}">↺ restore for everyone</button>` : ''}
          </div>`).join("")}
      </div>` : ''}
      <button class="day-edit-btn" id="addExtraClassBtn">+ Add a class for this day</button>
      ${isAdmin ? `<button class="day-edit-btn admin-btn" id="addGlobalClassBtn">+ Add a class for everyone (admin)</button>` : ''}
    `;
  }

  function bindDayEditControls(d){
    const wrap = document.getElementById('attendanceDayWrap');
    wrap.querySelectorAll('.day-edit-remove').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const scope = btn.dataset.scope || 'personal';
        const isExtra = btn.dataset.extra === '1';
        if(scope === 'global'){
          if(!timetableIsAdmin()) return;
          if(isExtra){
            if(!confirm('Delete this class for everyone? This updates the shared timetable.')) return;
            deleteExtraSessionForEveryone(d, btn.dataset.id);
          } else {
            if(!confirm("Cancel this class for everyone? All students will see it removed from today's timetable.")) return;
            cancelSessionForEveryone(d, btn.dataset.sig);
          }
        } else if(isExtra){
          if(!confirm('Delete this class you added? This only affects your own timetable.')) return;
          deleteExtraSessionForDate(d, btn.dataset.id);
        } else {
          if(!confirm("Remove this class for this day only? It'll still show up as usual on other days, and only your own timetable changes.")) return;
          removeSessionForDateBySig(d, btn.dataset.sig);
        }
        renderAll();
      });
    });
    wrap.querySelectorAll('.admin-reschedule').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        openAddClassModal(d, {
          global: true,
          reschedule: {
            sig: btn.dataset.sig, code: btn.dataset.code, room: btn.dataset.room,
            type: btn.dataset.type, start: Number(btn.dataset.start), end: Number(btn.dataset.end)
          }
        });
      });
    });
    wrap.querySelectorAll('.restore-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.dataset.scope === 'global') restoreSessionForEveryone(d, btn.dataset.sig);
        else restoreSessionForDate(d, btn.dataset.sig);
        renderAll();
      });
    });
    const addBtn = document.getElementById('addExtraClassBtn');
    if(addBtn) addBtn.addEventListener('click', ()=> openAddClassModal(d, { global:false }));
    const addGlobalBtn = document.getElementById('addGlobalClassBtn');
    if(addGlobalBtn) addGlobalBtn.addEventListener('click', ()=> openAddClassModal(d, { global:true }));
  }

  function renderAttendanceDay(){
    const d = attSelectedDate;
    const { main, rel } = fmtDayLabel(d);
    const wrap = document.getElementById('attendanceDayWrap');
    const list = scheduleForDate(d);
    const editControls = dayEditControlsHtml(d);
    const dayTotalMins = list.reduce((sum,s)=> sum + roundedSessionMinutes(s), 0);
    const relExtra = list.length ? ` · ${list.length} session${list.length!==1?'s':''} · ${fmtDuration(dayTotalMins)}` : '';
    document.getElementById('dateLabel').innerHTML = `${main}<span class="rel">${rel}${relExtra}</span>`;

    if(list.length===0){
      wrap.innerHTML = `<div class="empty-state" style="padding:24px;">No sessions on this date.</div>` + editControls;
      bindDayEditControls(d);
      return;
    }
    const dateIso = isoDate(d);
    wrap.innerHTML = list.map(s=>{
      const key = markKeyFor(dateIso, s);
      const status = attendance[key];
      const locked = !canMarkFromAttendanceTab(d, s);
      const isExtra = !!s.isExtra;
      const isGlobalExtra = !!s.isGlobalExtra;
      const isAdmin = timetableIsAdmin();
      const canRemoveBase = !isExtra && !isGlobalExtra && locked;
      let removeBtn = '';
      if(isExtra){
        removeBtn = `<button class="day-edit-remove" data-scope="personal" data-extra="1" data-id="${s.id||''}"> delete this class</button>`;
      } else if(isGlobalExtra){
        removeBtn = isAdmin ? `<button class="day-edit-remove admin-remove" data-scope="global" data-extra="1" data-id="${s.id||''}"> delete for everyone</button>` : '';
      } else if(canRemoveBase){
        removeBtn = `<button class="day-edit-remove" data-scope="personal" data-extra="0" data-sig="${sessionSig(s)}"> remove for this day only</button>`;
      }
      const adminBtns = (isAdmin && canRemoveBase) ? `
          <button class="day-edit-remove admin-remove" data-scope="global" data-extra="0" data-sig="${sessionSig(s)}"> cancel for everyone</button>
          <button class="day-edit-remove admin-reschedule" data-sig="${sessionSig(s)}" data-code="${escapeHtml(s.code)}" data-room="${escapeHtml(s.room)}" data-type="${s.type}" data-start="${s.start}" data-end="${s.end}"> reschedule for everyone</button>
        ` : '';
      return `
      <div class="class-card">
        <div class="tile ${s.type}"><div class="num">${fmtHM(s.start).split(' ')[0]}</div><div class="code">${tileCode(s.code)}</div></div>
        <div class="cc-body">
          <div class="cc-top"><span class="cc-code">${s.code}</span>${nameSpan(s,'cc-name')}<span class="cc-tag ${s.type}">${s.tag || s.type}</span>${isExtra ? '<span class="cc-tag added">added</span>' : ''}${isGlobalExtra ? '<span class="cc-tag admin-added">added by admin</span>' : ''}</div>
          <div class="cc-meta">${fmtHM(s.start)}–${fmtHM(s.end)} · ${s.room}</div>
          ${locked ? `<div class="cc-status">not started yet</div>` : (!status ? `<div class="cc-status auto-absent">counted as absent — tap ✓ if you were there</div>` : '')}
          ${removeBtn}
          ${adminBtns}
        </div>
        <div class="mark-group">
          <button class="mark-btn p ${status==='p'?'active':''}" ${locked?'disabled':''} data-key="${key}" data-val="p" title="Present">✓</button>
          <button class="mark-btn a ${status==='a'?'active':''}" ${locked?'disabled':''} data-key="${key}" data-val="a" title="Absent">✕</button>
          <button class="mark-btn c ${status==='c'?'active':''}" ${locked?'disabled':''} data-key="${key}" data-val="c" title="Cancelled">⊘</button>
        </div>
      </div>`;
    }).join("") + editControls;

    wrap.querySelectorAll('.mark-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.disabled) return;
        const key = btn.dataset.key, val = btn.dataset.val;
        if(attendance[key]===val) delete attendance[key];
        else attendance[key] = val;
        persistAttendance();
        renderAttendanceView();
      });
    });
    bindDayEditControls(d);
  }

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-'+btn.dataset.view).classList.add('active');
    });
  });

  document.getElementById('prevDate').addEventListener('click', ()=>{
    attSelectedDate = addDays(attSelectedDate, -1); renderAttendanceDay();
  });
  document.getElementById('nextDate').addEventListener('click', ()=>{
    attSelectedDate = addDays(attSelectedDate, 1); renderAttendanceDay();
  });
  document.getElementById('jumpToday').addEventListener('click', ()=>{
    attSelectedDate = new Date(); renderAttendanceDay();
  });

  function tickClock(){
    now = new Date();
    document.getElementById('clockTime').textContent =
      pad(now.getHours())+":"+pad(now.getMinutes())+":"+pad(now.getSeconds());
    document.getElementById('clockDate').textContent =
      now.toLocaleDateString(undefined,{weekday:'long', month:'short', day:'numeric'});
    if(!currentUser) return;
    renderHero();
    if(lastSyncOk === true) updateSyncBadge();
    if(document.getElementById('view-now').classList.contains('active')){
      const dow = selectedDow===null ? now.getDay() : selectedDow;
      if(dow===now.getDay()) renderNowTimeline();
    }
    if(document.getElementById('view-attendance').classList.contains('active')){
      if(isoDate(attSelectedDate)===isoDate(now)) renderAttendanceDay();
    }
  }

  function renderAll(){
    if(!currentUser) return;
    buildDayRow();
    renderNowTimeline();
    renderWeek();
    renderAttendanceView();
    renderExamsView();
    renderCreditsView();
    renderSpiView();
    renderPyqView();
    renderBooksView();
    renderHero();
  }

  setInterval(tickClock, 1000);
  tickClock();

  setInterval(async ()=>{
    if(!currentUser) return;
    announceLoaded = false;
    await fetchAnnouncements();
    renderAnnounceBell();
    if(announceOverlay && announceOverlay.style.display === 'flex') renderAnnouncePanel();
    try{
      const g = await Store.get('global-overrides', true);
      const next = (g && g.value) ? JSON.parse(g.value) : {};
      if(JSON.stringify(next) !== JSON.stringify(globalOverrides)){
        globalOverrides = next;
        renderAll();
      }
    }catch(e){ /* keep last known overrides — fine */ }
  }, 45000);

  tryAutoLogin();

})();