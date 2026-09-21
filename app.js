const APP_VERSION = "v27";
const STORAGE_KEY = "kfz_progress_v1";
const SIM_COUNT_KEY = "kfz_sim_count_v1";
const ALL_TOPIC = "__all__";
const DB_URL = "https://kfz-lernen-default-rtdb.europe-west1.firebasedatabase.app";
const CLOUD_SYNC_INTERVAL_MS = 2 * 60 * 1000; // alle 2 Minuten mit dem anderen Profil abgleichen

const PROFILES = {
  tim: { name: "Tim", color: "var(--accent)", avatar: "icons/avatar-tim.jpg" },
  huseyn: { name: "Huseyn", color: "var(--merk)", avatar: "icons/avatar-huseyn.jpg" },
};
let currentProfile = null;

const ICONS = [
  [/brems|abs\b/i, "🛑"],
  [/getriebe|kupplung/i, "⚙️"],
  [/motor|antrieb|verbrennung|zylinder/i, "🏎️"],
  [/elektr|bordnetz|start|lade|batterie/i, "⚡"],
  [/klima|komfort/i, "❄️"],
  [/sicherheit|airbag|unfall/i, "🛡️"],
  [/fahrwerk|lenkung|feder|stoßdämpfer/i, "🛞"],
  [/diagnose|fehler|obd/i, "🩺"],
  [/wiso|sozial|wirtschaft|recht|kunde/i, "📘"],
  [/hu\b|prüfung|abnahme/i, "✅"],
  [/reifen|rad/i, "🛞"],
  [/abgas|umwelt/i, "🌫️"],
];

function iconForCategory(name) {
  const hit = ICONS.find(([re]) => re.test(name));
  return hit ? hit[1] : "🔧";
}

const els = {
  profileGate: document.getElementById("profileGate"),
  profileButtons: document.querySelectorAll(".profile-btn"),
  activeProfileBadge: document.getElementById("activeProfileBadge"),
  settingsProfileName: document.getElementById("settingsProfileName"),
  switchProfileBtn: document.getElementById("switchProfileBtn"),

  tabButtons: document.querySelectorAll(".tab-btn"),
  tabHome: document.getElementById("tabHome"),
  tabStats: document.getElementById("tabStats"),
  tabExplain: document.getElementById("tabExplain"),
  tabSettings: document.getElementById("tabSettings"),

  explainList: document.getElementById("explainList"),
  explainView: document.getElementById("explainView"),
  explainBackBtn: document.getElementById("explainBackBtn"),
  explainContent: document.getElementById("explainContent"),

  heroBtn: document.getElementById("heroBtn"),
  heroRingFill: document.getElementById("heroRingFill"),
  heroRingPct: document.getElementById("heroRingPct"),
  simBtn: document.getElementById("simBtn"),
  merkBtn: document.getElementById("merkBtn"),
  merkCount: document.getElementById("merkCount"),
  topicList: document.getElementById("topicList"),
  noTopics: document.getElementById("noTopics"),

  battleVersus: document.getElementById("battleVersus"),
  battleWinner: document.getElementById("battleWinner"),
  battleTopics: document.getElementById("battleTopics"),
  battleTopicsToggle: document.getElementById("battleTopicsToggle"),

  statsSummary: document.getElementById("statsSummary"),
  statsList: document.getElementById("statsList"),

  simCountInput: document.getElementById("simCountInput"),
  reloadBtn: document.getElementById("reloadBtn"),
  resetBtn: document.getElementById("resetBtn"),

  studyView: document.getElementById("studyView"),
  backBtn: document.getElementById("backBtn"),
  simTimer: document.getElementById("simTimer"),
  simTimerText: document.getElementById("simTimerText"),
  cardArea: document.getElementById("cardArea"),
  emptyState: document.getElementById("emptyState"),
  emptyBackBtn: document.getElementById("emptyBackBtn"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  cardWrap: document.getElementById("cardWrap"),
  flashcard: document.getElementById("flashcard"),
  categoryTag: document.getElementById("categoryTag"),
  categoryTagBack: document.getElementById("categoryTagBack"),
  questionText: document.getElementById("questionText"),
  answerText: document.getElementById("answerText"),
  actionRow: document.getElementById("actionRow"),
  hardBtn: document.getElementById("hardBtn"),
  knownBtn: document.getElementById("knownBtn"),

  mcArea: document.getElementById("mcArea"),
  mcCategoryTag: document.getElementById("mcCategoryTag"),
  mcQuestionText: document.getElementById("mcQuestionText"),
  mcOptions: document.getElementById("mcOptions"),
  mcExplain: document.getElementById("mcExplain"),
  mcExplainText: document.getElementById("mcExplainText"),
  mcNextBar: document.getElementById("mcNextBar"),
  mcNextBtn: document.getElementById("mcNextBtn"),

  resultView: document.getElementById("resultView"),
  resultRingFill: document.getElementById("resultRingFill"),
  resultPct: document.getElementById("resultPct"),
  resultRight: document.getElementById("resultRight"),
  resultWrong: document.getElementById("resultWrong"),
  resultGrade: document.getElementById("resultGrade"),
  resultRepeatBtn: document.getElementById("resultRepeatBtn"),
  resultHomeBtn: document.getElementById("resultHomeBtn"),

  sheetBackdrop: document.getElementById("sheetBackdrop"),
  actionSheet: document.getElementById("actionSheet"),
  sheetTitle: document.getElementById("sheetTitle"),
  sheetStudyBtn: document.getElementById("sheetStudyBtn"),
  sheetWrongBtn: document.getElementById("sheetWrongBtn"),
  sheetResetBtn: document.getElementById("sheetResetBtn"),
  sheetCancelBtn: document.getElementById("sheetCancelBtn"),

  toast: document.getElementById("toast"),
};

// Erzwingt Vollbild-Overlay per Inline-Style, unabhängig von der externen CSS-Datei
// (Absicherung gegen veraltete/gecachte Stylesheets auf einzelnen Geräten).
els.profileGate.style.cssText =
  "position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;" +
  "z-index:999999;background:#000;display:flex;align-items:center;justify-content:center;" +
  "padding:24px;margin:0;box-sizing:border-box;";

let sheetCategory = null;

let allCards = [];
let deck = [];
let currentIndex = 0;
let currentTopic = ALL_TOPIC;
let currentFilter = "all";
let sessionMode = "topic"; // "topic" | "simulation"
let sessionResults = { right: 0, wrong: 0 };
let topicAnsweredCount = 0;
let sessionEndKind = "topic"; // "topic" | "simulation" – welcher Modus gerade beendet wurde
let sessionEndTopic = ALL_TOPIC;
let simInterval = null;
let simRemaining = 0;
let progress = { known: {}, hard: {} };

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${currentProfile}`)) || { known: {}, hard: {} };
  } catch {
    return { known: {}, hard: {} };
  }
}

function saveProgress() {
  localStorage.setItem(`${STORAGE_KEY}_${currentProfile}`, JSON.stringify(progress));
  pushProgressToCloud();
}

// --- Cloud-Sync (Firebase Realtime Database) ---
// Damit Tim & Huseyn auf getrennten Geräten den Fortschritt des anderen sehen:
// eigene Änderungen werden sofort hochgeladen, der Stand des anderen Profils
// wird regelmäßig im Hintergrund abgeholt und lokal gecacht.

let cloudSyncWarned = false;

function warnCloudSyncOnce(reason) {
  console.warn("Cloud-Sync fehlgeschlagen:", reason);
  if (cloudSyncWarned) return;
  cloudSyncWarned = true;
  showToast("⚠️ Online-Abgleich klappt gerade nicht", 3000);
}

// Verschmilzt zwei Fortschritts-Stände, ohne je gelernte Karten zu verlieren:
// "known" gewinnt immer, "hard" nur wenn die Karte nirgends schon "known" ist.
function mergeProgress(a, b) {
  const known = { ...(a.known || {}), ...(b.known || {}) };
  const hard = {};
  Object.keys({ ...(a.hard || {}), ...(b.hard || {}) }).forEach((id) => {
    if (!known[id]) hard[id] = true;
  });
  return { known, hard };
}

function pushProgressToCloud() {
  if (!currentProfile) return;
  fetch(`${DB_URL}/progress/${currentProfile}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(progress),
  }).then((res) => {
    if (!res.ok) warnCloudSyncOnce(`Upload HTTP ${res.status}`);
  }).catch((e) => warnCloudSyncOnce(e.message || "Upload fehlgeschlagen"));
}

