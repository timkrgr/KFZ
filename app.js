const APP_VERSION = "v61";
const STORAGE_KEY = "kfz_progress_v1";
const STREAK_KEY = "kfz_streak_v1";
const EXAM_STATS_KEY = "kfz_exam_stats_v1";
const EXAM_PASS_PCT = 75; // ab dieser Prozentzahl gilt eine Prüfungssimulation als bestanden
const FINAL_EXAM_DATE = new Date(2026, 11, 12); // Termin der echten Abschlussprüfung (Monat 0-basiert: 11 = Dezember)
const STREAK_MIN_GAP_MS = 24 * 60 * 60 * 1000; // frühestens 24h nach dem letzten Abholen wieder abholbar
const STREAK_GRACE_MS = 48 * 60 * 60 * 1000; // innerhalb 48h nach dem letzten Abholen zählt die Streak weiter, sonst reißt sie ab
const ALL_TOPIC = "__all__";
const DB_URL = "https://kfz-lernen-default-rtdb.europe-west1.firebasedatabase.app";
const CLOUD_SYNC_INTERVAL_MS = 2 * 60 * 1000; // alle 2 Minuten mit dem anderen Profil abgleichen

const PROFILES = {
  tim: { name: "Tim", color: "var(--accent)", avatar: "icons/avatar-tim.jpg" },
  huseyn: { name: "Huseyn", color: "var(--merk)", avatar: "icons/avatar-huseyn.jpg" },
};
let currentProfile = null;

// Handgezeichnete SVG-Icons statt generischer Emojis, damit jede Kategorie
// ein thematisch passendes, gut erkennbares Symbol bekommt (z. B. eine
// Bremsscheibe für Bremsanlage). currentColor + Farbe wird direkt am
// <svg>-Element gesetzt, damit sich an den Aufrufstellen nichts ändern muss.
const CATEGORY_ICONS = {
  "Motor": {
    color: "#ea580c",
    svg: `<rect x="4" y="9" width="14" height="9" rx="1.5"/><rect x="7" y="4" width="3" height="5"/><rect x="12" y="4" width="3" height="5"/><circle cx="19" cy="14.5" r="2.3"/><line x1="7" y1="18" x2="7" y2="20"/><line x1="15" y1="18" x2="15" y2="20"/>`,
  },
  "Motormanagement & Abgasnachbehandlung": {
    color: "#22c55e",
    svg: `<line x1="2" y1="15" x2="10" y2="15"/><rect x="10" y="12.5" width="7" height="5" rx="2"/><path d="M19.5 5.5c1.1 1.1 1.1 2.7 0 3.8s-1.1 2.7 0 3.8"/><path d="M22.3 4c1.4 1.4 1.4 3.5 0 4.9s-1.4 3.5 0 4.9"/>`,
  },
  "Kraftübertragung": {
    color: "#94a3b8",
    svg: `<circle cx="9" cy="9" r="3.4"/><path d="M9 3.4v1.6M9 12.4v1.6M3.4 9h1.6M12.4 9h1.6M5.1 5.1l1.1 1.1M10.8 10.8l1.1 1.1M12.9 5.1l-1.1 1.1M6.2 10.8l-1.1 1.1"/><circle cx="16.5" cy="16" r="2.4"/><path d="M16.5 11.9v1.3M16.5 18.8v1.3M12.4 16h1.3M19.3 16h1.3M13.9 13.4l0.9 0.9M18.2 17.7l0.9 0.9M19.1 13.4l-0.9 0.9M14.8 17.7l-0.9 0.9"/>`,
  },
  "Fahrwerk": {
    color: "#3b82f6",
    svg: `<path d="M8 2v2.4"/><path d="M8 4.4 5.8 6 10.2 7.6 5.8 9.2 10.2 10.8 5.8 12.4 10.2 14 8 15.6"/><path d="M8 15.6V21"/><line x1="16.5" y1="4" x2="16.5" y2="20"/><rect x="14.7" y="9.3" width="3.6" height="6.4" rx="1.2"/>`,
  },
  "Bremsanlage": {
    color: "#ef4444",
    svg: `<circle cx="12" cy="13" r="7.4"/><circle cx="12" cy="13" r="2.1"/><circle cx="12" cy="7.2" r="0.55" fill="currentColor" stroke="none"/><circle cx="16.8" cy="16.2" r="0.55" fill="currentColor" stroke="none"/><circle cx="7.2" cy="16.2" r="0.55" fill="currentColor" stroke="none"/><rect x="8.3" y="2.6" width="7.4" height="5.6" rx="1.3"/>`,
  },
  "Elektrik & Elektronik": {
    color: "#eab308",
    svg: `<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" stroke="none"/>`,
  },
  "Bus-Systeme & Diagnose": {
    color: "#a855f7",
    svg: `<line x1="3" y1="12" x2="21" y2="12"/><line x1="6" y1="12" x2="6" y2="6.5"/><line x1="12" y1="12" x2="12" y2="17.5"/><line x1="18" y1="12" x2="18" y2="6.5"/><circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"/>`,
  },
  "Hochvolt": {
    color: "#f59e0b",
    svg: `<path d="M12 3 2 20h20L12 3Z"/><path d="M13.2 9l-4 6h3l-1 4 5-7h-3l1-3Z" fill="currentColor" stroke="none"/>`,
  },
  "Klimaanlage": {
    color: "#22d3ee",
    svg: `<path d="M12 2v20M4 6.5l16 11M20 6.5 4 17.5"/><path d="M12 2 9.8 4.2M12 2l2.2 2.2M12 22l-2.2-2.2M12 22l2.2-2.2M4 6.5l3 .3M4 6.5l.7-2.9M20 6.5l-3 .3M20 6.5l-.7-2.9M4 17.5l3-.3M4 17.5l.7 2.9M20 17.5l-3-.3M20 17.5l-.7 2.9"/>`,
  },
};

const DEFAULT_ICON = {
  color: "#4c8dff",
  svg: `<path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.3 2.3-2-2 2.3-2.3Z"/>`,
};

