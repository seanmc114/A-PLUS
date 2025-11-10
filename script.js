/* Turbo: A+ Edition — full working script
   - Tense selector works
   - Level unlocks with targets (A2=240s, each next -20s)
   - Timer + 30s penalties per wrong/blank
   - Best times saved per tense+level
   - Accents required, case-insensitive, ñ≡n allowed
   - Results-only sound + feedback
*/

// ---------- Config ----------

// Level order (A1 always available; the rest unlock sequentially)
const LEVELS = ["A1", "A2", "Level 3", "B1", "B2", "Level 6", "C1", "C2", "Final Boss"];

// Unlock targets requested: A2 starts at 240s and each next level reduces by 20s.
const UNLOCK_TARGETS = {
  A2: 240,
  "Level 3": 220,
  B1: 200,
  B2: 180,
  "Level 6": 160,
  C1: 140,
  C2: 120,
  "Final Boss": 100
};

// Penalty (seconds) per wrong/blank answer
const PENALTY_SECONDS = 30;

// Number of questions per test
const QUESTIONS_PER_TEST = 10;

// Small bilingual dataset (non-interrogative statements). Keep it lean but valid.
// We pick a random 10 for each run; if a level lacks 10, we reuse from same tense pool.
const DATA = {
  Present: {
    // Basic A1-friendly statements
    pool: [
      { en: "I am (ser)", es: "soy" },
      { en: "you are (ser)", es: "eres" },
      { en: "he is (ser)", es: "es" },
      { en: "we are (ser)", es: "somos" },
      { en: "they are (ser)", es: "son" },
      { en: "I have", es: "tengo" },
      { en: "you have", es: "tienes" },
      { en: "he has", es: "tiene" },
      { en: "we go", es: "vamos" },
      { en: "I go", es: "voy" },
      { en: "they go", es: "van" },
      { en: "I want", es: "quiero" },
      { en: "we want", es: "queremos" },
      { en: "they want", es: "quieren" },
      { en: "I can", es: "puedo" },
      { en: "we can", es: "podemos" }
    ]
  },
  Past: {
    // Use preterite/estuv- to avoid the "fui = I was" ambiguity
    pool: [
      { en: "I went", es: "fui" },
      { en: "we went", es: "fuimos" },
      { en: "I had", es: "tuve" },
      { en: "he had", es: "tuvo" },
      { en: "we had", es: "tuvimos" },
      { en: "they had", es: "tuvieron" },
      { en: "I was (estar)", es: "estuve" },
      { en: "we were (estar)", es: "estuvimos" },
      { en: "they were (estar)", es: "estuvieron" },
      { en: "I did", es: "hice" },
      { en: "we did", es: "hicimos" }
    ]
  },
  Future: {
    pool: [
      { en: "I will go", es: "iré" },
      { en: "we will go", es: "iremos" },
      { en: "I will have", es: "tendré" },
      { en: "they will have", es: "tendrán" },
      { en: "we will have", es: "tendremos" },
      { en: "I will be (ser)", es: "seré" },
      { en: "we will be (ser)", es: "seremos" },
      { en: "I will be (estar)", es: "estaré" },
      { en: "they will be (estar)", es: "estarán" },
      { en: "we will do", es: "haremos" },
      { en: "I will do", es: "haré" }
    ]
  }
};

// For simplicity, all levels reuse the same tense pool. If you later want level-specific pools,
// add keys like Present.A2 = [...], and this script will prefer level-specific before the generic pool.

// ---------- State ----------

let currentTense = "Present";
let currentLevel = null;
let startTimeMs = 0;
let timerId = null;
let currentQuestions = []; // [{en, es, id}]
let finished = false;

// ---------- Elements ----------

const elLevelList = document.getElementById("level-list");
const elTimer = document.getElementById("timer");
const elGame = document.getElementById("game");
const elQuestions = document.getElementById("questions");
const elResults = document.getElementById("results");
const elSubmit = document.getElementById("submit");
const elBack = document.getElementById("back-button");

// ---------- Utilities ----------

const keyBest = (tense, level) => `bestTime_${tense}_${level}`;

function readBest(tense, level) {
  const v = localStorage.getItem(keyBest(tense, level));
  return v ? Number(v) : null;
}

function writeBest(tense, level, seconds) {
  const prev = readBest(tense, level);
  if (prev === null || seconds < prev) {
    localStorage.setItem(keyBest(tense, level), String(seconds));
  }
}

function msToSeconds(ms) {
  return Math.round(ms / 1000);
}

function formatSeconds(s) {
  return `${s}s`;
}