async function syncFromCloud() {
  try {
    const res = await fetch(`${DB_URL}/progress.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) { warnCloudSyncOnce(`Download HTTP ${res.status}`); return; }
    const data = await res.json();
    if (!data) return;
    let changed = false;

    Object.keys(PROFILES).forEach((id) => {
      if (!data[id]) return;
      if (id === currentProfile) {
        const merged = mergeProgress(progress, data[id]);
        if (JSON.stringify(merged) !== JSON.stringify(progress)) {
          progress = merged;
          localStorage.setItem(`${STORAGE_KEY}_${id}`, JSON.stringify(progress));
          pushProgressToCloud(); // gemergten Stand auch wieder hochladen
          changed = true;
        }
      } else {
        localStorage.setItem(`${STORAGE_KEY}_${id}`, JSON.stringify(data[id]));
        changed = true;
      }
    });

    if (changed) {
      renderHome();
      renderStats();
    }
  } catch (e) {
    warnCloudSyncOnce(e.message || "Offline");
  }
}

function startCloudSync() {
  syncFromCloud();
  clearInterval(startCloudSync._interval);
  startCloudSync._interval = setInterval(syncFromCloud, CLOUD_SYNC_INTERVAL_MS);
}

function showToast(msg, ms = 2000) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { els.toast.hidden = true; }, ms);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function setRing(circleEl, radius, pct) {
  const circ = 2 * Math.PI * radius;
  circleEl.style.strokeDasharray = `${circ} ${circ}`;
  circleEl.style.strokeDashoffset = String(circ * (1 - Math.max(0, Math.min(100, pct)) / 100));
}

// --- Daten laden ---

async function loadCards({ silent = false } = {}) {
  try {
    const res = await fetch(`cards.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("network");
    const data = await res.json();
    const prevCount = allCards.length;
    allCards = data.cards || [];
    renderHome();
    renderStats();
    if (!els.studyView.hidden && sessionMode === "topic") buildDeck();
    if (!silent && prevCount && allCards.length !== prevCount) {
      showToast(`Karten aktualisiert (${allCards.length} insgesamt)`);
    } else if (!silent) {
      showToast("Neue Karten geladen");
    }
  } catch (e) {
    if (!silent) showToast("Keine Verbindung – zeige gespeicherte Karten");
    if (!allCards.length) {
      const cached = localStorage.getItem("kfz_cards_cache");
      if (cached) {
        allCards = JSON.parse(cached).cards || [];
        renderHome();
        renderStats();
      }
    }
    return;
  }
  localStorage.setItem("kfz_cards_cache", JSON.stringify({ cards: allCards }));
}

// --- Tabs ---

const TAB_ORDER = ["tabHome", "tabStats", "tabExplain", "tabSettings"];
const ACTIVE_TAB_KEY = "kfz_active_tab_v1";
let activeTabIndex = 0;

function switchTab(tabId, { remember = true } = {}) {
  activeTabIndex = TAB_ORDER.indexOf(tabId);
  [els.tabHome, els.tabStats, els.tabExplain, els.tabSettings].forEach((el) => {
    el.hidden = el.id !== tabId;
  });
  els.tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
  if (tabId === "tabStats") renderStats();
  if (tabId === "tabExplain") renderExplainList();
  if (remember) localStorage.setItem(ACTIVE_TAB_KEY, tabId);
}

els.tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

els.battleTopicsToggle.addEventListener("click", () => {
  const expanded = els.battleTopicsToggle.getAttribute("aria-expanded") === "true";
  els.battleTopicsToggle.setAttribute("aria-expanded", String(!expanded));
  els.battleTopics.hidden = expanded;
});

// Zwischen den Tabs wischen (wie zwischen iPhone-Homescreen-Seiten)
const tabContent = document.getElementById("tabContent");
let tabTouchStartX = null;
let tabTouchStartY = null;

tabContent.addEventListener("touchstart", (e) => {
  if (!els.studyView.hidden) return;
  tabTouchStartX = e.touches[0].clientX;
  tabTouchStartY = e.touches[0].clientY;
}, { passive: true });

tabContent.addEventListener("touchend", (e) => {
  if (tabTouchStartX === null) return;
  const dx = e.changedTouches[0].clientX - tabTouchStartX;
  const dy = e.changedTouches[0].clientY - tabTouchStartY;
  tabTouchStartX = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0 && activeTabIndex < TAB_ORDER.length - 1) switchTab(TAB_ORDER[activeTabIndex + 1]);
    else if (dx > 0 && activeTabIndex > 0) switchTab(TAB_ORDER[activeTabIndex - 1]);
  }
}, { passive: true });

// --- Home ---

function categories() {
  return Array.from(new Set(allCards.map((c) => c.category || "Allgemein"))).sort();
}

function cardState(id) {
  if (progress.known[id]) return "known";
  if (progress.hard[id]) return "hard";
  return "new";
}

function renderHome() {
  const total = allCards.length;
  const known = allCards.filter((c) => progress.known[c.id]).length;
  const pct = total ? Math.round((known / total) * 100) : 0;
  els.heroRingPct.textContent = pct;
  setRing(els.heroRingFill, 27, pct);
  els.heroBtn.hidden = total === 0;

  const hardCount = allCards.filter((c) => progress.hard[c.id]).length;
  els.merkCount.textContent = hardCount;
  els.simBtn.hidden = total === 0;
  els.merkBtn.hidden = total === 0;

  const cats = categories();
  els.noTopics.hidden = cats.length > 0;
  els.topicList.innerHTML = "";

  cats.forEach((cat) => {
    const cardsInCat = allCards.filter((c) => (c.category || "Allgemein") === cat);
    const knownInCat = cardsInCat.filter((c) => progress.known[c.id]).length;
    const totalInCat = cardsInCat.length;
    const pctCat = totalInCat ? Math.round((knownInCat / totalInCat) * 100) : 0;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "topic-item topic-item-btn";
    item.innerHTML = `
      <div class="topic-item-row">
        <span class="topic-icon">${iconForCategory(cat)}</span>
        <div class="topic-info">
          <div class="topic-name">${escapeHtml(cat)}</div>
          <div class="topic-count">${knownInCat} von ${totalInCat} beherrscht</div>
        </div>
      </div>
      <div class="topic-progress-row">
        <div class="topic-progress-track"><div class="topic-progress-fill" style="width:${pctCat}%"></div></div>
        <span class="topic-pct">${pctCat}%</span>
      </div>
    `;
    item.addEventListener("click", () => openActionSheet(cat));
    els.topicList.appendChild(item);
  });
}

function clearTopicProgress(cat) {
  const cardsInScope = cat === ALL_TOPIC ? allCards : allCards.filter((c) => (c.category || "Allgemein") === cat);
  cardsInScope.forEach((c) => {
    delete progress.known[c.id];
    delete progress.hard[c.id];
  });
  saveProgress();
}

function resetTopicProgress(cat) {
  if (!confirm(`Fortschritt für „${cat}“ zurücksetzen?`)) return;
  clearTopicProgress(cat);
  renderHome();
  showToast("Zurückgesetzt");
}

// --- Battle Mode (Tim vs. Huseyn) ---