function iconForCategory(name) {
  const def = CATEGORY_ICONS[name] || DEFAULT_ICON;
  return `<svg class="cat-icon" style="color:${def.color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${def.svg}</svg>`;
}

const els = {
  profileGate: document.getElementById("profileGate"),
  profileButtons: document.querySelectorAll(".profile-btn"),
  activeProfileBadge: document.getElementById("activeProfileBadge"),
  profileBadgeButtons: document.querySelectorAll(".profile-badge-btn"),
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

  examCountdownText: document.getElementById("examCountdownText"),
  heroBtn: document.getElementById("heroBtn"),
  heroRingFill: document.getElementById("heroRingFill"),
  heroRingPct: document.getElementById("heroRingPct"),
  merkBtn: document.getElementById("merkBtn"),
  merkCount: document.getElementById("merkCount"),
  topicList: document.getElementById("topicList"),
  noTopics: document.getElementById("noTopics"),

  streakBtn: document.getElementById("streakBtn"),
  streakFlame: document.getElementById("streakFlame"),
  streakCount: document.getElementById("streakCount"),
  streakSub: document.getElementById("streakSub"),
  streakVersus: document.getElementById("streakVersus"),
  examVersus: document.getElementById("examVersus"),

  battleVersus: document.getElementById("battleVersus"),
  battleWinner: document.getElementById("battleWinner"),
  battleTopics: document.getElementById("battleTopics"),
  battleTopicsToggle: document.getElementById("battleTopicsToggle"),

  statsSummary: document.getElementById("statsSummary"),
  examStatsSummary: document.getElementById("examStatsSummary"),
  statsList: document.getElementById("statsList"),

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
  resultPassBadge: document.getElementById("resultPassBadge"),
  resultExamCount: document.getElementById("resultExamCount"),
  resultRepeatBtn: document.getElementById("resultRepeatBtn"),
  resultHomeBtn: document.getElementById("resultHomeBtn"),

  examBtn: document.getElementById("examBtn"),

  toast: document.getElementById("toast"),
};

// Erzwingt Vollbild-Overlay per Inline-Style, unabhängig von der externen CSS-Datei
// (Absicherung gegen veraltete/gecachte Stylesheets auf einzelnen Geräten).
els.profileGate.style.cssText =
  "position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;" +
  "z-index:999999;background:#000;display:flex;align-items:center;justify-content:center;" +
  "padding:24px;margin:0;box-sizing:border-box;";

let allCards = [];
let deck = [];
let currentIndex = 0;
let currentTopic = ALL_TOPIC;
let currentFilter = "all";
let sessionMode = "topic"; // "topic" | "simulation"
let sessionResults = { right: 0, wrong: 0 };
let topicAnsweredCount = 0;
let hardSessionTotal = 0; // Anzahl "falscher" Karten zu Beginn der aktuellen Wiederholungsrunde
let sessionEndKind = "topic"; // "topic" | "simulation" – welcher Modus gerade beendet wurde
let sessionEndTopic = ALL_TOPIC;
let simInterval = null;
let simRemaining = 0;
let progress = { known: {}, hard: {} };
let streak = { count: 0, lastClaim: 0 };
let examStats = { count: 0, right: 0, wrong: 0, passed: 0 };

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${currentProfile}`));
    return { known: parsed?.known || {}, hard: parsed?.hard || {} };
  } catch {
    return { known: {}, hard: {} };
  }
}

function saveProgress() {
  localStorage.setItem(`${STORAGE_KEY}_${currentProfile}`, JSON.stringify(progress));
  pushProgressToCloud();
}

// --- Streak-System ---
// Einmal pro Tag (frühestens 24h nach dem letzten Mal) holt man sich eine
// Flamme ab. Wird die 48h-Grenze seit dem letzten Abholen überschritten,
// ist die Streak gerissen und beginnt wieder bei 1.

function loadStreak() {
  try {
    return { count: 0, lastClaim: 0, ...JSON.parse(localStorage.getItem(`${STREAK_KEY}_${currentProfile}`)) };
  } catch {
    return { count: 0, lastClaim: 0 };
  }
}

function loadProfileStreak(id) {
  try {
    return { count: 0, lastClaim: 0, ...JSON.parse(localStorage.getItem(`${STREAK_KEY}_${id}`)) };
  } catch {
    return { count: 0, lastClaim: 0 };
  }
}

function saveStreak() {
  localStorage.setItem(`${STREAK_KEY}_${currentProfile}`, JSON.stringify(streak));
  pushStreakToCloud();
}

function canClaimStreak() {
  return !streak.lastClaim || (Date.now() - streak.lastClaim) >= STREAK_MIN_GAP_MS;
}

function claimStreak() {
  if (!canClaimStreak()) return;
  const now = Date.now();
  if (streak.lastClaim && (now - streak.lastClaim) <= STREAK_GRACE_MS) {
    streak.count += 1;
  } else {
    streak.count = 1;
  }
  streak.lastClaim = now;
  saveStreak();
  renderStreak();
  renderBattle();
  playStreakClaimAnimation();
  showToast(`🔥 Tag ${streak.count} der Streak!`);
}

function playStreakClaimAnimation() {
  const flame = els.streakFlame;
  const card = els.streakBtn;
  if (!flame || !card) return;

  flame.classList.remove("streak-pop");
  card.classList.remove("streak-burst");
  void flame.offsetWidth; // Reflow, damit die Animation bei schnellem erneutem Abholen neu startet
  flame.classList.add("streak-pop");
  card.classList.add("streak-burst");
  setTimeout(() => {
    flame.classList.remove("streak-pop");
    card.classList.remove("streak-burst");
  }, 700);

  const rect = flame.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("span");
    p.className = "streak-particle";
    p.textContent = "🔥";
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.4;
    const dist = 40 + Math.random() * 24;
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    document.body.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
    setTimeout(() => p.remove(), 900); // Sicherheitsnetz, falls animationend nicht feuert
  }
}

// --- Prüfungssimulation-Statistik ---
// Zählt über alle Prüfungssimulationen hinweg mit, wie viele schon
// gemacht wurden und wie viele Fragen dabei insgesamt richtig/falsch
// beantwortet wurden - für die eigene Statistik und den Battle-Vergleich.

function loadExamStats() {
  try {
    return { count: 0, right: 0, wrong: 0, passed: 0, ...JSON.parse(localStorage.getItem(`${EXAM_STATS_KEY}_${currentProfile}`)) };
  } catch {
    return { count: 0, right: 0, wrong: 0, passed: 0 };
  }
}

function loadProfileExamStats(id) {
  try {
    return { count: 0, right: 0, wrong: 0, passed: 0, ...JSON.parse(localStorage.getItem(`${EXAM_STATS_KEY}_${id}`)) };
  } catch {
    return { count: 0, right: 0, wrong: 0, passed: 0 };
  }
}

function saveExamStats() {
  localStorage.setItem(`${EXAM_STATS_KEY}_${currentProfile}`, JSON.stringify(examStats));
  pushExamStatsToCloud();
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

function pushStreakToCloud() {
  if (!currentProfile) return;
  fetch(`${DB_URL}/streak/${currentProfile}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(streak),
  }).then((res) => {
    if (!res.ok) warnCloudSyncOnce(`Upload HTTP ${res.status}`);
  }).catch((e) => warnCloudSyncOnce(e.message || "Upload fehlgeschlagen"));
}

