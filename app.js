const STORAGE_KEY = "kfz_progress_v1";
const SIM_COUNT_KEY = "kfz_sim_count_v1";
const ALL_TOPIC = "__all__";

const PROFILES = {
  tim: { name: "Tim", color: "var(--accent)" },
  huseyn: { name: "Huseyn", color: "var(--merk)" },
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
  tabSettings: document.getElementById("tabSettings"),

  heroBtn: document.getElementById("heroBtn"),
  heroRingFill: document.getElementById("heroRingFill"),
  heroRingPct: document.getElementById("heroRingPct"),
  simBtn: document.getElementById("simBtn"),
  merkBtn: document.getElementById("merkBtn"),
  merkCount: document.getElementById("merkCount"),
  topicList: document.getElementById("topicList"),
  noTopics: document.getElementById("noTopics"),

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
  flashcard: document.getElementById("flashcard"),
  categoryTag: document.getElementById("categoryTag"),
  categoryTagBack: document.getElementById("categoryTagBack"),
  questionText: document.getElementById("questionText"),
  answerText: document.getElementById("answerText"),
  hardBtn: document.getElementById("hardBtn"),
  knownBtn: document.getElementById("knownBtn"),

  resultView: document.getElementById("resultView"),
  resultRingFill: document.getElementById("resultRingFill"),
  resultPct: document.getElementById("resultPct"),
  resultRight: document.getElementById("resultRight"),
  resultWrong: document.getElementById("resultWrong"),
  resultRepeatBtn: document.getElementById("resultRepeatBtn"),
  resultHomeBtn: document.getElementById("resultHomeBtn"),

  sheetBackdrop: document.getElementById("sheetBackdrop"),
  actionSheet: document.getElementById("actionSheet"),
  sheetTitle: document.getElementById("sheetTitle"),
  sheetStudyBtn: document.getElementById("sheetStudyBtn"),
  sheetWrongBtn: document.getElementById("sheetWrongBtn"),
  sheetResetBtn: document.getElementById("sheetResetBtn"),
  sheetCancelBtn: document.getElementById("sheetCancelBtn"),

  wrongListView: document.getElementById("wrongListView"),
  wrongBackBtn: document.getElementById("wrongBackBtn"),
  wrongListTitle: document.getElementById("wrongListTitle"),
  wrongList: document.getElementById("wrongList"),
  wrongListEmpty: document.getElementById("wrongListEmpty"),

  toast: document.getElementById("toast"),
};

let sheetCategory = null;

let allCards = [];
let deck = [];
let currentIndex = 0;
let currentTopic = ALL_TOPIC;
let currentFilter = "all";
let sessionMode = "topic"; // "topic" | "simulation"
let sessionResults = { right: 0, wrong: 0 };
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

const TAB_ORDER = ["tabHome", "tabStats", "tabSettings"];
let activeTabIndex = 0;

function switchTab(tabId) {
  activeTabIndex = TAB_ORDER.indexOf(tabId);
  [els.tabHome, els.tabStats, els.tabSettings].forEach((el) => {
    el.hidden = el.id !== tabId;
  });
  els.tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
  if (tabId === "tabStats") renderStats();
}

els.tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
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

function resetTopicProgress(cat) {
  if (!confirm(`Fortschritt für „${cat}“ zurücksetzen?`)) return;
  allCards.filter((c) => (c.category || "Allgemein") === cat).forEach((c) => {
    delete progress.known[c.id];
    delete progress.hard[c.id];
  });
  saveProgress();
  renderHome();
  showToast("Zurückgesetzt");
}

// --- Statistik ---