// Accents required; case-insensitive; allow ñ≡n only:
function normalizeForCheck(s) {
  return s.trim().toLowerCase().replace(/ñ/g, "n");
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Prefer level-specific pool if present, else fall back to generic pool for the tense.
function getQuestionPool(tense, level) {
  const t = DATA[tense] || {};
  if (Array.isArray(t[level])) return t[level];
  if (Array.isArray(t.pool)) return t.pool;
  return [];
}

function sampleQuestions(tense, level, n) {
  const pool = getQuestionPool(tense, level);
  if (pool.length === 0) return [];
  const bag = pool.length >= n ? shuffle(pool).slice(0, n) : shuffle(pool).slice(0); // take all
  // If not enough to reach n, reuse more from pool
  while (bag.length < n) {
    bag.push(pool[bag.length % pool.length]);
  }
  // Give each a unique id for input mapping
  return bag.map((q, i) => ({ ...q, id: `q_${i}` }));
}

// ---------- Unlock logic ----------

function computeUnlockedLevels(tense) {
  // A1 is always unlocked
  const unlocked = new Set(["A1"]);
  // Walk forward; to unlock NEXT, you must have best time for CURRENT <= target for NEXT
  for (let i = 1; i < LEVELS.length; i++) {
    const prevLevel = LEVELS[i - 1];
    const thisLevel = LEVELS[i];
    const target = UNLOCK_TARGETS[thisLevel];
    // If no target defined (e.g. A1), skip check (will handle via previous).
    if (target == null) continue;
    const bestPrev = readBest(tense, prevLevel);
    if (typeof bestPrev === "number" && bestPrev <= target) {
      unlocked.add(thisLevel);
    } else {
      break; // locking is sequential
    }
  }
  return unlocked;
}

// ---------- Rendering ----------

function renderLevelList() {
  elGame.style.display = "none";
  elResults.innerHTML = "";
  finished = false;
  const unlocked = computeUnlockedLevels(currentTense);

  elLevelList.innerHTML = "";
  const frag = document.createDocumentFragment();

  LEVELS.forEach((level, idx) => {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.setAttribute("data-level", level);

    const best = readBest(currentTense, level);
    const target = UNLOCK_TARGETS[level]; // may be undefined (A1)

    const isUnlocked = unlocked.has(level);
    btn.disabled = !isUnlocked;

    btn.textContent = `${level}`;
    const label = document.createElement("div");
    label.style.fontSize = "0.9rem";
    label.style.opacity = "0.85";
    label.style.marginTop = "4px";

    const parts = [];
    if (best != null) parts.push(`Best: ${formatSeconds(best)}`);
    if (target != null) {
      if (idx === 0) {
        // A1 shows no target (it doesn't need one)
      } else {
        parts.push(`Target to open next: ${formatSeconds(target)}`);
      }
    }
    label.textContent = parts.join(" • ");

    if (!isUnlocked) {
      btn.style.opacity = "0.5";
      btn.title = "Locked — beat the previous level's target to unlock";
    }

    btn.addEventListener("click", () => startLevel(level));

    const wrap = document.createElement("div");
    wrap.appendChild(btn);
    if (parts.length) wrap.appendChild(label);

    frag.appendChild(wrap);
  });

  elLevelList.appendChild(frag);
}

function renderQuestions(questions) {
  elQuestions.innerHTML = "";
  const list = document.createElement("div");
  questions.forEach((q, i) => {
    const row = document.createElement("div");
    row.style.margin = "12px 0";
    const prompt = document.createElement("div");
    prompt.textContent = `${i + 1}. ${q.en}`;
    const input = document.createElement("input");
    input.type = "text";
    input.setAttribute("data-qid", q.id);
    input.placeholder = "Type Spanish… (accents required; 'n' allowed for 'ñ')";
    input.autocomplete = "off";
    row.appendChild(prompt);
    row.appendChild(input);
    list.appendChild(row);
  });
  elQuestions.appendChild(list);
}

// ---------- Game flow ----------

function startLevel(level) {
  currentLevel = level;
  currentQuestions = sampleQuestions(currentTense, currentLevel, QUESTIONS_PER_TEST);
  if (currentQuestions.length === 0) {
    alert(`No data for ${currentTense} — please add items to DATA.${currentTense}.pool`);
    return;
  }

  elLevelList.innerHTML = "";
  renderQuestions(currentQuestions);
  elGame.style.display = "block";
  elResults.innerHTML = "";
  elBack.style.display = "none";
  finished = false;

  // Start timer
  startTimeMs = Date.now();
  elTimer.textContent = "0s";
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    if (finished) return;
    const diff = Date.now() - startTimeMs;
    elTimer.textContent = formatSeconds(msToSeconds(diff));
  }, 200);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function evaluate() {
  // Gather answers
  const inputs = elQuestions.querySelectorAll("input[data-qid]");
  const items = currentQuestions.map((q) => {
    const inp = Array.from(inputs).find((el) => el.getAttribute("data-qid") === q.id);
    const user = (inp?.value ?? "").trim();
    const ok =
      normalizeForCheck(user) === normalizeForCheck(q.es) &&
      user.length > 0; // avoid counting empty with equality quirks
    return {
      en: q.en,
      expect: q.es,
      user,
      correct: ok
    };
  });

  const wrongCount = items.filter((x) => !x.correct).length;

  // Final time: base elapsed + penalties
  const elapsedMs = Date.now() - startTimeMs;
  const baseSeconds = msToSeconds(elapsedMs);
  const finalSeconds = baseSeconds + wrongCount * PENALTY_SECONDS;

  // Save best
  writeBest(currentTense, currentLevel, finalSeconds);

  // Results UI
  renderResults(items, baseSeconds, wrongCount, finalSeconds);

  // Done
  finished = true;
  stopTimer();
  elBack.style.display = "inline-block";
  elBack.focus();

  // Play a tiny chime (results-only)
  try {
    playResultsChime(wrongCount === 0);
  } catch (_) {}
}

