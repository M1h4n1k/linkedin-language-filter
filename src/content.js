/*
 * LinkedIn jobs language filter.
 *
 * The job search page (/jobs/search-results/) no longer exposes job data in
 * the DOM or in interceptable JSON, so for every job card we fetch the posting
 * from the voyager API, detect the description's language with the browser's
 * built-in detector, tag the card and hide it if its language isn't selected.
 */

const CARD_PREFIX = "job-card-component-ref-";
const LIST_KEY = "SearchResultsMainContent";
const MAX_PARALLEL = 3;
const CACHE_LIMIT = 3000;

const langById = new Map(); // job id -> ISO 639-1 code or "?"
let selected = []; // languages to keep; empty = show everything
let panelOpen = false;

const qr = (selector, root = document) => root.querySelector(selector);
// In Firefox, content.fetch makes the request as the page itself; it must be called on `content`
const pageFetch = (...args) =>
  typeof content !== "undefined" && content.fetch
    ? content.fetch(...args)
    : fetch(...args);
const langName = (() => {
  const names = new Intl.DisplayNames([navigator.language, "en"], {
    type: "language",
  });
  return (code) => (code === "?" ? "?" : names.of(code) || code);
})();

/* ---------- storage ---------- */

const loadState = async () => {
  const { selectedLangs = [], langCache = {} } =
    await browser.storage.local.get(["selectedLangs", "langCache"]);
  selected = selectedLangs;
  Object.entries(langCache).forEach(([id, lang]) => langById.set(id, lang));
};

let saveTimer = null;
const saveCache = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const entries = [...langById]
      .filter(([, lang]) => lang !== "?")
      .slice(-CACHE_LIMIT);
    browser.storage.local.set({ langCache: Object.fromEntries(entries) });
  }, 1000);
};

/* ---------- language detection ---------- */

const csrfToken = () =>
  (document.cookie.match(/JSESSIONID="?([^";]+)/) || [])[1];