function renderStats() {
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
        <button type="button" class="btn btn-outline stats-wrong-btn">📋 Falsche Fragen anzeigen</button>
        <button type="button" class="btn btn-outline stats-reset-btn">↺ Antworten zurücksetzen (0 richtig, 0 falsch)</button>
      </div>
    `;
    row.querySelector(".stats-wrong-btn").addEventListener("click", () => openWrongList(cat));
    row.querySelector(".stats-reset-btn").addEventListener("click", () => {
      resetTopicProgress(cat);
      renderStats();
    });
    els.statsList.appendChild(row);
  });
}

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
  if (cat) openWrongList(cat);
});

// --- Liste der falschen Fragen ---

function openWrongList(cat) {
  const wrongCards = allCards.filter((c) => (c.category || "Allgemein") === cat && progress.hard[c.id]);
  els.wrongListTitle.textContent = `Falsche Fragen · ${cat}`;
  els.wrongListEmpty.hidden = wrongCards.length > 0;
  els.wrongList.innerHTML = wrongCards.map((c) => `<li>${escapeHtml(c.question)}</li>`).join("");
  els.wrongListView.hidden = false;
}

els.wrongBackBtn.addEventListener("click", () => {
  els.wrongListView.hidden = true;
});

// --- Study view: Themen-Lernmodus ---

function openTopic(topic, filter) {
  sessionMode = "topic";
  currentTopic = topic;
  currentFilter = filter;
  els.studyView.hidden = false;
  els.simTimer.hidden = true;
  els.resultView.hidden = true;
  buildDeck();
}

function buildDeck() {
  deck = allCards.filter((c) => {
    if (currentTopic !== ALL_TOPIC && (c.category || "Allgemein") !== currentTopic) return false;
    if (currentFilter === "hard") return cardState(c.id) === "hard";
    return true;
  });
  currentIndex = 0;
  render();
}

function render() {
  const hasCards = deck.length > 0;
  els.cardArea.hidden = !hasCards;
  els.emptyState.hidden = hasCards;
  if (!hasCards) return;

  if (currentIndex >= deck.length) currentIndex = 0;
  const card = deck[currentIndex];

  els.flashcard.classList.remove("flipped");
  els.categoryTag.textContent = card.category || "Allgemein";
  els.categoryTagBack.textContent = card.category || "Allgemein";
  els.questionText.textContent = card.question;
  els.answerText.textContent = card.answer;

  if (sessionMode === "simulation") {
    const answered = sessionResults.right + sessionResults.wrong;
    const totalSim = answered + deck.length;
    els.progressFill.style.width = totalSim ? `${(answered / totalSim) * 100}%` : "0%";
    els.progressText.textContent = `${answered} / ${totalSim} beantwortet`;
  } else {
    const scope = allCards.filter((c) => currentTopic === ALL_TOPIC || (c.category || "Allgemein") === currentTopic);
    const knownCount = scope.filter((c) => progress.known[c.id]).length;
    els.progressFill.style.width = scope.length ? `${(knownCount / scope.length) * 100}%` : "0%";
    els.progressText.textContent = `${knownCount} / ${scope.length} gelernt`;
  }
}

function flip() {
  els.flashcard.classList.toggle("flipped");
}

function markCurrent(state) {
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

  currentIndex = (currentIndex + 1) % deck.length;
  render();
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

function endSimulation() {
  stopSimTimer();
  els.cardArea.hidden = true;
  els.emptyState.hidden = true;
  els.resultView.hidden = false;

  const { right, wrong } = sessionResults;
  const answered = right + wrong;
  const pct = answered ? Math.round((right / answered) * 100) : 0;

  els.resultPct.textContent = pct;
  setRing(els.resultRingFill, 52, pct);
  els.resultRight.textContent = right;
  els.resultWrong.textContent = wrong;
}

els.simBtn.addEventListener("click", startSimulation);
els.resultRepeatBtn.addEventListener("click", startSimulation);
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

function selectProfile(id) {
  currentProfile = id;
  progress = loadProgress();
  els.simCountInput.value = getSimCount();

  const name = PROFILES[id].name;
  els.activeProfileBadge.textContent = name;
  els.settingsProfileName.textContent = name;
  els.profileGate.hidden = true;

  renderHome();
  renderStats();
}

els.profileButtons.forEach((btn) => {
  btn.addEventListener("click", () => selectProfile(btn.dataset.profile));
});

// Profilwechsel lädt die App neu, damit kein Timer/Zustand des vorigen Profils übrig bleibt.
els.activeProfileBadge.addEventListener("click", () => location.reload());
els.switchProfileBtn.addEventListener("click", () => location.reload());

// --- Init ---

loadCards({ silent: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadCards({ silent: true });
});