function pushExamStatsToCloud() {
  if (!currentProfile) return;
  fetch(`${DB_URL}/examstats/${currentProfile}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(examStats),
  }).then((res) => {
    if (!res.ok) warnCloudSyncOnce(`Upload HTTP ${res.status}`);
  }).catch((e) => warnCloudSyncOnce(e.message || "Upload fehlgeschlagen"));
}

async function syncFromCloud() {
  try {
    let changed = false;

    const res = await fetch(`${DB_URL}/progress.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) { warnCloudSyncOnce(`Download HTTP ${res.status}`); return; }
    const data = await res.json();

    if (data) {
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
    }

    // Streak: pro Profil gewinnt immer der Stand mit dem neueren "lastClaim" -
    // das ist das Gerät, auf dem zuletzt tatsächlich abgeholt wurde.
    const streakRes = await fetch(`${DB_URL}/streak.json?ts=${Date.now()}`, { cache: "no-store" });
    if (streakRes.ok) {
      const streakData = await streakRes.json();
      if (streakData) {
        Object.keys(PROFILES).forEach((id) => {
          if (!streakData[id]) return;
          if (id === currentProfile) {
            if ((streakData[id].lastClaim || 0) > (streak.lastClaim || 0)) {
              streak = streakData[id];
              localStorage.setItem(`${STREAK_KEY}_${id}`, JSON.stringify(streak));
              changed = true;
            } else if ((streak.lastClaim || 0) > (streakData[id].lastClaim || 0)) {
              pushStreakToCloud(); // lokaler Stand ist neuer, wieder hochladen
            }
          } else {
            localStorage.setItem(`${STREAK_KEY}_${id}`, JSON.stringify(streakData[id]));
            changed = true;
          }
        });
      }
    }

    // Prüfungsstatistik: pro Profil gewinnt der Stand mit der höheren
    // Prüfungsanzahl - das ist der vollständigere Verlauf.
    const examRes = await fetch(`${DB_URL}/examstats.json?ts=${Date.now()}`, { cache: "no-store" });
    if (examRes.ok) {
      const examData = await examRes.json();
      if (examData) {
        Object.keys(PROFILES).forEach((id) => {
          if (!examData[id]) return;
          if (id === currentProfile) {
            if ((examData[id].count || 0) > (examStats.count || 0)) {
              examStats = { count: 0, right: 0, wrong: 0, passed: 0, ...examData[id] };
              localStorage.setItem(`${EXAM_STATS_KEY}_${id}`, JSON.stringify(examStats));
              changed = true;
            } else if ((examStats.count || 0) > (examData[id].count || 0)) {
              pushExamStatsToCloud(); // lokaler Stand ist vollständiger, wieder hochladen
            }
          } else {
            localStorage.setItem(`${EXAM_STATS_KEY}_${id}`, JSON.stringify(examData[id]));
            changed = true;
          }
        });
      }
    }

    if (changed) {
      safeCall(renderHome, "Home");
      safeCall(renderStats, "Statistik");
      safeCall(renderStreak, "Streak");
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

// Führt fn aus und fängt Fehler ab, damit z. B. ein kaputter Render-Aufruf
// weder den Tab-Wechsel blockiert noch sich fälschlich als "Sync fehlgeschlagen"
// ausgibt. Zeigt den echten Fehlertext an, damit er sich melden/screenshotten lässt.
function safeCall(fn, label) {
  try {
    fn();
  } catch (e) {
    console.error(`Fehler in ${label}:`, e);
    showToast(`⚠️ Fehler (${label}): ${e.message}`, 5000);
  }
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
    safeCall(renderHome, "Home");
    safeCall(renderStats, "Statistik");
    safeCall(renderExplainList, "Erklärungen");
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
        safeCall(renderHome, "Home");
        safeCall(renderStats, "Statistik");
        safeCall(renderExplainList, "Erklärungen");
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

function switchTab(tabId, { remember = true, animate = true } = {}) {
  const fromId = TAB_ORDER[activeTabIndex];
  const fromEl = els[fromId];
  const toEl = els[tabId];
  const isRealSwitch = animate && fromEl && toEl && fromEl !== toEl && !fromEl.hidden;
  const direction = TAB_ORDER.indexOf(tabId) > activeTabIndex ? 1 : -1;

  activeTabIndex = TAB_ORDER.indexOf(tabId);
  els.tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
  if (tabId === "tabStats") safeCall(renderStats, "Statistik");
  if (tabId === "tabExplain") safeCall(renderExplainList, "Erklärungen");
  if (remember) localStorage.setItem(ACTIVE_TAB_KEY, tabId);
  window.scrollTo(0, 0);

  if (!isRealSwitch) {
    [els.tabHome, els.tabStats, els.tabExplain, els.tabSettings].forEach((el) => {
      el.hidden = el.id !== tabId;
    });
    return;
  }
  slideTabs(fromEl, toEl, direction);
}

// Flüssiger Wechsel zwischen zwei Tabs: beim Vorwärtswechseln (z. B. durch
// Wischen nach links) kommt das neue Tab von rechts nach Mitte
// hereingeglitten, während das alte nach links hinausgleitet - spiegelbildlich
// zur Fingerbewegung. Beim Zurückwechseln läuft es genau andersherum.
function slideTabs(fromEl, toEl, direction) {
  const enterFrom = direction === 1 ? 100 : -100;
  const exitTo = direction === 1 ? -100 : 100;

  toEl.hidden = false;
  [fromEl, toEl].forEach((el) => el.classList.add("tab-sliding"));

  toEl.style.transition = "none";
  toEl.style.transform = `translateX(${enterFrom}%)`;
  fromEl.style.transition = "none";
  fromEl.style.transform = "translateX(0%)";

  tabContent.style.height = `${Math.max(fromEl.offsetHeight, toEl.offsetHeight)}px`;
  void toEl.offsetHeight; // Reflow erzwingen, damit die Startposition vor der Animation greift

  toEl.style.transition = "";
  fromEl.style.transition = "";
  toEl.style.transform = "translateX(0%)";
  fromEl.style.transform = `translateX(${exitTo}%)`;

  clearTimeout(slideTabs._t);
  slideTabs._t = setTimeout(() => {
    fromEl.hidden = true;
    [fromEl, toEl].forEach((el) => {
      el.classList.remove("tab-sliding");
      el.style.transform = "";
      el.style.transition = "";
    });
    tabContent.style.height = "";
  }, 340);
}

els.tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

els.battleTopicsToggle.addEventListener("click", () => {
  const expanded = els.battleTopicsToggle.getAttribute("aria-expanded") === "true";
  els.battleTopicsToggle.setAttribute("aria-expanded", String(!expanded));
  els.battleTopics.hidden = expanded;
});

// Zwischen den Tabs wischen (wie zwischen iPhone-Homescreen-Seiten) - sowohl im
// Inhaltsbereich als auch direkt auf der unteren Tab-Leiste.
const tabContent = document.getElementById("tabContent");
const tabbarEl = document.querySelector(".tabbar");
let tabTouchStartX = null;
let tabTouchStartY = null;

function onTabSwipeStart(e) {
  if (!els.studyView.hidden) return;
  tabTouchStartX = e.touches[0].clientX;
  tabTouchStartY = e.touches[0].clientY;
}

function onTabSwipeEnd(e) {
  if (tabTouchStartX === null) return;
  const dx = e.changedTouches[0].clientX - tabTouchStartX;
  const dy = e.changedTouches[0].clientY - tabTouchStartY;
  tabTouchStartX = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0 && activeTabIndex < TAB_ORDER.length - 1) switchTab(TAB_ORDER[activeTabIndex + 1]);
    else if (dx > 0 && activeTabIndex > 0) switchTab(TAB_ORDER[activeTabIndex - 1]);
  }
}

tabContent.addEventListener("touchstart", onTabSwipeStart, { passive: true });
tabContent.addEventListener("touchend", onTabSwipeEnd, { passive: true });
tabbarEl.addEventListener("touchstart", onTabSwipeStart, { passive: true });
tabbarEl.addEventListener("touchend", onTabSwipeEnd, { passive: true });

// --- Home ---

function categories() {
  return Array.from(new Set(allCards.map((c) => c.category || "Allgemein"))).sort();
}

function cardState(id) {
  if (progress.known[id]) return "known";
  if (progress.hard[id]) return "hard";
  return "new";
}

function renderExamCountdown() {
  if (!els.examCountdownText) return;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((FINAL_EXAM_DATE - todayMidnight) / (1000 * 60 * 60 * 24));

  if (days > 1) {
    els.examCountdownText.textContent = `Noch ${days} Tage bis zur Abschlussprüfung`;
  } else if (days === 1) {
    els.examCountdownText.textContent = "Noch 1 Tag bis zur Abschlussprüfung";
  } else if (days === 0) {
    els.examCountdownText.textContent = "Heute ist die Abschlussprüfung – viel Erfolg! 🍀";
  } else {
    els.examCountdownText.textContent = "Die Abschlussprüfung ist vorbei";
  }
}

function renderHome() {
  renderExamCountdown();
  const total = allCards.length;
  const known = allCards.filter((c) => progress.known[c.id]).length;
  const pct = total ? Math.round((known / total) * 100) : 0;
  els.heroRingPct.textContent = pct;
  setRing(els.heroRingFill, 27, pct);
  els.heroBtn.hidden = total === 0;

  const hardCount = allCards.filter((c) => progress.hard[c.id]).length;
  els.merkCount.textContent = hardCount;
  els.merkBtn.hidden = total === 0;
  els.examBtn.hidden = total === 0;

  const cats = categories();
  els.noTopics.hidden = cats.length > 0;
  els.topicList.innerHTML = "";

  cats.forEach((cat) => {
    const cardsInCat = allCards.filter((c) => (c.category || "Allgemein") === cat);
    const knownInCat = cardsInCat.filter((c) => progress.known[c.id]).length;
    const totalInCat = cardsInCat.length;
    const pctCat = totalInCat ? Math.round((knownInCat / totalInCat) * 100) : 0;

    const wrap = document.createElement("div");
    wrap.className = "topic-item-wrap";

    const item = document.createElement("div");
    item.className = "topic-item topic-item-btn";
    item.setAttribute("role", "button");
    item.tabIndex = 0;
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
    item.addEventListener("click", () => openTopic(cat, "all"));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openTopic(cat, "all");
      }
    });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "topic-reset-btn";
    resetBtn.setAttribute("aria-label", `Fortschritt für ${cat} zurücksetzen`);
    resetBtn.textContent = "✕";
    resetBtn.addEventListener("click", () => resetTopicProgress(cat));

    wrap.appendChild(item);
    wrap.appendChild(resetBtn);
    els.topicList.appendChild(wrap);
  });
}

