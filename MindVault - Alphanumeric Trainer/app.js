let mode = 'mixed';
let length = 10;
let seconds = 8;
let spacedOn = false;
let current = null; // {seq, id}
let revealTimer = null;

const modeEl = document.getElementById('mode');
const lenEl = document.getElementById('length');
const secEl = document.getElementById('seconds');
const spacedToggle = document.getElementById('spacedToggle');
const startBtn = document.getElementById('startBtn');
const nextBtn = document.getElementById('nextBtn');
const seqEl = document.getElementById('sequence');
const infoEl = document.getElementById('info');
const answerInput = document.getElementById('answerInput');
const checkBtn = document.getElementById('checkBtn');
const feedbackEl = document.getElementById('feedback');
const statsEl = document.getElementById('stats');

// Sync UI values on load
window.addEventListener('DOMContentLoaded', () => {
  mode = (modeEl.value || 'mixed').trim().toLowerCase();
  length = clampInt(lenEl.value, 1, 150, 10);
  seconds = clampInt(secEl.value, 1, 60, 8);
  updateInfo();
});

modeEl.onchange = () => { mode = (modeEl.value||'mixed').trim().toLowerCase(); updateInfo(); };
lenEl.onchange = () => { length = clampInt(lenEl.value, 1, 150, 10); updateInfo(); };
secEl.onchange = () => { seconds = clampInt(secEl.value, 1, 60, 8); updateInfo(); };
spacedToggle.onchange = () => spacedOn = spacedToggle.checked;
startBtn.onclick = () => startRound();
nextBtn.onclick = () => { if(revealTimer){ clearTimeout(revealTimer); revealTimer=null; } feedback('Skipping to next sequence…'); startRound(); };
checkBtn.onclick = () => checkAnswer();
answerInput.addEventListener('keydown', e => { if(e.key==='Enter') checkAnswer(); });

function updateInfo(){
  infoEl.textContent = `Mode: ${mode} | Length: ${length} | Show: ${seconds}s`;
}

function clampInt(val, min, max, fallback){
  const n = parseInt(val, 10);
  if(isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function generateSeq(len, modeStr){
  const m = (modeStr||'').trim().toLowerCase();
  let chars = '';
  if(m==='numbers') chars = '0123456789';
  else if(m==='letters') chars = 'abcdefghijklmnopqrstuvwxyz';
  else chars = 'abcdefghijklmnopqrstuvwxyz0123456789'; // mixed default
  let out = '';
  for(let i=0;i<len;i++){
    out += chars[Math.floor(Math.random()*chars.length)];
  }
  return out;
}

function chooseNext(){
  // ensure we use current UI values in case something desynced
  mode = (modeEl.value||mode||'mixed').trim().toLowerCase();
  length = clampInt(lenEl.value, 1, 150, length||10);
  seconds = clampInt(secEl.value, 1, 60, seconds||8);
  updateInfo();

  if(!spacedOn){
    return { id: cryptoRandomId(), seq: generateSeq(length, mode), attempts:0, correct:0, streak:0, box:0 };
  }
  const all = loadQueue();
  if(all.length){
    const pool = [];
    all.forEach(item => {
      const b = item.box || 0;
      const st = item.streak || 0;
      const base = b===0?5:(b===1?2:1);
      const boost = Math.max(0, 2 - Math.min(2, st));
      const w = base + boost;
      for(let i=0;i<w;i++) pool.push(item);
    });
    return pool[Math.floor(Math.random()*pool.length)];
  }
  const fresh = { id: cryptoRandomId(), seq: generateSeq(length, mode), attempts:0, correct:0, streak:0, box:0 };
  saveItem(fresh);
  return fresh;
}

function startRound(){
  current = chooseNext();
  feedback('');
  seqEl.textContent = current.seq;
  seqEl.classList.remove('hidden');
  answerInput.value='';
  answerInput.disabled = true;
  checkBtn.disabled = true;
  startBtn.disabled = true;
  nextBtn.disabled = false;

  revealTimer = setTimeout(()=>{
    seqEl.classList.add('hidden');
    answerInput.disabled = false;
    checkBtn.disabled = false;
    answerInput.focus();
    revealTimer = null;
  }, seconds*1000);
}

function checkAnswer(){
  const ans = (answerInput.value||'').trim().toLowerCase();
  const target = (current.seq||'').trim().toLowerCase();

  seqEl.classList.remove('hidden');

  const correctCount = longestPrefixMatch(target, ans);
  const accuracy = Math.round((correctCount/target.length)*100);
  const ok = ans === target;

  if(ok){
    feedback(`Correct! ✅ (${accuracy}% accuracy)`, false);
  } else {
    feedback(`Not quite. (${accuracy}%) The sequence was: ${target}`, true);
  }

  bumpGlobal(ok);
  if(spacedOn){ updateItemStats(current, ok); }

  startBtn.disabled = false;
  nextBtn.disabled = false;
  checkBtn.disabled = true;
  answerInput.disabled = true;
  updateStats();
}

function longestPrefixMatch(a,b){
  const n = Math.min(a.length,b.length);
  let i=0; for(; i<n; i++){ if(a[i]!==b[i]) break; }
  return i;
}

function feedback(msg, bad=false){
  feedbackEl.textContent = msg || '';
  feedbackEl.className = 'feedback ' + (bad?'bad':'ok');
}

function bumpGlobal(win){
  const key='mv-lite-global';
  const s = JSON.parse(localStorage.getItem(key)||'{"played":0,"wins":0}');
  s.played += 1; s.wins += win?1:0;
  localStorage.setItem(key, JSON.stringify(s));
}

function updateStats(){
  const s = JSON.parse(localStorage.getItem('mv-lite-global')||'{"played":0,"wins":0}');
  const acc = Math.round((s.wins/Math.max(1,s.played))*100);
  statsEl.textContent = `Attempts: ${s.played} | Correct: ${s.wins} | Accuracy: ${acc}%`;
}

// Spaced repetition storage
function loadQueue(){ return JSON.parse(localStorage.getItem('mv-lite-queue') || '[]'); }
function saveQueue(arr){ localStorage.setItem('mv-lite-queue', JSON.stringify(arr)); }
function saveItem(item){ const q = loadQueue(); q.push(item); saveQueue(q); }
function updateItemStats(item, ok){
  let q = loadQueue();
  const idx = q.findIndex(x => x.id === item.id);
  if(idx === -1){ q.push(item); }
  const ref = q[idx === -1 ? q.length-1 : idx];
  ref.attempts = (ref.attempts||0)+1;
  if(ok){
    ref.correct = (ref.correct||0)+1;
    ref.streak = (ref.streak||0)+1;
    if(ref.box < 2 && ref.streak >= 2) ref.box += 1;
  } else {
    ref.streak = 0;
    ref.box = 0;
    ref.seq = generateSeq(length, mode);
  }
  saveQueue(q);
}

function cryptoRandomId(){
  const a = new Uint8Array(12);
  (window.crypto||window.msCrypto).getRandomValues(a);
  return Array.from(a).map(x => x.toString(16).padStart(2,'0')).join('');
}

// init
updateStats();
