(function(){
  "use strict";

  const STUDENTS = [{"roll":"2501CB23","name":"AARSH JAIN"},{"roll":"2501CB49","name":"ABHI RAJ"},{"roll":"2501CB13","name":"ABHINAV B"},{"roll":"2501CB33","name":"ABHISHEK BANSAL"},{"roll":"2501CB58","name":"ADWAIT VATS"},{"roll":"2501CB42","name":"AHAN BHATTACHARJEE"},{"roll":"2501CB39","name":"AMAN SAROJ"},{"roll":"2501CB14","name":"ANGAJ SAHIL SARJERAO"},{"roll":"2501CB34","name":"ANSER AYAAN"},{"roll":"2501CB62","name":"ANSHU VISHWAKARMA"},{"roll":"2501CB06","name":"ARCHIT SHANKER"},{"roll":"2501CB26","name":"ARYAN DEV"},{"roll":"2501CB41","name":"AVDHESH MEENA"},{"roll":"2501CB16","name":"BIBHAS BIKASH BISWAS"},{"roll":"2501CB32","name":"BIKI BARMAN"},{"roll":"2501CB60","name":"BISWAS MAYANK PRADYUT"},{"roll":"2501CB51","name":"BOYINA SADVIKA"},{"roll":"2501CB46","name":"CHILMAKURI CHARAN"},{"roll":"2501CB24","name":"DHADSE OMESH VASANTRAO"},{"roll":"2501CB19","name":"DHRUV AGNIHOTRI"},{"roll":"2501CB22","name":"DHRUV ARVIND GANATRA"},{"roll":"2501CB03","name":"DIA HALDER"},{"roll":"2501CB04","name":"EMIN PHILIP SAJI"},{"roll":"2501CB40","name":"GAURAV SUKHADIA"},{"roll":"2501CB47","name":"HARIOM SINGH"},{"roll":"2501CB31","name":"HEMANT KUMAR BAIRWA"},{"roll":"2501CB01","name":"J SAMRUTHA"},{"roll":"2501CB07","name":"JARPULA MURALI"},{"roll":"2501CB05","name":"KAJAL BATRA"},{"roll":"2501CB11","name":"KARISHMA"},{"roll":"2501CB10","name":"KATURI VANSHIKA"},{"roll":"2501CB29","name":"KAVYA GUPTA"},{"roll":"2501CB48","name":"MADA AKEERA SRI VARSHAN"},{"roll":"2501CB43","name":"MADHUR SRIVASTAVA"},{"roll":"2501CB08","name":"MANAV RATHORE"},{"roll":"2501CB21","name":"NASREEN FATIMA"},{"roll":"2501CB20","name":"OSHI MALVIYA"},{"roll":"2501CB45","name":"PILLI SRI VAISHNAVI"},{"roll":"2501CB02","name":"PRIYANSHI PATEL"},{"roll":"2501CB12","name":"PUSHPENDRA SHARMA"},{"roll":"2501CB56","name":"RAJ ARYAN"},{"roll":"2501CB50","name":"RAUSHAN KUMAR"},{"roll":"2501CB54","name":"RIDDHI PATEL"},{"roll":"2501CB35","name":"S ADITYA"},{"roll":"2501CB55","name":"SACHIN"},{"roll":"2501CB38","name":"SAI SUBRAT JENA"},{"roll":"2501CB44","name":"SAKALA SATHWIK"},{"roll":"2501CB15","name":"SAMIT SARDAR"},{"roll":"2501CB53","name":"SANKET YADAV JADHAV"},{"roll":"2501CB09","name":"SAPTARSHI BOSE"},{"roll":"2501CB52","name":"SARTHAK ANUSIMI"},{"roll":"2501CB61","name":"SATISH KUMAR YADAV"},{"roll":"2501CB28","name":"SHANTANU SARDAR"},{"roll":"2501CB64","name":"SHORYA PRATAP SINGH"},{"roll":"2501CB59","name":"SNEHADIP GHOSH"},{"roll":"2501CB30","name":"SWARNAVA KUNDU"},{"roll":"2501CB63","name":"TANIYA KUMARI GUPTA"},{"roll":"2501CB25","name":"VAANYA VERMA"},{"roll":"2501CB36","name":"VADAVELLI KAMALI HARSHITHA"},{"roll":"2501CB65","name":"VADITHYA UPENDAR"},{"roll":"2501CB17","name":"VAIBHAV SANJAY BHAGURE"},{"roll":"2501CB27","name":"VAISHNAV KRISHNA DURGASI"},{"roll":"2501CB18","name":"VANSH KHURANA"},{"roll":"2503CB01","name":"ADARSH CHOUDHARY"},{"roll":"2503CB02","name":"AMOOLYA SHARAN"},{"roll":"2503CB05","name":"DHEERAJ KUMAR"},{"roll":"2503CB03","name":"TEJVEER"},{"roll":"2503CB04","name":"YASH MADHOK"}];
  const STUDENT_MAP = {};
  STUDENTS.forEach(s => STUDENT_MAP[s.roll.toUpperCase()] = s.name);

  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DAY_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  function tm(h,m){ return h*60+m; }

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
    { day:3, start:tm(17,0), end:tm(17,55), code:"CB2104", type:"lecture", room:"R102" },

    // Thursday
    { day:4, start:tm(10,0), end:tm(12,55), code:"CB2103", type:"lab",     room:"Lab"  },
    { day:4, start:tm(15,0), end:tm(16,55), code:"CB2104", type:"lecture", room:"R102" },
    { day:4, start:tm(17,0), end:tm(17,55), code:"CB2103", type:"lecture", room:"R307" },

    // Friday
    { day:5, start:tm(10,0), end:tm(11,55), code:"CB2102", type:"lab",     room:"Lab"  },
    { day:5, start:tm(15,0), end:tm(15,55), code:"CB2102", type:"lecture", room:"R102" },
    { day:5, start:tm(16,0), end:tm(16,55), code:"CB2105", type:"lecture", room:"R102" },
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

  // L-T-P-Credit as shown on the ERP course pages
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

  const HSS_START = tm(14,0), HSS_END = tm(15,0);
  const HSS_ELECTIVES = [
    { code:"HS2110", slot:6,  sessions:[{day:3,room:"LT103"},{day:4,room:"LT103"},{day:5,room:"LT103"}] }, // Wed/Thu/Fri
    { code:"HS2111", slot:32, sessions:[{day:2,room:"LT001"},{day:3,room:"LT001"},{day:4,room:"LT001"}] }, // Tue/Wed/Thu
    { code:"HS2112", slot:1,  sessions:[{day:2,room:"LT103"},{day:3,room:"LT003"},{day:4,room:"LT003"}] }, // Tue/Wed/Thu
  ];
  const HSS_MAP = {};
  HSS_ELECTIVES.forEach(h => HSS_MAP[h.code] = h);

  // Students with a dual CBE+MBA roll number (2503CBxx) get this course auto-added
  // on top of their normal core schedule — nobody else is affected.
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
  
  const SUPABASE_URL = "https://ektzrezmwzhautdmbrwf.supabase.co";       
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdHpyZXptd3poYXV0ZG1icndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTY1MzksImV4cCI6MjEwMDQ3MjUzOX0.IoVDIWNNqMzFFZUk_C2LV8Wm-cxBs3OM6Cp5bP2GTr4";  
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
          if(key.indexOf('attendance:') === 0 || key === 'course-names' || key.indexOf('hss:') === 0){
            try{
              const raw = key.indexOf('attendance:') === 0
                ? await sbGetAttendance(key.slice('attendance:'.length))
                : key.indexOf('hss:') === 0
                ? await sbGetHss(key.slice('hss:'.length))
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
        if(hasSupabase && (key.indexOf('attendance:') === 0 || key === 'course-names' || key.indexOf('hss:') === 0)){
          try{
            if(key.indexOf('attendance:') === 0) await sbSetAttendance(key.slice('attendance:'.length), currentUser ? currentUser.name : '', value);
            else if(key.indexOf('hss:') === 0) await sbSetHss(key.slice('hss:'.length), value);
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
  let currentUser = null; 

  const loginScreen = document.getElementById('loginScreen');
  const appScreen = document.getElementById('appScreen');
  const rollInput = document.getElementById('rollInput');
  const rollSuggest = document.getElementById('rollSuggest');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  const rememberMe = document.getElementById('rememberMe');

  function showSuggestions(q){
    q = q.trim().toUpperCase();
    if(!q){ rollSuggest.classList.remove('show'); rollSuggest.innerHTML=''; return; }
    const matches = STUDENTS.filter(s => s.roll.includes(q) || s.name.toUpperCase().includes(q)).slice(0,8);
    if(!matches.length){ rollSuggest.classList.remove('show'); rollSuggest.innerHTML=''; return; }
    rollSuggest.innerHTML = matches.map(s => `<div class="login-suggest-item" data-roll="${s.roll}"><span class="r">${s.roll}</span><span class="n">${s.name}</span></div>`).join('');
    rollSuggest.classList.add('show');
    rollSuggest.querySelectorAll('.login-suggest-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        rollInput.value = el.dataset.roll;
        rollSuggest.classList.remove('show');
        rollInput.focus();
      });
    });
  }

  rollInput.addEventListener('input', ()=>{
    loginError.classList.remove('show');
    showSuggestions(rollInput.value);
  });
  rollInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); attemptLogin(); }
  });
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
    currentUser = { roll, name };
    if(rememberMe.checked){
      await Store.set('remembered-roll', roll, false);
    } else {
      await Store.delete('remembered-roll', false);
    }
    await enterApp();
  }

  loginBtn.addEventListener('click', attemptLogin);

  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    currentUser = null;
    attendance = {};
    await Store.delete('remembered-roll', false);
    appScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    rollInput.value = '';
    loginError.classList.remove('show');
    rollInput.focus();
  });

  async function tryAutoLogin(){
    try{
      const r = await Store.get('remembered-roll', false);
      if(r && r.value && STUDENT_MAP[r.value.toUpperCase()]){
        currentUser = { roll: r.value.toUpperCase(), name: STUDENT_MAP[r.value.toUpperCase()] };
        await enterApp();
      }
    }catch(e){ /* no remembered roll yet — fine, just show the login screen */ }
  }

  async function enterApp(){
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    document.getElementById('helloName').textContent = currentUser.name;
    document.getElementById('helloRoll').textContent = currentUser.roll;
    await loadUserData();
    renderAll();
    updateStorageBanner();
    updateSyncBadge();
    updateBackupCopy();
    updateBackupMeta();
    updateHssButton();
    if(hssCode === null) openHssModal(); 
  }

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
    if(hssCode === null) hssCode = ""; // only mark as "explicitly skipped" if never chosen
    await persistHss();
    updateHssButton();
    closeHssModal();
    renderAll();
  });
  hssOverlay.addEventListener('click', (e)=>{ if(e.target === hssOverlay) closeHssModal(); });

  function updateStorageBanner(){
    const banner = document.getElementById('storageBanner');
    if(!banner) return;
    if(Store.isCloud){ banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    banner.innerHTML = `⚠️ Saved to this browser only — clearing browser data or switching device/browser will lose it. <b>Back up from the Attendance tab.</b>`;
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
      badge.textContent = '💾 Local only';
      badge.className = 'sync-badge local';
      return;
    }
    if(lastSyncOk === null){
      badge.textContent = '☁ Cloud enabled';
      badge.className = 'sync-badge cloud';
      return;
    }
    if(lastSyncOk){
      badge.textContent = '✓ Synced ' + timeAgoShort(lastSyncAt);
      badge.className = 'sync-badge cloud';
    } else {
      badge.textContent = '⚠ Not synced — saved locally';
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

  async function loadUserData(){
    attendance = {};
    courseNames = {};
    hssCode = null;
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

  function courseLabel(code){ return COURSE_NAMES[code] || courseNames[code] || code; }
  function tileCode(code){ return code.replace(/^CB|^HS/, ''); }

  function nameSpan(code, cls){
    return `<span class="${cls}">${courseLabel(code)}</span>`;
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

  function findNext(){
    const dow = now.getDay();
    const nowMin = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
    const todays = scheduleForDay(dow);
    for(const s of todays){
      if(nowMin >= s.start && nowMin < s.end){
        return { s, offsetDays:0, status:"ongoing" };
      }
    }
    let upcoming = todays.filter(s=>s.start > nowMin).sort((a,b)=>a.start-b.start)[0];
    if(upcoming) return { s:upcoming, offsetDays:0, status:"upcoming" };
    for(let off=1; off<=7; off++){
      const d = (dow+off)%7;
      const list = scheduleForDay(d).sort((a,b)=>a.start-b.start);
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
          <div class="hero-title"><span class="hero-code">${s.code}</span>${nameSpan(s.code,'hero-name')}</div>
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
      marksWrap.innerHTML = scheduleForDay(now.getDay()).map(cls=>{
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
      const chip=document.createElement('div');
      chip.className='day-chip'+(d===now.getDay()?' today':'')+(d===selectedDow?' selected':'');
      chip.innerHTML = `${DAY_SHORT[d]}<span class="n">${scheduleForDay(d).length||'—'}</span>`;
      chip.onclick=()=>{ selectedDow=d; buildDayRow(); renderNowTimeline(); };
      wrap.appendChild(chip);
    }
  }

  function markKeyFor(dateIso, s){ return dateIso+"|"+s.code+"|"+s.start; }

  function dateForWeekday(dow){
    const diff = dow - now.getDay();
    return addDays(now, diff);
  }

  function renderNowTimeline(){
    const wrap = document.getElementById('nowTimelineWrap');
    const dow = selectedDow===null ? now.getDay() : selectedDow;
    const isToday = dow===now.getDay();
    const list = scheduleForDay(dow);

    if(dow===0||dow===6){
      wrap.innerHTML = `<div class="empty-state"><div class="glyph"></div> offline for the weekend.<br>No 2nd-year CBE sessions scheduled.</div>`;
      return;
    }
    if(list.length===0){
      wrap.innerHTML = `<div class="empty-state"><div class="glyph"></div>Clear bench day — no 2nd-year classes.<br>Good day to catch up on notes.</div>`;
      return;
    }

    const dateForDow = isToday ? now : dateForWeekday(dow);
    const dateIso = isoDate(dateForDow);
    const nowMin = now.getHours()*60+now.getMinutes();
    const dayHasStarted = startOfDay(dateForDow).getTime() < startOfDay(now).getTime();

    const cards = list.map(s=>{
      const isOngoing = isToday && nowMin>=s.start && nowMin<s.end;
      const isDone = isToday && nowMin>=s.end;
      const key = markKeyFor(dateIso, s);
      const status = attendance[key];

      const canMark = isToday ? (nowMin>=s.start) : dayHasStarted;

      let statusLine = "";
      if(isOngoing) statusLine = `<div class="cc-status live">● in progress</div>`;
      else if(isDone) statusLine = `<div class="cc-status">finished</div>`;
      else statusLine = `<div class="cc-status">upcoming</div>`;

      return `
      <div class="class-card ${isOngoing?'now':''} ${isDone && !isOngoing?'done':''}">
        <div class="tile ${s.type}"><div class="num">${fmtHM(s.start).split(' ')[0]}</div><div class="code">${tileCode(s.code)}</div></div>
        <div class="cc-body">
          <div class="cc-top">
            <span class="cc-code">${s.code}</span>
            ${nameSpan(s.code,'cc-name')}
            <span class="cc-tag ${s.type}">${s.tag || s.type}</span>
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
      const list = scheduleForDay(d);
      html += `<div class="week-day">
        <div class="week-day-head"><h3>${DAY_NAMES[d]}</h3><span class="count">${list.length} session${list.length!==1?'s':''}</span></div>
        <div class="week-list">
          ${list.length ? list.map(s=>`
            <div class="week-item">
              <span class="t">${fmtHM(s.start)}</span>
              <span class="mid">
                <span class="dot ${s.type}"></span>
                <span class="nm-wrap"><span class="nm-code">${s.code}</span>${nameSpan(s.code,'nm')}</span>
              </span>
              <span class="rm">${s.room}</span>
            </div>`).join("") : `<div style="color:var(--text-faint); font-size:12.5px;">— no sessions —</div>`}
        </div>
      </div>`;
    }
    wrap.innerHTML = html;
  }

  let attSelectedDate = new Date();

  function computeStats(){
    const stats = {};
    activeCourseCodes().forEach(c=> stats[c] = {present:0, total:0});
    let totalPresent=0, totalMarked=0;
    Object.keys(attendance).forEach(key=>{
      const [, code] = key.split("|");
      const val = attendance[key];
      if(val==='c') return;
      if(!stats[code]) stats[code]={present:0,total:0};
      stats[code].total++;
      if(val==='p'){ stats[code].present++; totalPresent++; }
      totalMarked++;
    });
    return { stats, totalPresent, totalMarked };
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

    document.getElementById('overallBar').innerHTML = `
      <div class="overall-top">
        <div>Overall attendance</div>
        <div class="big" style="color:${overallColor}">${totalMarked? overallPct+'%' : '—'}</div>
      </div>
      <div class="overall-track"><div class="overall-fill" style="width:${overallPct}%; background:${overallColor}"></div></div>
      <div style="font-size:11.5px; color:var(--text-faint); font-family:var(--mono); margin-top:8px;">
        ${totalMarked ? totalPresent+' present of '+totalMarked+' marked sessions' : 'No sessions marked yet — start below.'}
      </div>
    `;

    const statGrid = document.getElementById('statGrid');
    statGrid.innerHTML = activeCourseCodes().map(code=>{
      const st = stats[code] || {present:0,total:0};
      const pct = st.total ? Math.round(st.present/st.total*100) : null;
      const color = pct===null ? 'var(--text-faint)' : pct>=75 ? 'var(--green)' : pct>=60 ? 'var(--amber)' : 'var(--rose)';
      const warn = pct!==null && pct<75;
      return `
      <div class="stat-card ${warn?'warn':''}">
        <div class="gauge">${gaugeSVG(pct||0, color)}<div class="pct" style="color:${color}">${pct===null?'–':pct+'%'}</div></div>
        <div>
          <div class="code"><span class="stat-code">${code}</span>${nameSpan(code,'stat-name')}</div>
          <div class="sub">${st.present}/${st.total||0} sessions</div>
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

  function renderAttendanceDay(){
    const d = attSelectedDate;
    const dow = d.getDay();
    const { main, rel } = fmtDayLabel(d);
    document.getElementById('dateLabel').innerHTML = `${main}<span class="rel">${rel}</span>`;
    const wrap = document.getElementById('attendanceDayWrap');
    const list = scheduleForDay(dow);
    if(dow===0||dow===6 || list.length===0){
      wrap.innerHTML = `<div class="empty-state" style="padding:24px;">No 2nd-year sessions on this date.</div>`;
      return;
    }
    const dateIso = isoDate(d);
    const isFuture = startOfDay(d).getTime() > startOfDay(now).getTime();
    wrap.innerHTML = list.map(s=>{
      const key = markKeyFor(dateIso, s);
      const status = attendance[key];
      return `
      <div class="class-card">
        <div class="tile ${s.type}"><div class="num">${fmtHM(s.start).split(' ')[0]}</div><div class="code">${tileCode(s.code)}</div></div>
        <div class="cc-body">
          <div class="cc-top"><span class="cc-code">${s.code}</span>${nameSpan(s.code,'cc-name')}<span class="cc-tag ${s.type}">${s.tag || s.type}</span></div>
          <div class="cc-meta">${fmtHM(s.start)}–${fmtHM(s.end)} · ${s.room}</div>
        </div>
        <div class="mark-group">
          <button class="mark-btn p ${status==='p'?'active':''}" ${isFuture?'disabled':''} data-key="${key}" data-val="p" title="Present">✓</button>
          <button class="mark-btn a ${status==='a'?'active':''}" ${isFuture?'disabled':''} data-key="${key}" data-val="a" title="Absent">✕</button>
          <button class="mark-btn c ${status==='c'?'active':''}" ${isFuture?'disabled':''} data-key="${key}" data-val="c" title="Cancelled">⊘</button>
        </div>
      </div>`;
    }).join("");

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
  }

  function renderAll(){
    if(!currentUser) return;
    buildDayRow();
    renderNowTimeline();
    renderWeek();
    renderAttendanceView();
    renderCreditsView();
    renderHero();
  }

  setInterval(tickClock, 1000);
  tickClock();
  tryAutoLogin();

})();