function renderStreak() {
  if (!els.streakBtn) return;
  els.streakCount.textContent = streak.count;
  const ready = canClaimStreak();
  els.streakBtn.classList.toggle("is-ready", ready);
  els.streakBtn.classList.toggle("has-streak", streak.count > 0);

  if (ready) {
    els.streakSub.textContent = "Jetzt abholen";
  } else {
    const remainingMs = streak.lastClaim + STREAK_MIN_GAP_MS - Date.now();
    const hours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
    els.streakSub.textContent = `Nächste Flamme in ${hours} Std.`;
  }
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
    const parsed = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${id}`));
    return { known: parsed?.known || {}, hard: parsed?.hard || {} };
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

  if (els.streakVersus) {
    els.streakVersus.innerHTML = ids.map((id) => {
      const s = loadProfileStreak(id);
      return `
        <div class="streak-versus-item${s.count > 0 ? " has-streak" : ""}">
          <span class="streak-versus-flame">🔥</span>${escapeHtml(PROFILES[id].name)}: ${s.count}
        </div>
      `;
    }).join("");
  }

  if (els.examVersus) {
    els.examVersus.innerHTML = ids.map((id) => {
      const es = loadProfileExamStats(id);
      return `
        <div class="exam-versus-item">
          <span class="exam-versus-name">🎓 ${escapeHtml(PROFILES[id].name)}</span>
          <span class="exam-versus-detail">${es.count} Prüfungen · ${es.passed} bestanden · ${es.right} ✓ · ${es.wrong} ✗</span>
        </div>
      `;
    }).join("");
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
    <div class="stat-tile"><div class="stat-value" style="color:var(--wrong)">${hard}</div><div class="stat-label">falsch</div></div>
  `;

  if (els.examStatsSummary) {
    els.examStatsSummary.innerHTML = `
      <div class="stat-tile"><div class="stat-value">${examStats.count}</div><div class="stat-label">Prüfungen</div></div>
      <div class="stat-tile"><div class="stat-value" style="color:var(--right)">${examStats.passed}/${examStats.count}</div><div class="stat-label">bestanden</div></div>
      <div class="stat-tile"><div class="stat-value" style="color:var(--right)">${examStats.right}</div><div class="stat-label">richtig</div></div>
      <div class="stat-tile"><div class="stat-value" style="color:var(--wrong)">${examStats.wrong}</div><div class="stat-label">falsch</div></div>
    `;
  }

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

    <h2>Generator (Lichtmaschine) im Detail</h2>
    <div class="explain-diagram">
      <svg viewBox="0 0 300 140" width="100%">
        <g font-family="sans-serif" font-size="10" fill="var(--text)">
          <rect x="8" y="50" width="72" height="46" rx="6" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <text x="44" y="68" text-anchor="middle">Rotor</text>
          <text x="44" y="80" text-anchor="middle" font-size="8.5" fill="var(--muted)">Erreger-</text>
          <text x="44" y="90" text-anchor="middle" font-size="8.5" fill="var(--muted)">wicklung</text>
          <circle cx="26" cy="105" r="3" fill="var(--sim)"/>
          <circle cx="38" cy="105" r="3" fill="var(--sim)"/>
          <text x="44" y="119" text-anchor="middle" font-size="8" fill="var(--muted)">Schleifringe</text>

          <rect x="102" y="38" width="72" height="70" rx="6" fill="none" stroke="var(--wrong)" stroke-width="2"/>
          <text x="138" y="58" text-anchor="middle">Stator</text>
          <text x="138" y="71" text-anchor="middle" font-size="8.5" fill="var(--muted)">3 Wicklungen</text>
          <text x="138" y="83" text-anchor="middle" font-size="8.5" fill="var(--muted)">im Stern</text>

          <rect x="196" y="53" width="56" height="42" rx="6" fill="none" stroke="var(--right)" stroke-width="2"/>
          <text x="224" y="70" text-anchor="middle" font-size="9">Gleich-</text>
          <text x="224" y="82" text-anchor="middle" font-size="9">richter</text>

          <rect x="266" y="58" width="28" height="32" rx="4" fill="none" stroke="var(--text)" stroke-width="2"/>
          <text x="280" y="102" text-anchor="middle" font-size="8.5">Bordnetz</text>

          <path d="M80 73 L102 73" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrGen)"/>
          <path d="M174 73 L196 73" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrGen)"/>
          <path d="M252 73 L266 73" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrGen)"/>
          <defs>
            <marker id="arrGen" markerWidth="6" markerHeight="6" refX="4" refY="2" orient="auto">
              <path d="M0 0 L4 2 L0 4 Z" fill="var(--muted)"/>
            </marker>
          </defs>
        </g>
      </svg>
      <figcaption>Der Rotor mit Erregerwicklung (Strom über Schleifringe/Kohlebürsten) dreht im feststehenden Stator. Die dort in den drei sternverschalteten Wicklungen induzierte Wechselspannung wird über die Gleichrichterbrücke in Gleichspannung für Batterie und Bordnetz umgewandelt.</figcaption>
    </div>
    <p>Der <strong>Klauenpolrotor</strong> trägt die vom Regler gesteuerte Erregerwicklung und meist 12 oder 14 klauenförmige Pole - je mehr Pole, desto höher die elektrische Frequenz bei gleicher Drehzahl und desto gleichmäßiger die spätere Gleichspannung. Der Erregerstrom gelangt über zwei <strong>Schleifringe</strong> und federnd angedrückte <strong>Kohlebürsten</strong> auf die rotierende Welle. Die drei Phasenwicklungen des <strong>Stators</strong> sind meist im <strong>Stern</strong> geschaltet (alle drei Enden treffen sich im Sternpunkt) - das liefert bei gleichem Wicklungsstrom eine höhere Spannung als eine Dreieckschaltung, wichtig für ausreichende Ladung schon bei niedriger Leerlaufdrehzahl.</p>
    <p>Die erzeugte Drehstrom-Wechselspannung wird von einer <strong>Gleichrichterbrücke</strong> aus sechs Leistungsdioden (je eine Plus- und eine Minus-Diode pro Phase) in pulsierende Gleichspannung umgewandelt. Der <strong>Spannungsregler</strong> hält die Bordnetzspannung dabei unabhängig von Drehzahl und Last bei rund 14,4 Volt konstant, indem er den Erregerstrom im Rotor dosiert. Vor dem Start liefert die Batterie diesen Erregerstrom über den Vorerregerkreis (meist über die Ladekontrollleuchte als Vorwiderstand) - sobald der Generator selbst genug Spannung erzeugt (Selbsterregung), erlischt die Leuchte. Moderne Steuergeräte regeln die Erregung zusätzlich bedarfsgerecht: stark im Schubbetrieb (Bremsen), schwach beim Beschleunigen, um Kraftstoff zu sparen.</p>
    <div class="explain-example"><strong>Beispiel:</strong> Leuchtet die Ladekontrollleuchte bei laufendem Motor dauerhaft, lädt der Generator nicht ausreichend - mögliche Ursachen sind ein gerissener Keilrippenriemen, verschlissene Kohlebürsten, ein defekter Regler oder eine defekte Diode in der Gleichrichterbrücke.</div>

    <h2>Anlasser (Starter) im Detail</h2>
    <div class="explain-diagram">
      <svg viewBox="0 0 300 145" width="100%">
        <g font-family="sans-serif" font-size="10" fill="var(--text)">
          <rect x="8" y="8" width="82" height="32" rx="6" fill="none" stroke="var(--text)" stroke-width="2"/>
          <text x="49" y="28" text-anchor="middle" font-size="9">Batterie (Kl. 30)</text>

          <rect x="8" y="105" width="82" height="32" rx="6" fill="none" stroke="var(--sim)" stroke-width="2"/>
          <text x="49" y="120" text-anchor="middle" font-size="9">Zündschloss</text>
          <text x="49" y="132" text-anchor="middle" font-size="8.5" fill="var(--muted)">(Kl. 50)</text>

          <rect x="120" y="52" width="80" height="46" rx="6" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <text x="160" y="70" text-anchor="middle">Magnet-</text>
          <text x="160" y="82" text-anchor="middle">schalter</text>
          <text x="160" y="93" text-anchor="middle" font-size="8" fill="var(--muted)">Einzug + Halte</text>

          <rect x="232" y="18" width="62" height="34" rx="6" fill="none" stroke="var(--wrong)" stroke-width="2"/>
          <text x="263" y="38" text-anchor="middle" font-size="9">Ritzel →</text>
          <text x="263" y="49" text-anchor="middle" font-size="8">Zahnkranz</text>

          <rect x="232" y="98" width="62" height="34" rx="6" fill="none" stroke="var(--right)" stroke-width="2"/>
          <text x="263" y="116" text-anchor="middle" font-size="9">Anlasser-</text>
          <text x="263" y="127" text-anchor="middle" font-size="9">motor</text>

          <path d="M90 24 L120 66" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrAnl)"/>
          <path d="M90 121 L120 84" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrAnl)"/>
          <path d="M200 66 L232 38" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrAnl)"/>
          <path d="M200 89 L232 115" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrAnl)"/>
          <defs>
            <marker id="arrAnl" markerWidth="6" markerHeight="6" refX="4" refY="2" orient="auto">
              <path d="M0 0 L4 2 L0 4 Z" fill="var(--muted)"/>
            </marker>
          </defs>
        </g>
      </svg>
      <figcaption>Batterie (Klemme 30) und Zündschloss (Klemme 50) laufen im Magnetschalter zusammen: er schiebt mechanisch das Ritzel in den Zahnkranz und schaltet elektrisch den Hauptstrom zum Anlassermotor.</figcaption>
    </div>
    <p>Ein klassischer Schubschraubtrieb-Anlasser besteht aus einem <strong>Elektromotor</strong>, dem <strong>Magnetschalter</strong> (Einrückrelais), dem <strong>Ritzel</strong> und einer <strong>Freilaufkupplung</strong>. Der Anlassermotor ist meist als <strong>Reihenschluss-Gleichstrommotor</strong> ausgeführt: Feld- und Ankerwicklung liegen im selben Stromkreis, was gerade bei hohem Strom und niedriger Drehzahl ein sehr hohes Anzugsmoment liefert - genau das, was zum Durchdrehen des stehenden, kalten Verbrennungsmotors nötig ist.</p>
    <p>Der Magnetschalter besitzt zwei Wicklungen: Beim Einschalten (Klemme 50 vom Zündschloss) ziehen <strong>Einzugswicklung</strong> und <strong>Haltewicklung</strong> gemeinsam den Anker und damit das Ritzel in den Zahnkranz des Schwungrads - dieser <strong>Einspurvorgang</strong> läuft zweistufig ab: Erst wenn das Ritzel eingespurt ist, schließt derselbe Magnetschalter den Hauptstromkreis von Klemme 30 (Batterie) zum Anlassermotor. Die Einzugswicklung wird dabei stromlos, da sie nun auf beiden Seiten an Plus liegt - nur die schwächere Haltewicklung hält das Ritzel noch eingespurt, das spart Strom. Sobald der Verbrennungsmotor anspringt und schneller dreht als der Anlasser, lässt die <strong>Freilaufkupplung</strong> das Ritzel durchrutschen und schützt den Anlassermotor vor zerstörerisch hohen Drehzahlen.</p>
    <div class="explain-example"><strong>Beispiel:</strong> Dreht der Anlasser hörbar frei, ohne den Motor mitzunehmen, sind meist Ritzel, Zahnkranz oder die Freilaufkupplung defekt. Ist dagegen nur ein Klacken zu hören und der Anlasser dreht gar nicht durch, deutet das eher auf verschlissene Magnetschalter-Kontakte oder einen zu starken Spannungseinbruch (schwache Batterie) hin.</div>
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

  "Klimaanlage": `
    <span class="explain-eyebrow">Themengebiet</span>
    <h1>Klimaanlage</h1>
    <p class="explain-lead">Die Kfz-Klimaanlage kühlt und entfeuchtet die Innenraumluft, indem sie ein Kältemittel in einem geschlossenen Kreislauf abwechselnd verdichtet, abkühlt, entspannt und wieder verdampfen lässt.</p>

    <h2>Der Kältemittelkreislauf</h2>
    <div class="explain-diagram">
      <svg viewBox="0 0 300 130" width="100%">
        <g font-family="sans-serif" font-size="10.5" fill="var(--text)">
          <rect x="12" y="45" width="56" height="36" rx="6" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <text x="40" y="65" text-anchor="middle">Kompressor</text>
          <text x="40" y="78" text-anchor="middle" font-size="9" fill="var(--muted)">verdichtet</text>

          <rect x="98" y="15" width="56" height="36" rx="6" fill="none" stroke="var(--wrong)" stroke-width="2"/>
          <text x="126" y="35" text-anchor="middle">Kondensator</text>
          <text x="126" y="48" text-anchor="middle" font-size="9" fill="var(--muted)">kühlt ab</text>

          <rect x="184" y="45" width="56" height="36" rx="6" fill="none" stroke="var(--sim)" stroke-width="2"/>
          <text x="212" y="65" text-anchor="middle">Expansions-</text>
          <text x="212" y="77" text-anchor="middle">ventil</text>

          <rect x="98" y="90" width="56" height="36" rx="6" fill="none" stroke="var(--right)" stroke-width="2"/>
          <text x="126" y="110" text-anchor="middle">Verdampfer</text>
          <text x="126" y="123" text-anchor="middle" font-size="9" fill="var(--muted)">kühlt Luft</text>

          <path d="M68 55 L98 40" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrKlima)"/>
          <path d="M154 33 L184 55" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrKlima)"/>
          <path d="M212 81 L212 90 L154 105" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrKlima)"/>
          <path d="M98 108 L68 80" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#arrKlima)"/>
          <defs>
            <marker id="arrKlima" markerWidth="6" markerHeight="6" refX="4" refY="2" orient="auto">
              <path d="M0 0 L4 2 L0 4 Z" fill="var(--muted)"/>
            </marker>
          </defs>
        </g>
      </svg>
      <figcaption>Kreislauf: Kompressor verdichtet das Kältemittelgas → Kondensator kühlt es zu Flüssigkeit ab → Expansionsventil entspannt es → Verdampfer nimmt Wärme aus der Innenraumluft auf, das Gas strömt zurück zum Kompressor.</figcaption>
    </div>
    <p>Der <strong>Kompressor</strong> verdichtet das gasförmige Kältemittel, wodurch Druck und Temperatur stark steigen. Im <strong>Kondensator</strong> (meist vorne am Fahrzeug) gibt das heiße Gas Wärme an die Umgebungsluft ab und wird dabei flüssig. Das <strong>Expansionsventil</strong> entspannt die Flüssigkeit schlagartig auf niedrigen Druck, wodurch sie stark abkühlt. Im <strong>Verdampfer</strong> nimmt das kalte Kältemittel Wärme aus der durchströmenden Innenraumluft auf und verdampft dabei wieder – die Luft kühlt ab, ihre Feuchtigkeit kondensiert an den kalten Lamellen und tropft ab.</p>
    <div class="explain-example"><strong>Beispiel:</strong> Deshalb entfeuchtet die Klimaanlage auch beschlagene Scheiben zuverlässiger als reines Heizen – die Luft wird am kalten Verdampfer entfeuchtet und danach bei Bedarf wieder erwärmt.</div>

    <h2>Kältemittel</h2>
    <p>Modernere Fahrzeuge nutzen <strong>R1234yf</strong> statt des älteren <strong>R134a</strong>, da es ein deutlich geringeres Treibhauspotenzial (GWP) besitzt und so die EU-Vorgaben erfüllt. Die beiden Kältemittel sind nicht austauschbar oder mischbar. Dem Kältemittel ist zusätzlich ein spezielles Öl beigemischt, das im ganzen Kreislauf mitzirkuliert und die beweglichen Teile des Kompressors schmiert.</p>

    <h2>Weitere wichtige Bauteile</h2>
    <ul>
      <li><strong>Trockner/Sammler:</strong> bindet Restfeuchtigkeit im Kältemittel und dient als Ausgleichsspeicher.</li>
      <li><strong>Innenraumfilter (Pollenfilter):</strong> hält Pollen, Staub und teils Schadstoffe aus der angesaugten Luft zurück.</li>
      <li><strong>Hochdruckschalter:</strong> schaltet den Kompressor bei unzulässig hohem Druck sicherheitshalber ab.</li>
      <li><strong>Verdampfertemperatursensor:</strong> verhindert ein Vereisen des Verdampfers durch rechtzeitiges Abschalten.</li>
    </ul>

    <h2>Wartung und Umweltschutz</h2>
    <p>Da austretendes Kältemittel klimaschädlich wirken kann, ist die Anlage bei Arbeiten <strong>dicht zu prüfen</strong>, und vor dem Neubefüllen wird sie mit einer Vakuumpumpe <strong>evakuiert</strong>, um Luft und Feuchtigkeit zu entfernen. Für den fachgerechten Umgang mit Kältemitteln ist ein anerkannter Sachkundenachweis vorgeschrieben. Auch im Winter sollte die Klimaanlage regelmäßig kurz laufen, damit die Dichtungen durch das mitgeführte Öl geschmeidig bleiben.</p>

    <h2>Klimaanlage bei Elektrofahrzeugen</h2>
    <p>Ohne Verbrennungsmotor fehlt sowohl die Abwärme zum Heizen als auch ein Riementrieb für den Kompressor. Elektrofahrzeuge nutzen daher einen <strong>elektrisch angetriebenen Kompressor</strong> sowie häufig eine <strong>Wärmepumpe</strong>, die denselben Kältemittelkreislauf in umgekehrter Betriebsweise nutzt, um der Umgebung Wärme zu entziehen und effizient in den Innenraum zu leiten – das schont die Reichweite gegenüber einer reinen elektrischen Widerstandsheizung.</p>
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
  const categoryCards = allCards.filter(
    (c) => currentTopic === ALL_TOPIC || (c.category || "Allgemein") === currentTopic
  );

  let pool;
  if (currentFilter === "hard") {
    pool = categoryCards.filter((c) => cardState(c.id) === "hard");
    hardSessionTotal = pool.length;
  } else {
    // Beim normalen Üben zuerst noch nie beantwortete Fragen zeigen, damit
    // schon beantwortete nicht sofort wiederkommen. Erst wenn wirklich jede
    // Frage im Thema mindestens einmal beantwortet wurde (oder das Thema
    // zurückgesetzt wurde), startet ein neuer voller Durchlauf.
    const unseen = categoryCards.filter((c) => cardState(c.id) === "new");
    pool = unseen.length > 0 ? unseen : categoryCards;
  }

  deck = shuffled(pool);
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
  } else if (currentFilter === "hard") {
    // Zeigt die Anzahl der falschen Fragen zu Beginn dieser Runde und wie
    // viele davon schon wieder richtig beantwortet (und damit aus dem
    // Deck entfernt) wurden - nicht den Fortschritt über alle Themenkarten.
    const resolvedCount = Math.max(0, hardSessionTotal - deck.length);
    els.progressFill.style.width = hardSessionTotal ? `${(resolvedCount / hardSessionTotal) * 100}%` : "0%";
    els.progressText.textContent = `${resolvedCount} / ${hardSessionTotal} beantwortet`;
  } else {
    // Im "Alle Fragen"-Durchlauf zählt jede beantwortete Frage (richtig oder
    // falsch) als erledigt, da sie in diesem Durchlauf nicht wiederkommt.
    const scope = allCards.filter((c) => currentTopic === ALL_TOPIC || (c.category || "Allgemein") === currentTopic);
    const doneCount = scope.filter((c) => progress.known[c.id] || progress.hard[c.id]).length;
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

function shuffled(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

let lastSimFixedCount = null; // merkt sich eine feste Fragenzahl (z. B. die 40er-Prüfungssimulation) fürs Wiederholen
let currentExamTotal = 0; // Gesamtzahl der Fragen der laufenden Prüfungssimulation (für die 75%-Bestehensgrenze)

function startSimulation(fixedCount) {
  if (!allCards.length) return;
  sessionMode = "simulation";
  sessionResults = { right: 0, wrong: 0 };
  lastSimFixedCount = fixedCount || null;
  const count = Math.min(fixedCount || 40, allCards.length);
  currentExamTotal = count;
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

  if (sessionEndKind === "simulation" && currentExamTotal > 0) {
    const examPct = Math.round((right / currentExamTotal) * 100);
    const passed = examPct >= EXAM_PASS_PCT;
    if (els.resultPassBadge) {
      els.resultPassBadge.hidden = false;
      els.resultPassBadge.className = `result-pass-badge ${passed ? "pass" : "fail"}`;
      els.resultPassBadge.textContent = passed
        ? `✅ Bestanden (${examPct}% von ${currentExamTotal} Fragen)`
        : `❌ Nicht bestanden (${examPct}% von ${currentExamTotal} Fragen, ${EXAM_PASS_PCT}% nötig)`;
    }
    if (els.resultExamCount) {
      els.resultExamCount.hidden = false;
      els.resultExamCount.textContent = `Das war deine ${examStats.count}. Prüfungssimulation`;
    }
  } else {
    if (els.resultPassBadge) els.resultPassBadge.hidden = true;
    if (els.resultExamCount) els.resultExamCount.hidden = true;
  }
}

function endSimulation() {
  stopSimTimer();
  sessionEndKind = "simulation";
  examStats.count += 1;
  examStats.right += sessionResults.right;
  examStats.wrong += sessionResults.wrong;
  const examPct = currentExamTotal ? Math.round((sessionResults.right / currentExamTotal) * 100) : 0;
  if (examPct >= EXAM_PASS_PCT) examStats.passed += 1;
  saveExamStats();
  renderStats();
  showResult(sessionResults.right, sessionResults.wrong);
}

function endTopicSession() {
  sessionEndKind = "topic";
  sessionEndTopic = currentTopic;
  showResult(sessionResults.right, sessionResults.wrong);
}

els.examBtn.addEventListener("click", () => startSimulation(40));

els.resultRepeatBtn.addEventListener("click", () => {
  if (sessionEndKind === "simulation") {
    startSimulation(lastSimFixedCount);
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
  streak = loadStreak();
  examStats = loadExamStats();
  rememberProfile(id);

  const name = PROFILES[id].name;
  const badgeHtml = `<img src="${PROFILES[id].avatar}" alt="">${escapeHtml(name)}`;
  els.profileBadgeButtons.forEach((btn) => { btn.innerHTML = badgeHtml; });
  els.settingsProfileName.textContent = name;
  els.profileGate.hidden = true;

  safeCall(renderHome, "Home");
  safeCall(renderStats, "Statistik");
  safeCall(renderStreak, "Streak");
  startCloudSync();
}

els.streakBtn.addEventListener("click", claimStreak);

els.profileButtons.forEach((btn) => {
  btn.addEventListener("click", () => selectProfile(btn.dataset.profile));
});

// Profilwechsel lädt die App neu und vergisst das gemerkte Profil, damit die
// Auswahl wieder erscheint (und kein Timer/Zustand des vorigen Profils übrig bleibt).
els.profileBadgeButtons.forEach((btn) => {
  btn.addEventListener("click", () => { forgetProfile(); location.reload(); });
});
els.switchProfileBtn.addEventListener("click", () => { forgetProfile(); location.reload(); });

// --- Init ---

document.getElementById("appVersion").textContent = APP_VERSION;

const rememberedProfile = getRememberedProfile();
if (rememberedProfile) {
  selectProfile(rememberedProfile);
  const rememberedTab = localStorage.getItem(ACTIVE_TAB_KEY);
  if (rememberedTab && TAB_ORDER.includes(rememberedTab)) {
    switchTab(rememberedTab, { remember: false, animate: false });
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
    if (currentProfile) {
      syncFromCloud();
      renderStreak();
    }
  }
});