function renderResults(items, baseSeconds, wrongCount, finalSeconds) {
  const bestNow = readBest(currentTense, currentLevel);

  const wrap = document.createElement("div");
  wrap.style.marginTop = "16px";
  wrap.innerHTML = `
    <h2>Results</h2>
    <p>Base time: <strong>${formatSeconds(baseSeconds)}</strong></p>
    <p>Penalties: <strong>${wrongCount} × ${PENALTY_SECONDS}s = ${formatSeconds(
    wrongCount * PENALTY_SECONDS
  )}</strong></p>
    <p>Final time: <strong>${formatSeconds(finalSeconds)}</strong></p>
    <p>Best (${currentTense} • ${currentLevel}): <strong>${bestNow != null ? formatSeconds(bestNow) : "—"}</strong></p>
    <hr/>
  `;

  const list = document.createElement("div");
  items.forEach((it, i) => {
    const row = document.createElement("div");
    row.style.margin = "8px 0";
    row.style.textAlign = "left";
    const isOk = it.correct;
    row.innerHTML = `
      <div><strong>${i + 1}. ${it.en}</strong></div>
      <div>Your answer: ${it.user ? escapeHtml(it.user) : "<em>(blank)</em>"} ${isOk ? "✅" : "❌"}</div>
      ${isOk ? "" : `<div>Expected: <strong>${escapeHtml(it.expect)}</strong></div>`}
    `;
    list.appendChild(row);
  });

  wrap.appendChild(list);
  elResults.innerHTML = "";
  elResults.appendChild(wrap);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Sounds (results-only) ----------

function playResultsChime(perfect) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.connect(g);
  g.connect(ctx.destination);

  const now = ctx.currentTime;

  if (perfect) {
    // Two-note up glide
    o.frequency.setValueAtTime(660, now);
    o.frequency.linearRampToValueAtTime(880, now + 0.18);
  } else {
    // Single short tone
    o.frequency.setValueAtTime(440, now);
  }
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  o.start(now);
  o.stop(now + 0.27);
}

// ---------- Events ----------

document.querySelectorAll(".tense-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const t = btn.getAttribute("data-tense");
    if (!DATA[t]) {
      alert(`No data for tense: ${t}`);
      return;
    }
    currentTense = t;
    renderLevelList();
  });
});

// Submit / Finish
elSubmit.addEventListener("click", () => {
  if (!currentLevel) return;
  evaluate();
});

// Back to level list
elBack.addEventListener("click", () => {
  currentLevel = null;
  renderLevelList();
  elGame.style.display = "none";
});

// Initial render
renderLevelList();
elGame.style.display = "none";
elResults.innerHTML = "";

// ---------- (Optional) Patch unlock targets into localStorage for other builds ----------
(function syncUnlockTargetsToLocalStorage() {
  try {
    const existing = JSON.parse(localStorage.getItem("unlockTargets") || "{}");
    const merged = { ...existing, ...UNLOCK_TARGETS };
    localStorage.setItem("unlockTargets", JSON.stringify(merged));
  } catch (_) {}
})();