function loadProfileProgress(id) {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${id}`)) || { known: {}, hard: {} };
  } catch {
    return { known: {}, hard: {} };
  }
}

function profileStats(id, cardsSubset) {
  const prog = loadProfileProgress(id);
  const known = cardsSubset.filter((c) => prog.known[c.id]).length;
  const hard = cardsSubset.filter((c) => prog.hard[c.id]).length;
  const total = cardsSubset.length;
  const pct = total ? Math.round((known / total) * 100) : 0;
  return { known, hard, total, pct };
}

function battleSideHtml(id, stats, isWinner) {
  return `
    <div class="battle-side">
      <div class="battle-avatar">
        ${isWinner ? '<span class="battle-crown">👑</span>' : ""}
        <img src="${PROFILES[id].avatar}" alt="${escapeHtml(PROFILES[id].name)}">
      </div>
      <div class="battle-name">${escapeHtml(PROFILES[id].name)}</div>
      <div class="battle-pct">${stats.pct}%</div>
      <div class="battle-detail">${stats.known} richtig · ${stats.hard} falsch</div>
    </div>
  `;
}

function renderBattle() {
  const ids = Object.keys(PROFILES);
  if (ids.length < 2) return;
  const [a, b] = ids;
  const statsA = profileStats(a, allCards);
  const statsB = profileStats(b, allCards);

  const winnerId = statsA.pct === statsB.pct ? null : (statsA.pct > statsB.pct ? a : b);

  els.battleVersus.innerHTML =
    battleSideHtml(a, statsA, winnerId === a) +
    '<div class="battle-vs">VS</div>' +
    battleSideHtml(b, statsB, winnerId === b);

  if (!statsA.total) {
    els.battleWinner.className = "battle-winner tie";
    els.battleWinner.textContent = "Noch keine Karten zum Vergleichen";
  } else if (winnerId === null) {
    els.battleWinner.className = "battle-winner tie";
    els.battleWinner.textContent = `🤝 Unentschieden – beide bei ${statsA.pct}%`;
  } else {
    const winnerStats = winnerId === a ? statsA : statsB;
    const loserStats = winnerId === a ? statsB : statsA;
    els.battleWinner.className = "battle-winner";
    els.battleWinner.textContent = `🏆 ${PROFILES[winnerId].name} führt mit ${winnerStats.pct}% (vs. ${loserStats.pct}%)`;
  }

  els.battleTopics.innerHTML = "";
  categories().forEach((cat) => {
    const cardsInCat = allCards.filter((c) => (c.category || "Allgemein") === cat);
    const sA = profileStats(a, cardsInCat);
    const sB = profileStats(b, cardsInCat);
    const row = document.createElement("div");
    row.className = "battle-topic-row";
    row.innerHTML = `
      <div class="battle-topic-name">${escapeHtml(cat)}</div>
      <div class="battle-bar-line">
        <span class="battle-bar-name">${escapeHtml(PROFILES[a].name)}</span>
        <div class="battle-bar-track"><div class="battle-bar-fill" style="width:${sA.pct}%;background:${PROFILES[a].color}"></div></div>
        <span class="battle-bar-pct">${sA.pct}%</span>
      </div>
      <div class="battle-bar-line">
        <span class="battle-bar-name">${escapeHtml(PROFILES[b].name)}</span>
        <div class="battle-bar-track"><div class="battle-bar-fill" style="width:${sB.pct}%;background:${PROFILES[b].color}"></div></div>
        <span class="battle-bar-pct">${sB.pct}%</span>
      </div>
    `;
    els.battleTopics.appendChild(row);
  });
}

// --- Statistik ---

function renderStats() {
  renderBattle();

  const total = allCards.length;
  const known = allCards.filter((c) => progress.known[c.id]).length;
  const hard = allCards.filter((c) => progress.hard[c.id]).length;

  els.statsSummary.innerHTML = `
    <div class="stat-tile"><div class="stat-value">${total}</div><div class="stat-label">Karten</div></div>
    <div class="stat-tile"><div class="stat-value" style="color:var(--right)">${known}</div><div class="stat-label">gelernt</div></div>
    <div class="stat-tile"><div class="stat-value" style="color:var(--wrong)">${hard}</div><div class="stat-label">unsicher</div></div>
  `;

  els.statsList.innerHTML = "";
  categories().forEach((cat) => {
    const cardsInCat = allCards.filter((c) => (c.category || "Allgemein") === cat);
    const knownInCat = cardsInCat.filter((c) => progress.known[c.id]);
    const hardInCat = cardsInCat.filter((c) => progress.hard[c.id]);
    const totalInCat = cardsInCat.length;
    const openInCat = totalInCat - knownInCat.length - hardInCat.length;
    const pctRight = totalInCat ? (knownInCat.length / totalInCat) * 100 : 0;
    const pctWrong = totalInCat ? (hardInCat.length / totalInCat) * 100 : 0;

    const row = document.createElement("div");
    row.className = "stats-row";
    row.innerHTML = `
      <div class="stats-row-top">
        <span class="stats-icon">${iconForCategory(cat)}</span>
        <span class="name">${escapeHtml(cat)}</span>
        <span class="count">${knownInCat.length}/${totalInCat}</span>
      </div>
      <div class="stats-bar-segmented">
        <span class="seg-right" style="width:${pctRight}%"></span>
        <span class="seg-wrong" style="width:${pctWrong}%"></span>
      </div>
      <div class="stats-row-meta">
        <span>✅ ${knownInCat.length} richtig</span>
        <span>❌ ${hardInCat.length} falsch</span>
        <span>◻️ ${openInCat} offen</span>
      </div>
      <div class="stats-reset-row">
        <button type="button" class="btn btn-outline stats-wrong-btn">📋 Falsche Fragen üben</button>
        <button type="button" class="btn btn-outline stats-reset-btn">↺ Antworten zurücksetzen (0 richtig, 0 falsch)</button>
      </div>
    `;
    row.querySelector(".stats-wrong-btn").addEventListener("click", () => openTopic(cat, "hard"));
    row.querySelector(".stats-reset-btn").addEventListener("click", () => {
      resetTopicProgress(cat);
      renderStats();
    });
    els.statsList.appendChild(row);
  });
}

// --- Erklärungen ---

const EXPLANATIONS = {
  "Motor": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Motor</h1>
    <p class="explain-lead">Der Verbrennungsmotor wandelt die im Kraftstoff gespeicherte chemische Energie durch Verbrennung in mechanische Energie (Drehbewegung der Kurbelwelle) um. Fast alle Kfz-Motoren arbeiten nach dem Viertakt-Prinzip.</p>

    <h2>Das Viertakt-Prinzip</h2>
    <p>Ein Arbeitsspiel besteht aus vier Kolbenhüben (= zwei Kurbelwellenumdrehungen = 720°):</p>
    <div class="explain-diagram">
      <svg viewBox="0 0 400 120" width="100%">
        <g font-family="sans-serif" font-size="11" fill="var(--text)">
          <rect x="10" y="20" width="80" height="70" rx="6" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <line x1="30" y1="30" x2="70" y2="30" stroke="var(--accent)" stroke-width="3"/>
          <rect x="25" y="55" width="40" height="25" fill="var(--accent)" opacity="0.6"/>
          <text x="50" y="105" text-anchor="middle">1. Ansaugen</text>

          <rect x="110" y="20" width="80" height="70" rx="6" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <rect x="125" y="35" width="40" height="25" fill="var(--accent)" opacity="0.6"/>
          <text x="150" y="105" text-anchor="middle">2. Verdichten</text>

          <rect x="210" y="20" width="80" height="70" rx="6" fill="none" stroke="var(--wrong)" stroke-width="2"/>
          <circle cx="250" cy="40" r="6" fill="var(--wrong)"/>
          <rect x="225" y="55" width="40" height="25" fill="var(--accent)" opacity="0.6"/>
          <text x="250" y="105" text-anchor="middle">3. Arbeiten</text>

          <rect x="310" y="20" width="80" height="70" rx="6" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <line x1="330" y1="30" x2="370" y2="30" stroke="var(--right)" stroke-width="3"/>
          <rect x="325" y="35" width="40" height="25" fill="var(--accent)" opacity="0.6"/>
          <text x="350" y="105" text-anchor="middle">4. Ausstoßen</text>
        </g>
      </svg>
      <figcaption>Die vier Takte: Ansaugen (Einlassventil offen) → Verdichten (beide Ventile zu) → Arbeiten (Zündung/Einspritzung, Kolben wird nach unten gedrückt) → Ausstoßen (Auslassventil offen).</figcaption>
    </div>
    <ol>
      <li><strong>1. Takt – Ansaugen:</strong> Einlassventil öffnet, der Kolben bewegt sich vom oberen (OT) zum unteren Totpunkt (UT) und saugt Luft (Diesel) bzw. Luft-Kraftstoff-Gemisch (Benziner) an.</li>
      <li><strong>2. Takt – Verdichten:</strong> Beide Ventile sind geschlossen, der Kolben bewegt sich nach OT und verdichtet das Gasgemisch stark (Ottomotor ca. 8-12:1, Diesel ca. 16-22:1). Dabei steigen Druck und Temperatur.</li>
      <li><strong>3. Takt – Arbeiten (Verbrennung/Expansion):</strong> Beim Ottomotor zündet die Zündkerze das Gemisch, beim Dieselmotor entzündet sich der eingespritzte Kraftstoff durch die hohe Verdichtungswärme selbst (Selbstzündung). Der entstehende Druck drückt den Kolben nach UT – das ist der einzige Takt, der tatsächlich Arbeit verrichtet.</li>
      <li><strong>4. Takt – Ausstoßen:</strong> Auslassventil öffnet, der Kolben schiebt die Abgase nach OT aus dem Zylinder.</li>
    </ol>

    <h2>Ottomotor vs. Dieselmotor</h2>
    <p>Der <strong>Ottomotor</strong> saugt in der Regel ein Luft-Kraftstoff-Gemisch an (bei Direkteinspritzung nur Luft, Kraftstoff wird später eingespritzt) und benötigt zur Zündung eine Zündkerze (Fremdzündung). Der <strong>Dieselmotor</strong> saugt reine Luft an, verdichtet sie stark, wodurch sie sich auf über 700°C erhitzt, und der kurz vor OT eingespritzte Kraftstoff entzündet sich von selbst (Selbstzündung/Kompressionszündung).</p>
    <div class="explain-example"><strong>Beispiel:</strong> Bei einer Prüfungsfrage nach dem Zündverfahren gilt: Ottomotor = Fremdzündung durch Zündkerze, Dieselmotor = Selbstzündung durch Verdichtung. Merke: "Otto zündet, Diesel drückt".</div>

    <h2>Kurbeltrieb</h2>
    <p>Der Kurbeltrieb wandelt die geradlinige (oszillierende) Bewegung des Kolbens in eine Drehbewegung um. Er besteht aus Kolben, Kolbenbolzen, Pleuelstange (Pleuel) und Kurbelwelle. Die Kurbelwelle ist über Kurbelwellenlager im Motorblock gelagert und gibt das Drehmoment über das Schwungrad an den Antriebsstrang ab.</p>

    <h2>Ventilsteuerung</h2>
    <p>Die Nockenwelle öffnet und schließt die Ein- und Auslassventile im richtigen Takt. Sie wird über Zahnriemen, Steuerkette oder Zahnräder synchron zur Kurbelwelle angetrieben (bei einer vollen Kurbelwellenumdrehung dreht sich die Nockenwelle nur halb so schnell, da ein Arbeitsspiel zwei Kurbelwellenumdrehungen umfasst). Variable Ventilsteuerungen (z. B. VANOS, VVT-i) passen die Steuerzeiten an die Last an, um Verbrauch, Leistung und Emissionen zu optimieren.</p>

    <h2>Schmierung und Kühlung</h2>
    <p>Der <strong>Ölkreislauf</strong> schmiert bewegte Teile (Kurbelwellenlager, Nockenwelle, Kolben), reduziert Reibung und Verschleiß und transportiert zusätzlich Wärme ab. Die <strong>Kühlung</strong> (meist Wasserkühlung mit Kühlmittelkreislauf, Thermostat, Kühler und Wasserpumpe) hält den Motor im optimalen Betriebstemperaturbereich (ca. 90°C), da sowohl Über- als auch Unterhitzung Verschleiß und Wirkungsgrad negativ beeinflussen.</p>
  `,

  "Motormanagement & Abgasnachbehandlung": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Motormanagement &amp; Abgasnachbehandlung</h1>
    <p class="explain-lead">Das Motorsteuergerät (ECU/Motorsteuergerät) berechnet anhand zahlreicher Sensordaten in Echtzeit Einspritzmenge, Einspritzzeitpunkt und Zündzeitpunkt – mit dem Ziel maximale Effizienz bei minimalen Schadstoffemissionen.</p>

    <h2>Wichtige Sensoren</h2>
    <ul>
      <li><strong>Luftmassenmesser (LMM/HFM):</strong> misst die angesaugte Luftmasse – Grundlage für die richtige Kraftstoffmenge.</li>
      <li><strong>Lambdasonde:</strong> misst den Restsauerstoffgehalt im Abgas und meldet, ob das Gemisch zu fett oder zu mager ist.</li>
      <li><strong>Klopfsensor:</strong> erkennt unkontrollierte Selbstzündung (Klingeln) beim Ottomotor, worauf die Zündung zurückgenommen wird, um Motorschäden zu vermeiden.</li>
      <li><strong>Nockenwellen-/Kurbelwellensensor:</strong> liefert die genaue Motorposition/-drehzahl für den korrekten Zünd- und Einspritzzeitpunkt.</li>
      <li><strong>Ansauglufttemperatur- und Kühlmitteltemperatursensor:</strong> liefern Korrekturwerte, u. a. für die Kaltstartanreicherung.</li>
    </ul>

    <h2>Die Lambdasonde und der Lambda-Wert (λ)</h2>
    <p>Lambda beschreibt das Verhältnis von tatsächlich zugeführter Luftmasse zum theoretischen Luftbedarf. <strong>λ = 1</strong> bedeutet ein stöchiometrisches Gemisch (ca. 14,7 kg Luft je 1 kg Kraftstoff) – optimal für die Funktion des Drei-Wege-Katalysators. λ &lt; 1 = fettes Gemisch (Kraftstoffüberschuss), λ &gt; 1 = mageres Gemisch (Luftüberschuss).</p>
    <div class="explain-example"><strong>Beispiel:</strong> Eine defekte Lambdasonde führt zu falscher Gemischregelung, dadurch steigt der Verbrauch und die Abgaswerte verschlechtern sich – die Motorkontrollleuchte leuchtet und im Fehlerspeicher steht ein Lambda-bezogener Fehlercode.</p>

    <h2>Abgasnachbehandlung beim Ottomotor</h2>
    <p>Der <strong>Drei-Wege-Katalysator</strong> wandelt gleichzeitig drei Schadstoffe um: Kohlenmonoxid (CO) und unverbrannte Kohlenwasserstoffe (HC) werden oxidiert (zu CO₂ und H₂O), Stickoxide (NOx) werden reduziert (zu N₂). Das funktioniert nur zuverlässig bei λ = 1, daher die enge Kopplung mit der Lambdaregelung.</p>

    <h2>Abgasnachbehandlung beim Diesel</h2>
    <p>Da Dieselmotoren mit Luftüberschuss (mager) arbeiten, reicht ein einfacher Katalysator nicht aus. Eingesetzt werden mehrere Systeme:</p>
    <ul>
      <li><strong>Oxidationskatalysator:</strong> oxidiert CO und HC.</li>
      <li><strong>Dieselpartikelfilter (DPF):</strong> filtert Rußpartikel aus dem Abgas und verbrennt sie periodisch bei hoher Temperatur (Regeneration).</li>
      <li><strong>SCR-Katalysator (Selective Catalytic Reduction):</strong> mittels Einspritzung von AdBlue (wässrige Harnstofflösung) werden Stickoxide (NOx) zu Wasser und Stickstoff reduziert.</li>
      <li><strong>Abgasrückführung (AGR):</strong> ein Teil des Abgases wird zurück in den Ansaugtrakt geleitet, senkt die Verbrennungstemperatur und reduziert dadurch die NOx-Bildung.</li>
    </ul>
    <div class="explain-example"><strong>Beispiel:</strong> Leuchtet bei einem AdBlue-Fahrzeug die Warnleuchte "AdBlue nachfüllen" und der Tank wird nicht befüllt, verweigert das Steuergerät nach einer gewissen Anzahl an Startvorgängen den Motorstart – so wird sichergestellt, dass die Abgasgrenzwerte eingehalten werden.</div>

    <h2>Euro-Abgasnormen</h2>
    <p>Die europäischen Abgasnormen (aktuell Euro 6, in Stufen Euro 6d) legen Grenzwerte für CO, HC, NOx und Partikelmasse/-anzahl fest und werden mit jeder neuen Stufe strenger. Sie sind der wesentliche Treiber für die immer aufwendigere Abgasnachbehandlung.</p>
  `,

  "Kraftübertragung": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Kraftübertragung</h1>
    <p class="explain-lead">Der Antriebsstrang überträgt das Motordrehmoment kontrolliert und mit passender Übersetzung auf die Antriebsräder – vom Motor über Kupplung, Getriebe, Wellen und Differential.</p>

    <h2>Kupplung</h2>
    <p>Die Kupplung trennt den Kraftfluss zwischen Motor und Getriebe temporär, damit geschaltet werden kann oder das Fahrzeug im Stand bei laufendem Motor steht. Bei der klassischen <strong>Einscheibentrockenkupplung</strong> presst eine Tellerfeder die Kupplungsscheibe gegen das Schwungrad; beim Treten des Kupplungspedals hebt das Ausrücklager die Anpresskraft auf und die Kupplungsscheibe wird frei.</p>

    <h2>Schaltgetriebe</h2>
    <p>Das Getriebe wandelt die Motordrehzahl/das Drehmoment über verschiedene Zahnradpaarungen (Gänge) in ein für die Fahrsituation passendes Verhältnis um – niedrige Gänge für hohes Drehmoment (Anfahren, Steigung), hohe Gänge für niedrigen Verbrauch bei hoher Geschwindigkeit.</p>
    <ul>
      <li><strong>Manuelles Schaltgetriebe:</strong> der Fahrer schaltet über Kupplungspedal und Schalthebel selbst.</li>
      <li><strong>Automatikgetriebe (Wandlerautomatik):</strong> nutzt einen hydrodynamischen Drehmomentwandler statt einer mechanischen Kupplung und schaltet über Planetenradsätze automatisch.</li>
      <li><strong>Doppelkupplungsgetriebe (DSG/DKG):</strong> besitzt zwei Teilgetriebe mit je einer eigenen Kupplung (für gerade und ungerade Gänge), wodurch nahezu unterbrechungsfrei geschaltet werden kann.</li>
    </ul>
    <div class="explain-example"><strong>Beispiel:</strong> Beim Doppelkupplungsgetriebe ist beim Fahren im 3. Gang der 4. Gang bereits "vorgewählt" und die zugehörige Kupplung eingekuppelt-bereit – beim Hochschalten öffnet einfach die eine Kupplung, während die andere schließt, fast ohne Zugkraftunterbrechung.</div>

    <h2>Gelenkwellen und Differential</h2>
    <p>Bei Front- oder Heckantrieb überträgt die <strong>Kardan-/Gelenkwelle</strong> das Drehmoment vom Getriebe zur Hinterachse (bei Standardantrieb) bzw. verbinden <strong>Antriebswellen (Gleichlaufgelenkwellen)</strong> das Getriebe mit den Rädern. Das <strong>Differential (Ausgleichsgetriebe)</strong> gleicht Drehzahlunterschiede zwischen dem kurveninneren und kurvenäußeren Rad aus, da das äußere Rad in der Kurve einen größeren Weg zurücklegt als das innere.</p>

    <h2>Allradantrieb</h2>
    <p>Beim Allradantrieb wird die Kraft auf alle vier Räder verteilt, meist über ein zusätzliches Mittendifferential oder eine elektronisch gesteuerte Kupplung (Haldex u. Ä.), die das Drehmoment je nach Traktionsbedarf variabel zwischen Vorder- und Hinterachse verteilt.</p>
  `,

  "Fahrwerk": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Fahrwerk</h1>
    <p class="explain-lead">Das Fahrwerk umfasst Radaufhängung, Federung, Dämpfung und Lenkung. Es sorgt für Fahrsicherheit, Komfort und die richtige Kraftübertragung zwischen Reifen und Fahrbahn.</p>

    <h2>Radaufhängung</h2>
    <p>Die häufigsten Bauformen sind:</p>
    <ul>
      <li><strong>McPherson-Federbein:</strong> einfacher, kompakter Aufbau (ein Querlenker + Federbein), weit verbreitet an Vorderachsen.</li>
      <li><strong>Doppelquerlenkerachse:</strong> zwei Querlenker pro Rad, ermöglicht präzisere Radführung und günstigeres Sturzverhalten beim Einfedern, aufwendiger und teurer.</li>
      <li><strong>Mehrlenkerachse:</strong> mehrere einzelne Lenker, oft an Hinterachsen für optimalen Kompromiss aus Komfort, Fahrdynamik und Bauraum.</li>
    </ul>

    <h2>Achsvermessung: Sturz, Spur und Nachlauf</h2>
    <div class="explain-diagram">
      <svg viewBox="0 0 220 140" width="100%">
        <g font-family="sans-serif" font-size="11" fill="var(--text)">
          <line x1="110" y1="10" x2="110" y2="130" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3"/>
          <line x1="110" y1="15" x2="140" y2="120" stroke="var(--accent)" stroke-width="4"/>
          <rect x="128" y="35" width="18" height="80" rx="7" fill="none" stroke="var(--accent)" stroke-width="2" transform="rotate(8 137 75)"/>
          <text x="150" y="20" fill="var(--accent)">+</text>
          <text x="20" y="30">Lot</text>
          <path d="M110 40 A 30 30 0 0 1 132 45" fill="none" stroke="var(--wrong)" stroke-width="1.5"/>
          <text x="150" y="45" fill="var(--wrong)">Sturzwinkel γ</text>
        </g>
      </svg>
      <figcaption>Positiver Sturz: Das Rad neigt sich oben vom Fahrzeug weg (übertrieben dargestellt).</figcaption>
    </div>
    <ul>
      <li><strong>Sturz (Camber):</strong> Neigung des Rades gegenüber der Senkrechten, von vorne betrachtet. Positiver Sturz = Radoberkante neigt sich nach außen, negativer Sturz = nach innen. Beeinflusst die Aufstandsfläche des Reifens, besonders in Kurven.</li>
      <li><strong>Spur (Toe):</strong> Winkel der Räder zueinander, von oben betrachtet. Vorspur = Räder zeigen vorne leicht zueinander, Nachspur = Räder zeigen leicht auseinander. Beeinflusst Geradeauslauf und Reifenverschleiß.</li>
      <li><strong>Nachlauf (Caster):</strong> Neigung der Lenkachse in Fahrtrichtung, sorgt für die Selbstzentrierung/Rückstellung der Lenkung (Spurstabilität) und das "Aufrichten" der Räder nach einer Kurvenfahrt.</li>
    </ul>
    <div class="explain-example"><strong>Beispiel:</strong> Falsch eingestellte Spur ist eine der häufigsten Ursachen für einseitigen, sägezahnartigen Reifenverschleiß – deshalb gehört die Achsvermessung zu den Standardprüfungen bei Fahrwerksarbeiten.</div>

    <h2>Federung und Dämpfung</h2>
    <p>Die <strong>Feder</strong> (meist Schraubenfeder) nimmt Stöße der Fahrbahn auf und hält die Aufbaumasse in Position. Der <strong>Stoßdämpfer</strong> wandelt die Federbewegung in Wärme um und verhindert ein unkontrolliertes Nachschwingen – ohne Dämpfer würde das Fahrzeug nach jeder Bodenwelle lange nachfedern und der Reifenkontakt zur Fahrbahn ginge verloren.</p>

    <h2>Lenkung</h2>
    <p>Die heute übliche <strong>Zahnstangenlenkung</strong> wandelt die Drehbewegung des Lenkrads über ein Ritzel in eine Linearbewegung der Zahnstange um, die die Spurstangen und damit die Räder bewegt. Eine <strong>elektrische Servolenkung (EPS)</strong> unterstützt den Fahrer über einen Elektromotor je nach Geschwindigkeit und Lenkkraft – bei Parkiergeschwindigkeit mit viel, bei hoher Geschwindigkeit mit wenig Unterstützung, für Komfort und Fahrsicherheit gleichermaßen.</p>
  `,

  "Bremsanlage": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Bremsanlage</h1>
    <p class="explain-lead">Die Bremsanlage wandelt Bewegungsenergie in Wärme um und verzögert dadurch das Fahrzeug. Moderne Pkw nutzen an allen vier Rädern in der Regel Scheibenbremsen, teils vorne Scheiben- und hinten Trommelbremsen.</p>

    <h2>Aufbau der Scheibenbremse</h2>
    <div class="explain-diagram">
      <svg viewBox="0 0 200 140" width="100%">
        <g font-family="sans-serif" font-size="11" fill="var(--text)">
          <circle cx="100" cy="70" r="55" fill="none" stroke="var(--muted)" stroke-width="6"/>
          <circle cx="100" cy="70" r="55" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 4"/>
          <rect x="70" y="25" width="60" height="26" rx="4" fill="var(--wrong)" opacity="0.85"/>
          <rect x="76" y="30" width="10" height="16" fill="var(--bg,#111)"/>
          <rect x="114" y="30" width="10" height="16" fill="var(--bg,#111)"/>
          <text x="100" y="18" text-anchor="middle">Bremssattel mit Belägen</text>
          <text x="100" y="135" text-anchor="middle">Bremsscheibe</text>
        </g>
      </svg>
      <figcaption>Der Bremssattel presst zwei Bremsbeläge von beiden Seiten gegen die rotierende Bremsscheibe.</figcaption>
    </div>
    <p>Beim Bremsen presst der hydraulisch betätigte <strong>Bremssattel</strong> die <strong>Bremsbeläge</strong> gegen die mit dem Rad rotierende <strong>Bremsscheibe</strong>. Durch die entstehende Reibung wird die Bewegungsenergie in Wärme umgewandelt. Unterschieden wird zwischen Festsattel (Kolben auf beiden Seiten) und Schwimmsattel (Kolben nur auf einer Seite, der Sattel "schwimmt" und presst dadurch auch die gegenüberliegende Seite an).</p>

    <h2>Hydraulisches Bremssystem</h2>
    <p>Tritt der Fahrer das Bremspedal, wird über den <strong>Hauptbremszylinder</strong> Druck auf die Bremsflüssigkeit aufgebaut, die (nach dem Prinzip der Pascal'schen Hydraulik – Druck breitet sich in einer eingeschlossenen Flüssigkeit gleichmäßig aus) über Bremsleitungen zu den Radbremszylindern/Bremssätteln an allen vier Rädern übertragen wird. Der <strong>Bremskraftverstärker</strong> (meist unterdruck- oder elektromechanisch betätigt) verstärkt die Pedalkraft des Fahrers, damit nicht die volle Bremskraft allein durch Muskelkraft aufgebracht werden muss.</p>

    <h2>ABS – Anti-Blockier-System</h2>
    <p>Das ABS verhindert, dass die Räder beim starken Bremsen blockieren (durchrutschen). Drehzahlsensoren an jedem Rad erkennen ein bevorstehendes Blockieren, woraufhin das ABS-Steuergerät den Bremsdruck an diesem Rad kurzzeitig reduziert und wieder aufbaut (mehrmals pro Sekunde). Dadurch bleibt das Rad lenkfähig und der maximale Kraftschluss zur Fahrbahn bleibt erhalten – der Bremsweg wird i. d. R. kürzer, vor allem aber bleibt das Fahrzeug lenk- und kontrollierbar.</p>

    <h2>ESP – Elektronisches Stabilitätsprogramm</h2>
    <p>Das ESP erkennt über Sensoren (Lenkwinkel, Gierrate, Querbeschleunigung, Raddrehzahl) ein Schleudern oder Ausbrechen des Fahrzeugs und bremst gezielt einzelne Räder ab (und/oder reduziert die Motorleistung), um das Fahrzeug wieder auf die vom Fahrer über das Lenkrad vorgegebene Spur zu stabilisieren.</p>
    <div class="explain-example"><strong>Beispiel:</strong> Bricht das Heck in einer Kurve aus (Übersteuern), bremst das ESP gezielt das kurvenäußere Vorderrad ab, um ein stabilisierendes Gegenmoment zu erzeugen.</div>

    <h2>Feststellbremse</h2>
    <p>Die Feststellbremse (Handbremse) hält das Fahrzeug im Stand fest, wirkt meist mechanisch (über Seilzüge) oder heute zunehmend elektrisch (elektrische Parkbremse, EPB) auf die Hinterradbremsen.</p>
  `,

  "Elektrik & Elektronik": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Elektrik &amp; Elektronik</h1>
    <p class="explain-lead">Grundlage jeder Fahrzeugelektrik ist der elektrische Stromkreis: eine Spannungsquelle treibt einen Strom durch einen Verbraucher, der Widerstand begrenzt die Stromstärke.</p>

    <h2>Grundgrößen und das Ohmsche Gesetz</h2>
    <div class="explain-diagram">
      <svg viewBox="0 0 260 110" width="100%">
        <g font-family="sans-serif" font-size="11" fill="none" stroke="var(--text)" stroke-width="2">
          <line x1="20" y1="20" x2="20" y2="90"/>
          <line x1="20" y1="90" x2="240" y2="90"/>
          <line x1="240" y1="90" x2="240" y2="20"/>
          <line x1="20" y1="20" x2="100" y2="20"/>
          <line x1="160" y1="20" x2="240" y2="20"/>
          <line x1="100" y1="10" x2="100" y2="30" stroke="var(--accent)" stroke-width="4"/>
          <line x1="112" y1="5" x2="112" y2="35" stroke="var(--accent)" stroke-width="2"/>
          <rect x="115" y="10" width="45" height="20" fill="none" stroke="var(--wrong)"/>
          <circle cx="20" cy="55" r="4" fill="var(--right)" stroke="none"/>
        </g>
        <g font-family="sans-serif" font-size="11" fill="var(--text)">
          <text x="70" y="45">+ Batterie −</text>
          <text x="137" y="45" text-anchor="middle">Verbraucher (R)</text>
          <text x="5" y="60" fill="var(--right)">S</text>
        </g>
      </svg>
      <figcaption>Einfacher Stromkreis: Spannungsquelle (Batterie), Schalter (S) und Verbraucher (Widerstand R) in Reihe geschaltet.</figcaption>
    </div>
    <p>Das <strong>Ohmsche Gesetz</strong> beschreibt den Zusammenhang zwischen Spannung U (Volt), Stromstärke I (Ampere) und Widerstand R (Ohm):</p>
    <p style="text-align:center;font-size:17px;font-weight:700;">U = R · I</p>
    <div class="explain-example"><strong>Beispiel:</strong> Eine Glühlampe mit 5 Ω Widerstand liegt an der 12-V-Bordnetzspannung. Der Strom beträgt I = U / R = 12 V / 5 Ω = 2,4 A.</div>

    <h2>Bordnetz-Komponenten</h2>
    <ul>
      <li><strong>Batterie:</strong> speichert elektrische Energie chemisch, versorgt das Bordnetz bei stehendem Motor und liefert den hohen Anlasserstrom beim Start.</li>
      <li><strong>Generator (Lichtmaschine):</strong> erzeugt bei laufendem Motor über elektromagnetische Induktion Strom, versorgt das Bordnetz und lädt die Batterie wieder auf.</li>
      <li><strong>Starter (Anlasser):</strong> ein leistungsstarker Elektromotor, der über ein Ritzel kurzzeitig in den Zahnkranz des Schwungrads eingreift und den Verbrennungsmotor zum Anspringen durchdreht.</li>
      <li><strong>Sicherungen:</strong> schützen Leitungen und Verbraucher vor Überstrom, indem ein dünner Schmelzleiter bei zu hohem Strom durchbrennt und den Stromkreis unterbricht.</li>
      <li><strong>Relais:</strong> ein elektromagnetisch betätigter Schalter, mit dem ein kleiner Steuerstrom einen großen Laststrom schalten kann (z. B. für Scheinwerfer, Lüfter).</li>
    </ul>

    <h2>Reihen- und Parallelschaltung</h2>
    <p>Bei einer <strong>Reihenschaltung</strong> addieren sich die Widerstände (R_ges = R1 + R2 + …), der Strom ist überall gleich groß, die Spannung teilt sich auf. Bei einer <strong>Parallelschaltung</strong> liegt an allen Verbrauchern die gleiche Spannung an, die Ströme addieren sich, der Gesamtwiderstand sinkt. Das Kfz-Bordnetz ist überwiegend eine Parallelschaltung, damit jeder Verbraucher (Licht, Radio, Sitzheizung …) unabhängig von den anderen mit voller Bordnetzspannung arbeitet.</p>
  `,

  "Bus-Systeme & Diagnose": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Bus-Systeme &amp; Diagnose</h1>
    <p class="explain-lead">Moderne Fahrzeuge enthalten Dutzende Steuergeräte, die permanent Daten austauschen müssen. Anstatt jedes Gerät einzeln zu verkabeln, werden Bus-Systeme eingesetzt: alle Teilnehmer teilen sich gemeinsame Datenleitungen.</p>

    <h2>CAN-Bus (Controller Area Network)</h2>
    <div class="explain-diagram">
      <svg viewBox="0 0 300 100" width="100%">
        <g stroke="var(--accent)" stroke-width="3">
          <line x1="20" y1="50" x2="280" y2="50"/>
        </g>
        <g font-family="sans-serif" font-size="10" fill="var(--text)">
          <rect x="8" y="30" width="16" height="40" fill="var(--wrong)"/>
          <text x="16" y="85" text-anchor="middle">120Ω</text>
          <rect x="276" y="30" width="16" height="40" fill="var(--wrong)"/>
          <text x="284" y="85" text-anchor="middle">120Ω</text>
          <circle cx="80" cy="50" r="5" fill="var(--right)"/>
          <text x="80" y="35" text-anchor="middle">Motor-SG</text>
          <circle cx="150" cy="50" r="5" fill="var(--right)"/>
          <text x="150" y="35" text-anchor="middle">ABS-SG</text>
          <circle cx="220" cy="50" r="5" fill="var(--right)"/>
          <text x="220" y="35" text-anchor="middle">Airbag-SG</text>
        </g>
      </svg>
      <figcaption>Linienförmige CAN-Bus-Topologie: alle Steuergeräte (SG) hängen an einer verdrillten Zweidrahtleitung (CAN-High/CAN-Low), an beiden Enden sitzen 120-Ω-Abschlusswiderstände.</figcaption>
    </div>
    <p>Der CAN-Bus überträgt Daten differenziell über zwei verdrillte Leitungen (<strong>CAN-High</strong> und <strong>CAN-Low</strong>) – Störsignale wirken auf beide Leitungen gleich und heben sich beim Empfänger auf, was den Bus sehr störsicher macht. An beiden Enden der Busleitung sitzt je ein <strong>120-Ω-Abschlusswiderstand</strong>, der Signalreflexionen verhindert. Jede Nachricht besitzt eine Priorität (Identifier): Bei gleichzeitigem Senden setzt sich automatisch die Nachricht mit der höheren Priorität durch (z. B. haben sicherheitsrelevante Airbag-Daten Vorrang vor Komfortdaten wie Sitzheizung).</p>
    <div class="explain-example"><strong>Beispiel:</strong> Ist ein CAN-Abschlusswiderstand defekt oder eine Leitung unterbrochen, kommt es zu Signalreflexionen bzw. Kommunikationsausfällen – typische Folge sind mehrere gleichzeitig auftretende, scheinbar unzusammenhängende Fehlercodes in verschiedenen Steuergeräten.</div>

    <h2>Weitere Bus-Systeme</h2>
    <ul>
      <li><strong>LIN-Bus (Local Interconnect Network):</strong> einfacher, günstiger Ein-Draht-Bus für weniger zeitkritische Komfortfunktionen (z. B. Fensterheber, Sitzverstellung), meist als Sub-Bus an ein CAN-Steuergerät angebunden.</li>
      <li><strong>MOST-Bus (Media Oriented Systems Transport):</strong> Glasfaser-basiertes System für hohe Datenraten, genutzt für Infotainment (Navigation, Audio, Video).</li>
      <li><strong>FlexRay:</strong> sehr schnelles, deterministisches (zeitgesteuertes) Bus-System für höchste Echtzeitanforderungen, z. B. bei Fahrwerksregelsystemen.</li>
    </ul>

    <h2>OBD-Diagnose</h2>
    <p>Über die genormte <strong>OBD-Diagnosesteckdose</strong> (On-Board-Diagnose, meist im Fußraum unter dem Lenkrad) lässt sich mit einem Diagnosegerät der <strong>Fehlerspeicher</strong> aller angeschlossenen Steuergeräte auslesen. Gespeicherte Fehlercodes (DTCs) geben Hinweise auf die fehlerhafte Komponente oder den Systembereich und sind Ausgangspunkt jeder systematischen Fehlersuche – nie sollte allein aufgrund eines Fehlercodes ein Bauteil getauscht werden, ohne die eigentliche Ursache zu prüfen.</p>
  `,

  "Hochvolt": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Hochvolt</h1>
    <p class="explain-lead">Hybrid- und Elektrofahrzeuge besitzen zusätzlich zum normalen 12-V-Bordnetz ein Hochvolt-System (meist 200–800 V), das lebensgefährlich sein kann. Arbeiten an HV-Systemen erfordern eine spezielle Qualifikation und strikte Sicherheitsregeln.</p>

    <h2>Kennzeichnung von HV-Komponenten</h2>
    <p>HV-Leitungen und -Stecker sind zur eindeutigen Erkennung <strong>orange</strong> gekennzeichnet. Warnschilder mit Blitzsymbol weisen auf Hochvolt-Gefahrenbereiche hin. Nur speziell geschultes Personal (mindestens "Fachkundige Person HV", HV-1/HV-2/HV-3 nach DGUV) darf an spannungsführenden HV-Komponenten arbeiten.</p>
    <div class="explain-example"><strong>Beispiel:</strong> Ein Servicetechniker ohne HV-Qualifikation darf zwar ein Fahrzeug mit HV-System bewegen oder Reifen wechseln, jedoch keinesfalls orange HV-Leitungen öffnen oder Steckverbindungen der Hochvoltbatterie trennen.</div>

    <h2>Die 5 Sicherheitsregeln</h2>
    <p>Vor Arbeiten an spannungsfreigeschalteten HV-Komponenten müssen diese fünf Schritte in genau dieser Reihenfolge eingehalten werden:</p>
    <ol>
      <li>Freischalten (Trennung von allen Spannungsquellen, z. B. Service-Stecker/Trennschalter ziehen)</li>
      <li>Gegen Wiedereinschalten sichern</li>
      <li>Spannungsfreiheit feststellen (mit geeignetem, geprüftem Messgerät)</li>
      <li>Erden und Kurzschließen (je nach Vorgabe des Herstellers)</li>
      <li>Benachbarte, unter Spannung stehende Teile abdecken oder abschranken</li>
    </ol>

    <h2>Personenschutz im HV-System</h2>
    <p>Ein zentrales Sicherheitselement ist die <strong>Isolationsüberwachung</strong>: Ein Steuergerät überwacht laufend den Isolationswiderstand zwischen dem HV-System und der Fahrzeugkarosserie (Masse). Sinkt dieser Widerstand unter einen Grenzwert (Isolationsfehler, z. B. durch beschädigte Leitungsisolation), wird eine Warnung ausgegeben bzw. das System abgeschaltet, um einen gefährlichen Berührungsstrom über die Karosserie zu verhindern. Zusätzlich trennt bei einem Unfall (Crashsensor-Signal) die Pyrosicherung automatisch die Hochvoltbatterie vom restlichen System.</p>

    <h2>Hochvoltbatterie</h2>
    <p>Die HV-Batterie (meist Lithium-Ionen-Technologie) speichert die Antriebsenergie. Sie besteht aus vielen in Reihe/parallel geschalteten Zellen, die über ein <strong>Batteriemanagementsystem (BMS)</strong> überwacht werden (Zellspannung, Temperatur, Ladezustand), um Überladung, Tiefentladung und Überhitzung zu verhindern und die Lebensdauer zu maximieren.</p>

    <h2>Ladesysteme</h2>
    <ul>
      <li><strong>AC-Laden (Wechselstrom):</strong> über den Typ-2-Stecker, das Fahrzeug wandelt den Wechselstrom intern über das Onboard-Ladegerät in Gleichstrom um – geeignet für Laden zu Hause/an der Wallbox, eher langsam.</li>
      <li><strong>DC-Laden (Gleichstrom, Schnellladen):</strong> über CCS- (oder CHAdeMO-)Stecker liefert die Ladesäule direkt Gleichstrom an die HV-Batterie, das Onboard-Ladegerät wird umgangen – deutlich höhere Ladeleistung und kürzere Ladezeit.</li>
    </ul>
  `,
};

function renderExplainList() {
  els.explainList.innerHTML = "";
  const cats = categories();
  cats.forEach((cat) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "topic-item topic-item-btn";
    item.innerHTML = `
      <div class="topic-item-row">
        <span class="topic-icon">${iconForCategory(cat)}</span>
        <div class="topic-info">
          <div class="topic-name">${escapeHtml(cat)}</div>
          <div class="topic-count">${EXPLANATIONS[cat] ? "Erklärung ansehen" : "Bald verfügbar"}</div>
        </div>
      </div>
    `;
    item.addEventListener("click", () => openExplain(cat));
    els.explainList.appendChild(item);
  });
}

function openExplain(cat) {
  const html = EXPLANATIONS[cat];
  if (!html) return;
  els.explainContent.innerHTML = html;
  els.explainView.hidden = false;
  els.explainContent.scrollTop = 0;
}

els.explainBackBtn.addEventListener("click", () => {
  els.explainView.hidden = true;
});

// --- Aktionsmenü (Üben / Zurücksetzen / Falsche Fragen) ---

function openActionSheet(cat) {
  sheetCategory = cat;
  els.sheetTitle.textContent = cat;
  els.sheetBackdrop.hidden = false;
  els.actionSheet.hidden = false;
}

function closeActionSheet() {
  els.sheetBackdrop.hidden = true;
  els.actionSheet.hidden = true;
  sheetCategory = null;
}

els.sheetBackdrop.addEventListener("click", closeActionSheet);
els.sheetCancelBtn.addEventListener("click", closeActionSheet);

els.sheetStudyBtn.addEventListener("click", () => {
  const cat = sheetCategory;
  closeActionSheet();
  if (cat) openTopic(cat, "all");
});

els.sheetResetBtn.addEventListener("click", () => {
  const cat = sheetCategory;
  closeActionSheet();
  if (cat) resetTopicProgress(cat);
});

els.sheetWrongBtn.addEventListener("click", () => {
  const cat = sheetCategory;
  closeActionSheet();
  if (cat) openTopic(cat, "hard");
});

// --- Study view: Themen-Lernmodus ---

function openTopic(topic, filter) {
  sessionMode = "topic";
  currentTopic = topic;
  currentFilter = filter;
  sessionResults = { right: 0, wrong: 0 };
  topicAnsweredCount = 0;
  els.studyView.hidden = false;
  els.simTimer.hidden = true;
  els.resultView.hidden = true;
  buildDeck();
}

function buildDeck() {
  const filtered = allCards.filter((c) => {
    if (currentTopic !== ALL_TOPIC && (c.category || "Allgemein") !== currentTopic) return false;
    if (currentFilter === "hard") return cardState(c.id) === "hard";
    return true;
  });
  deck = shuffled(filtered);
  currentIndex = 0;
  render();
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
let mcAnswered = false;
let currentMcOrder = []; // Anzeigeposition -> ursprünglicher Options-Index

function render() {
  const hasCards = deck.length > 0;
  els.cardArea.hidden = !hasCards;
  els.emptyState.hidden = hasCards;
  if (!hasCards) {
    els.mcNextBar.hidden = true;
    return;
  }

  if (currentIndex >= deck.length) currentIndex = 0;
  const card = deck[currentIndex];
  const isMc = Array.isArray(card.options) && card.options.length > 0;

  els.cardWrap.hidden = isMc;
  els.actionRow.hidden = isMc;
  els.mcArea.hidden = !isMc;

  if (isMc) {
    renderMcCard(card);
  } else {
    els.mcNextBar.hidden = true;
    els.flashcard.classList.remove("flipped");
    els.categoryTag.textContent = card.category || "Allgemein";
    els.categoryTagBack.textContent = card.category || "Allgemein";
    els.questionText.textContent = card.question;
    els.answerText.textContent = card.answer;
  }

  if (sessionMode === "simulation") {
    const answered = sessionResults.right + sessionResults.wrong;
    const totalSim = answered + deck.length;
    els.progressFill.style.width = totalSim ? `${(answered / totalSim) * 100}%` : "0%";
    els.progressText.textContent = `${answered} / ${totalSim} beantwortet`;
  } else {
    const scope = allCards.filter((c) => currentTopic === ALL_TOPIC || (c.category || "Allgemein") === currentTopic);
    // Im "Alle Fragen"-Durchlauf zählt jede beantwortete Frage (richtig oder
    // falsch) als erledigt, da sie in diesem Durchlauf nicht wiederkommt.
    // Beim Üben der "Falschen Fragen" bleibt es bei "richtig gelernt", da
    // falsch beantwortete Karten dort erneut drankommen.
    const doneCount =
      currentFilter === "hard"
        ? scope.filter((c) => progress.known[c.id]).length
        : scope.filter((c) => progress.known[c.id] || progress.hard[c.id]).length;
    els.progressFill.style.width = scope.length ? `${(doneCount / scope.length) * 100}%` : "0%";
    els.progressText.textContent = `${doneCount} / ${scope.length} gelernt`;
  }
}

function flip() {
  els.flashcard.classList.toggle("flipped");
}

// --- Multiple-Choice ---

function renderMcCard(card) {
  mcAnswered = false;
  els.mcCategoryTag.textContent = card.category || "Allgemein";
  els.mcQuestionText.textContent = card.question;
  els.mcExplain.hidden = true;
  els.mcExplainText.textContent = card.answer || "";
  els.mcArea.classList.remove("has-explain");
  els.mcNextBar.hidden = true;

  // Reihenfolge der Antwortmöglichkeiten bei jeder Anzeige neu mischen,
  // damit die richtige Antwort nicht immer an derselben Stelle steht.
  currentMcOrder = shuffled(card.options.map((_, i) => i));

  els.mcOptions.innerHTML = "";
  currentMcOrder.forEach((origIndex, displayIndex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mc-option";
    btn.innerHTML = `<span class="mc-option-letter">${OPTION_LETTERS[displayIndex] || displayIndex + 1}</span><span>${escapeHtml(card.options[origIndex])}</span>`;
    btn.addEventListener("click", () => selectMcOption(card, origIndex));
    els.mcOptions.appendChild(btn);
  });
}

function selectMcOption(card, selectedIndex) {
  if (mcAnswered) return;
  mcAnswered = true;

  const buttons = Array.from(els.mcOptions.children);
  buttons.forEach((btn, displayIndex) => {
    btn.classList.add("disabled");
    const origIndex = currentMcOrder[displayIndex];
    if (origIndex === card.correct) btn.classList.add("correct");
    else if (origIndex === selectedIndex) btn.classList.add("wrong");
  });

  const isCorrect = selectedIndex === card.correct;
  recordAnswer(isCorrect ? "known" : "hard");

  els.mcExplain.hidden = false;
  els.mcArea.classList.add("has-explain");
  els.mcNextBar.hidden = false;
}

els.mcNextBtn.addEventListener("click", () => {
  const card = deck[currentIndex];
  const isCorrect = card ? progress.known[card.id] : true;
  advanceAfterAnswer(isCorrect ? "known" : "hard");
});

// --- Fortschritt speichern & weiterschalten ---

function recordAnswer(state) {
  if (!deck.length) return;
  const card = deck[currentIndex];
  if (state === "known") {
    progress.known[card.id] = true;
    delete progress.hard[card.id];
  } else {
    progress.hard[card.id] = true;
    delete progress.known[card.id];
  }
  saveProgress();
}

function advanceAfterAnswer(state) {
  if (sessionMode === "simulation") {
    sessionResults[state === "known" ? "right" : "wrong"] += 1;
    deck.splice(currentIndex, 1);
    if (currentIndex >= deck.length) currentIndex = 0;
    if (!deck.length) { endSimulation(); return; }
    render();
    return;
  }

  if (currentFilter === "hard" && state === "known") {
    deck.splice(currentIndex, 1);
    if (currentIndex >= deck.length) currentIndex = 0;
    render();
    return;
  }

  if (currentFilter === "all") {
    sessionResults[state === "known" ? "right" : "wrong"] += 1;
    topicAnsweredCount += 1;
    if (topicAnsweredCount >= deck.length) {
      endTopicSession();
      return;
    }
  }

  currentIndex = (currentIndex + 1) % deck.length;
  render();
}

function markCurrent(state) {
  if (!deck.length) return;
  recordAnswer(state);
  advanceAfterAnswer(state);
}

function goHome() {
  stopSimTimer();
  els.studyView.hidden = true;
  renderHome();
  renderStats();
}

els.backBtn.addEventListener("click", goHome);
els.emptyBackBtn.addEventListener("click", goHome);

els.heroBtn.addEventListener("click", () => openTopic(ALL_TOPIC, "all"));
els.merkBtn.addEventListener("click", () => openTopic(ALL_TOPIC, "hard"));

els.flashcard.addEventListener("click", flip);
els.flashcard.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
});

els.hardBtn.addEventListener("click", () => markCurrent("hard"));
els.knownBtn.addEventListener("click", () => markCurrent("known"));

// Swipe gestures
let touchStartX = null;
let touchStartY = null;
const wrap = document.getElementById("cardWrap");

wrap.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

wrap.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) markCurrent("known");
    else markCurrent("hard");
  }
}, { passive: true });

// --- Simulation (Prüfung auf Zeit) ---

function getSimCount() {
  const v = parseInt(localStorage.getItem(`${SIM_COUNT_KEY}_${currentProfile}`), 10);
  return Number.isFinite(v) && v > 0 ? v : 20;
}

els.simCountInput.addEventListener("change", () => {
  const v = Math.max(5, Math.min(200, parseInt(els.simCountInput.value, 10) || 20));
  els.simCountInput.value = v;
  localStorage.setItem(`${SIM_COUNT_KEY}_${currentProfile}`, String(v));
});

function shuffled(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startSimulation() {
  if (!allCards.length) return;
  sessionMode = "simulation";
  sessionResults = { right: 0, wrong: 0 };
  const count = Math.min(getSimCount(), allCards.length);
  deck = shuffled(allCards).slice(0, count);
  currentIndex = 0;

  els.studyView.hidden = false;
  els.resultView.hidden = true;
  els.simTimer.hidden = false;

  const seconds = Math.max(300, count * 60);
  startSimTimer(seconds);
  render();
}

function startSimTimer(seconds) {
  stopSimTimer();
  simRemaining = seconds;
  updateSimTimerText();
  simInterval = setInterval(() => {
    simRemaining -= 1;
    updateSimTimerText();
    if (simRemaining <= 0) endSimulation();
  }, 1000);
}

function stopSimTimer() {
  if (simInterval) clearInterval(simInterval);
  simInterval = null;
}

function updateSimTimerText() {
  const m = Math.max(0, Math.floor(simRemaining / 60));
  const s = Math.max(0, simRemaining % 60);
  els.simTimerText.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

// Deutscher Notenspiegel (1 = sehr gut ... 6 = ungenügend)
function gradeForPct(pct) {
  if (pct >= 92) return { note: 1, label: "Sehr gut", cls: "grade-good" };
  if (pct >= 81) return { note: 2, label: "Gut", cls: "grade-good" };
  if (pct >= 67) return { note: 3, label: "Befriedigend", cls: "grade-mid" };
  if (pct >= 50) return { note: 4, label: "Ausreichend", cls: "grade-mid" };
  if (pct >= 30) return { note: 5, label: "Mangelhaft", cls: "grade-bad" };
  return { note: 6, label: "Ungenügend", cls: "grade-bad" };
}

function showResult(right, wrong) {
  els.cardArea.hidden = true;
  els.emptyState.hidden = true;
  els.mcNextBar.hidden = true;
  els.resultView.hidden = false;

  const answered = right + wrong;
  const pct = answered ? Math.round((right / answered) * 100) : 0;
  const grade = gradeForPct(pct);

  els.resultPct.textContent = pct;
  setRing(els.resultRingFill, 52, pct);
  els.resultRight.textContent = right;
  els.resultWrong.textContent = wrong;
  els.resultGrade.className = `result-grade ${grade.cls}`;
  els.resultGrade.querySelector(".result-grade-note").textContent = `Note ${grade.note}`;
  els.resultGrade.querySelector(".result-grade-label").textContent = grade.label;
}

function endSimulation() {
  stopSimTimer();
  sessionEndKind = "simulation";
  showResult(sessionResults.right, sessionResults.wrong);
}

function endTopicSession() {
  sessionEndKind = "topic";
  sessionEndTopic = currentTopic;
  showResult(sessionResults.right, sessionResults.wrong);
}

els.simBtn.addEventListener("click", startSimulation);

els.resultRepeatBtn.addEventListener("click", () => {
  if (sessionEndKind === "simulation") {
    startSimulation();
  } else {
    clearTopicProgress(sessionEndTopic);
    openTopic(sessionEndTopic, "all");
  }
});

els.resultHomeBtn.addEventListener("click", goHome);

// --- Einstellungen ---

els.reloadBtn.addEventListener("click", () => loadCards());

els.resetBtn.addEventListener("click", () => {
  const name = PROFILES[currentProfile]?.name || "";
  if (confirm(`Gesamten Lernfortschritt von ${name} (alle Themen) zurücksetzen?`)) {
    progress = { known: {}, hard: {} };
    saveProgress();
    renderHome();
    renderStats();
    showToast("Fortschritt zurückgesetzt");
  }
});

// --- Profil ---

const ACTIVE_PROFILE_KEY = "kfz_active_profile_v1";
const ACTIVE_PROFILE_TTL_MS = 8 * 60 * 60 * 1000; // 8 Stunden "eingeloggt bleiben"

function getRememberedProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVE_PROFILE_KEY));
    if (!raw || !PROFILES[raw.id]) return null;
    if (Date.now() - raw.ts > ACTIVE_PROFILE_TTL_MS) return null;
    return raw.id;
  } catch {
    return null;
  }
}

function rememberProfile(id) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify({ id, ts: Date.now() }));
}

function forgetProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
}

function selectProfile(id) {
  currentProfile = id;
  progress = loadProgress();
  els.simCountInput.value = getSimCount();
  rememberProfile(id);

  const name = PROFILES[id].name;
  els.activeProfileBadge.innerHTML = `<img src="${PROFILES[id].avatar}" alt="">${escapeHtml(name)}`;
  els.settingsProfileName.textContent = name;
  els.profileGate.hidden = true;

  renderHome();
  renderStats();
  startCloudSync();
}

els.profileButtons.forEach((btn) => {
  btn.addEventListener("click", () => selectProfile(btn.dataset.profile));
});

// Profilwechsel lädt die App neu und vergisst das gemerkte Profil, damit die
// Auswahl wieder erscheint (und kein Timer/Zustand des vorigen Profils übrig bleibt).
els.activeProfileBadge.addEventListener("click", () => { forgetProfile(); location.reload(); });
els.switchProfileBtn.addEventListener("click", () => { forgetProfile(); location.reload(); });

// --- Init ---

document.getElementById("appVersion").textContent = APP_VERSION;

const rememberedProfile = getRememberedProfile();
if (rememberedProfile) {
  selectProfile(rememberedProfile);
  const rememberedTab = localStorage.getItem(ACTIVE_TAB_KEY);
  if (rememberedTab && TAB_ORDER.includes(rememberedTab)) {
    switchTab(rememberedTab, { remember: false });
  }
}

loadCards({ silent: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadCards({ silent: true });
    if (currentProfile) syncFromCloud();
  }
});