const fetchDescription = async (id) => {
  const res = await pageFetch(`/voyager/api/jobs/jobPostings/${id}`, {
    headers: { "csrf-token": csrfToken(), accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const job = await res.json();
  return job?.description?.text || "";
};

const detectLang = async (text) => {
  if (!text.trim()) return "?";
  const result = await browser.i18n.detectLanguage(text.slice(0, 5000));
  const best = result.languages[0];
  return best ? best.language.split("-")[0] : "?";
};

const queue = [];
const pending = new Set();
let running = 0;

const enqueue = (id) => {
  if (langById.has(id) || pending.has(id)) return;
  pending.add(id);
  queue.push(id);
  pump();
};

const pump = () => {
  while (running < MAX_PARALLEL && queue.length) {
    const id = queue.shift();
    running++;
    fetchDescription(id)
      .then(detectLang)
      .catch((e) => {
        console.warn("[LinkedIn language filter]", id, e);
        return "?";
      })
      .then((lang) => {
        langById.set(id, lang);
        saveCache();
        render();
      })
      .finally(() => {
        pending.delete(id);
        running--;
        pump();
      });
  }
};

/* ---------- cards ---------- */

// The card element is nested twice with the same componentkey; take the outer one
const findCards = () => {
  const cards = new Map();
  document
    .querySelectorAll(`[componentkey^="${CARD_PREFIX}"]`)
    .forEach((el) => {
      const id = el.getAttribute("componentkey").slice(CARD_PREFIX.length);
      if (!cards.has(id)) cards.set(id, el);
    });
  return cards;
};

// The element to hide is the card's ancestor that sits directly in the results list
const listItem = (card) => {
  let el = card;
  while (
    el.parentElement &&
    el.parentElement.getAttribute("componentkey") !== LIST_KEY
  ) {
    el = el.parentElement;
  }
  return el.parentElement ? el : card;
};

const tagCard = (card, lang) => {
  let badge = qr(".llf-badge", card);
  if (!badge) {
    const title = qr("p", card);
    if (!title) return;
    badge = el("span", { className: "llf-badge", style: STYLES.badge });
    title.prepend(badge);
  }
  const text = lang ? lang.toUpperCase() : "…";
  if (badge.textContent !== text) badge.textContent = text;
  badge.title = lang ? langName(lang) : "Detecting language…";
};

const isVisible = (lang) =>
  !lang || selected.length === 0 || selected.includes(lang);

/* ---------- panel ---------- */

const BLUE = "#0a66c2";
const GREEN = "#01754f"; // LinkedIn's colour for an active filter pill
const FONT =
  "600 14px/1.4 -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif";

// Styles are set on the elements directly: Firefox doesn't reliably apply the
// extension's stylesheet on LinkedIn, and inline <style> is blocked by its CSP
const STYLES = {
  badge: {
    display: "inline-block",
    marginRight: "6px",
    padding: "0 5px",
    borderRadius: "4px",
    background: BLUE,
    color: "#fff",
    fontSize: "11px",
    fontWeight: "600",
    lineHeight: "16px",
    verticalAlign: "1px",
  },
  // reset the browser's default popover styles (centered box with a border)
  popover: {
    inset: "auto",
    margin: "0",
    padding: "0",
    border: "none",
    background: "transparent",
    overflow: "visible",
    position: "fixed",
    zIndex: "2147483647",
  },
  floating: {
    right: "16px",
    bottom: "16px",
    display: "flex",
  },
  // the pill borrows the class of LinkedIn's own filter pills; this only fills the gaps
  // LinkedIn's pill class stretches to fill its parent, so the pill gets a wrapper of its own
  pillWrap: { display: "flex", flex: "0 0 auto" },
  pill: {
    appearance: "none",
    font: "inherit",
    fontWeight: "600",
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  floatingToggle: {
    padding: "8px 14px",
    border: `1px solid ${BLUE}`,
    borderRadius: "999px",
    font: FONT,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
  },
  dropdown: {
    boxSizing: "border-box",
    width: "240px",
    maxHeight: "50vh",
    overflowY: "auto",
    padding: "12px",
    borderRadius: "8px",
    background: "#fff",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
    font: FONT,
    fontWeight: "400",
    color: "#1f1f1f",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 0",
    cursor: "pointer",
  },
  count: { marginLeft: "auto", color: "#666" },
  empty: { margin: "0", color: "#666" },
  clear: {
    marginTop: "8px",
    padding: "4px 10px",
    border: "1px solid #ccc",
    borderRadius: "999px",
    background: "#fff",
    color: "#1f1f1f",
    font: "inherit",
    cursor: "pointer",
  },
};

// LinkedIn enforces Trusted Types, which strips markup set through innerHTML, so build nodes directly
const el = (tag, { style, ...props } = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  if (style) Object.assign(node.style, style);
  node.append(...children);
  return node;
};

let ui = null; // { toggle, dropdown, floating }
let toggleMode = null; // "pill" (in LinkedIn's filter bar) or "floating"

// LinkedIn's overlays (e.g. messaging) can sit in the browser's top layer, above
// any z-index; showing our boxes as popovers puts them in the top layer too
const setShown = (node, shown, display = "block") => {
  node.style.display = shown ? display : "none";
  if (!node.showPopover) return;
  const open = node.matches(":popover-open");
  if (shown && !open) node.showPopover();
  if (!shown && open) node.hidePopover();
};

const buildUi = () => {
  const toggle = el("button", { type: "button", id: "llf-toggle" });
  const langs = el("div", { id: "llf-langs" });
  const clear = el("button", {
    type: "button",
    textContent: "Show all",
    style: STYLES.clear,
  });
  const dropdown = el(
    "div",
    { id: "llf-body", style: { ...STYLES.popover, ...STYLES.dropdown } },
    langs,
    clear,
  );
  const floating = el("div", {
    id: "llf-panel",
    style: { ...STYLES.popover, ...STYLES.floating },
  });
  const pillWrap = el("div", { id: "llf-wrap", style: STYLES.pillWrap });
  // Attached to <html> so they survive LinkedIn re-rendering <body>
  document.documentElement.append(floating, dropdown);
  [floating, dropdown].forEach((node) => {
    if (node.showPopover) node.setAttribute("popover", "manual");
  });
  ui = { toggle, dropdown, floating, pillWrap };

  toggle.addEventListener("click", () => {
    panelOpen = !panelOpen;
    render();
  });
  clear.addEventListener("click", () => setSelected([]));
  langs.addEventListener("change", (e) => {
    const lang = e.target.value;
    setSelected(
      e.target.checked
        ? [...selected, lang]
        : selected.filter((l) => l !== lang),
    );
  });
  // close the dropdown on a click anywhere else, like LinkedIn's own filters
  document.addEventListener(
    "click",
    (e) => {
      if (
        !panelOpen ||
        toggle.contains(e.target) ||
        dropdown.contains(e.target)
      )
        return;
      panelOpen = false;
      render();
    },
    true,
  );
  addEventListener("resize", positionDropdown);
  addEventListener("scroll", positionDropdown, true);
};

// The row holding LinkedIn's filter pills ("Date posted", "Easy Apply", ...)
const findFilterRow = () => {
  const pill = qr('#JobsSearchFilters [role="button"][aria-expanded]');
  if (!pill) return null;
  let node = pill;
  while (
    node.parentElement &&
    node.parentElement.id !== "JobsSearchFilters" &&
    node.parentElement.children.length < 3
  ) {
    node = node.parentElement;
  }
  const row = node.parentElement;
  return row && row.id !== "JobsSearchFilters" ? { row, pill } : null;
};

// Put the toggle in LinkedIn's filter bar, or float it in the corner if the bar isn't found
const placeToggle = () => {
  const { toggle, floating, pillWrap } = ui;
  const found = findFilterRow();
  const mode = found ? "pill" : "floating";
  if (mode !== toggleMode) {
    toggleMode = mode;
    toggle.className = "";
    toggle.style.cssText = "";
    Object.assign(toggle.style, found ? STYLES.pill : STYLES.floatingToggle);
  }
  if (found) {
    const { row, pill } = found;
    // before "All filters", which is always last
    if (pillWrap.parentElement !== row)
      row.insertBefore(pillWrap, row.lastElementChild);
    if (toggle.parentElement !== pillWrap) pillWrap.append(toggle);
    const look = qr("label", pill);
    if (look && toggle.className !== look.className)
      toggle.className = look.className;
    setShown(floating, false);
  } else {
    pillWrap.remove();
    if (toggle.parentElement !== floating) floating.append(toggle);
    setShown(floating, true, STYLES.floating.display);
  }
};

const positionDropdown = () => {
  if (!ui || !panelOpen) return;
  const { toggle, dropdown } = ui;
  const r = toggle.getBoundingClientRect();
  const width = dropdown.offsetWidth || 240;
  dropdown.style.left = `${Math.max(
    8,
    Math.min(r.left, innerWidth - width - 8),
  )}px`;
  if (r.top > innerHeight / 2) {
    dropdown.style.top = "auto";
    dropdown.style.bottom = `${innerHeight - r.top + 8}px`;
  } else {
    dropdown.style.bottom = "auto";
    dropdown.style.top = `${r.bottom + 8}px`;
  }
};

const setSelected = (langs) => {
  selected = langs;
  browser.storage.local.set({ selectedLangs: selected });
  render();
};

const renderPanel = (counts, hidden, waiting) => {
  const { toggle, dropdown } = ui;
  placeToggle();

  const active = selected.length > 0;
  if (toggleMode === "pill") {
    toggle.style.background = active ? GREEN : "";
    toggle.style.color = active ? "#fff" : "";
  } else {
    toggle.style.background = active ? BLUE : "#fff";
    toggle.style.color = active ? "#fff" : BLUE;
  }

  const status = waiting ? ` · ${waiting} pending` : "";
  const text =
    (active
      ? `Languages: ${selected
          .map((l) => l.toUpperCase())
          .join(", ")} (${hidden} hidden${status})`
      : `Languages${status}`) + " ▾";
  if (toggle.textContent !== text) toggle.textContent = text;

  setShown(dropdown, panelOpen);
  positionDropdown();

  // keep selected languages listed even if no card on this page uses them
  const langs = [...new Set([...selected, ...counts.keys()])].sort(
    (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b),
  );
  const key = JSON.stringify([selected, langs.map((l) => [l, counts.get(l)])]);
  const container = qr("#llf-langs", dropdown);
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.replaceChildren(
    ...(langs.length
      ? langs.map((lang) =>
          el(
            "label",
            { style: STYLES.label },
            el("input", {
              type: "checkbox",
              value: lang,
              checked: selected.includes(lang),
            }),
            langName(lang),
            el("span", {
              textContent: counts.get(lang) || 0,
              style: STYLES.count,
            }),
          ),
        )
      : [
          el("p", {
            textContent: "No jobs detected yet",
            style: STYLES.empty,
          }),
        ]),
  );
};

/* ---------- main loop ---------- */

// Job lists: search results and collections ("Recommended", "Easy Apply", ...), not a single job's page
const isSearchPage = () =>
  /^\/jobs\/(search|collections)/.test(location.pathname);

const render = () => {
  if (!isSearchPage()) {
    if (ui) {
      ui.pillWrap.remove();
      ui.toggle.remove();
      setShown(ui.floating, false);
      setShown(ui.dropdown, false);
    }
    return;
  }
  if (!ui) buildUi();

  const counts = new Map();
  let hidden = 0;
  let waiting = 0;
  findCards().forEach((card, id) => {
    const lang = langById.get(id);
    if (!lang) {
      waiting++;
      enqueue(id);
    } else {
      counts.set(lang, (counts.get(lang) || 0) + 1);
    }
    tagCard(card, lang);
    const item = listItem(card);
    const show = isVisible(lang);
    if (!show) hidden++;
    if ((item.style.display === "none") === show)
      item.style.display = show ? "" : "none";
  });
  renderPanel(counts, hidden, waiting);
};

// LinkedIn renders and recycles cards lazily (scroll, pagination, SPA navigation)
let renderScheduled = false;
const scheduleRender = (mutations) => {
  const ours = mutations.every((m) =>
    [m.target, ...m.addedNodes].every(
      (n) =>
        n.nodeType !== 1 ||
        n.closest?.(
          "#llf-wrap, #llf-toggle, #llf-body, #llf-panel, .llf-badge",
        ),
    ),
  );
  if (ours || renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    render();
  });
};

// Observe the document rather than <body>: LinkedIn may replace <body> while hydrating on a fresh load
loadState()
  .catch((e) => console.error("[LinkedIn language filter]", e))
  .then(() => {
    render();
    new MutationObserver(scheduleRender).observe(document, {
      childList: true,
      subtree: true,
    });
  });
