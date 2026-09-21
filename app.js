const STORAGE_KEY = "kfz_progress_v1";

const els = {
  menuBtn: document.getElementById("menuBtn"),
  panel: document.getElementById("panel"),
  categorySelect: document.getElementById("categorySelect"),
  filterSelect: document.getElementById("filterSelect"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  resetBtn: document.getElementById("resetBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  cardArea: document.getElementById("cardArea"),
  emptyState: document.getElementById("emptyState"),
  emptyResetBtn: document.getElementById("emptyResetBtn"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  flashcard: document.getElementById("flashcard"),
  categoryTag: document.getElementById("categoryTag"),
  categoryTagBack: document.getElementById("categoryTagBack"),
  questionText: document.getElementById("questionText"),
  answerText: document.getElementById("answerText"),
  hardBtn: document.getElementById("hardBtn"),
  knownBtn: document.getElementById("knownBtn"),
  toast: document.getElementById("toast"),
};

let allCards = [];
let deck = [];
let currentIndex = 0;
let progress = loadProgress();

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { known: {}, hard: {} };
  } catch {
    return { known: {}, hard: {} };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function showToast(msg, ms = 2000) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { els.toast.hidden = true; }, ms);
}

async function loadCards({ silent = false } = {}) {
  try {
    const res = await fetch(`cards.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("network");
    const data = await res.json();
    const prevCount = allCards.length;
    allCards = data.cards || [];
    populateCategories();
    buildDeck();
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
        populateCategories();
        buildDeck();
      }
    }
    return;
  }
  localStorage.setItem("kfz_cards_cache", JSON.stringify({ cards: allCards }));
}

function populateCategories() {
  const cats = Array.from(new Set(allCards.map((c) => c.category || "Allgemein"))).sort();
  const current = els.categorySelect.value;
  els.categorySelect.innerHTML = '<option value="__all__">Alle Kategorien</option>' +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (cats.includes(current)) els.categorySelect.value = current;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function cardState(id) {
  if (progress.known[id]) return "known";
  if (progress.hard[id]) return "hard";
  return "new";
}

function buildDeck() {
  const cat = els.categorySelect.value || "__all__";
  const filter = els.filterSelect.value;

  deck = allCards.filter((c) => {
    if (cat !== "__all__" && (c.category || "Allgemein") !== cat) return false;
    const state = cardState(c.id);
    if (filter === "learning") return state !== "known";
    if (filter === "hard") return state === "hard";
    return true;
  });

  currentIndex = 0;
  render();
}

function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  currentIndex = 0;
  render();
  showToast("Gemischt");
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

  const total = allCards.filter((c) => els.categorySelect.value === "__all__" || (c.category || "Allgemein") === els.categorySelect.value).length;
  const knownCount = allCards.filter((c) => (els.categorySelect.value === "__all__" || (c.category || "Allgemein") === els.categorySelect.value) && progress.known[c.id]).length;
  els.progressFill.style.width = total ? `${(knownCount / total) * 100}%` : "0%";
  els.progressText.textContent = `${knownCount} / ${total} gelernt`;
}

function flip() {
  els.flashcard.classList.toggle("flipped");
}

function nextCard() {
  if (!deck.length) return;
  currentIndex = (currentIndex + 1) % deck.length;
  render();
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

  const filter = els.filterSelect.value;
  if ((filter === "learning" && state === "known") || (filter === "hard" && state === "known")) {
    deck.splice(currentIndex, 1);
    if (!deck.length) { render(); return; }
    if (currentIndex >= deck.length) currentIndex = 0;
    render();
  } else {
    nextCard();
  }
}

// --- Events ---
els.menuBtn.addEventListener("click", () => {
  els.panel.hidden = !els.panel.hidden;
});

els.categorySelect.addEventListener("change", buildDeck);
els.filterSelect.addEventListener("change", buildDeck);
els.shuffleBtn.addEventListener("click", shuffleDeck);
els.reloadBtn.addEventListener("click", () => loadCards());

els.resetBtn.addEventListener("click", () => {
  if (confirm("Gesamten Lernfortschritt zurücksetzen?")) {
    progress = { known: {}, hard: {} };
    saveProgress();
    buildDeck();
    showToast("Fortschritt zurückgesetzt");
  }
});

els.emptyResetBtn.addEventListener("click", () => {
  els.filterSelect.value = "all";
  buildDeck();
});

els.flashcard.addEventListener("click", flip);
els.flashcard.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
  if (e.key === "ArrowRight") nextCard();
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

// Init
loadCards({ silent: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") loadCards({ silent: true });
});
