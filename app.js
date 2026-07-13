const APP_VERSION = "v0.21";
const STORAGE_KEY = "financehub-mobile-v021";
const LEGACY_STORAGE_KEYS = [
  "financehub-mobile-v020",
  "financehub-mobile-v019",
  "financehub-mobile-v018",
  "financehub-mobile-v017",
  "financehub-mobile-v016",
  "financehub-mobile-v015",
  "financehub-mobile-v014",
  "financehub-mobile-v013",
  "financehub-mobile-v012",
  "financehub-mobile-v011",
  "financehub-mobile-v010",
  "financehub-mobile-v09",
  "financehub-mobile-v08",
  "financehub-mobile-v07",
  "financehub-mobile-v06",
  "financehub-mobile-v05",
  "financehub-mobile-v04",
  "financehub-mobile-v03",
  "financehub-mobile-v02",
  "financehub-mobile-v01",
];
const SHEET_URL = "https://docs.google.com/spreadsheets/d/10XJELK1gXiBho_0YdpGvEzyDOOV_kzbW25C47iku1lw/edit";

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const numberFr = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const defaultSettings = {
  hourlyRate: 13.83,
  netRate: 80.168,
  ifmRate: 10,
  paidLeaveRate: 10,
  panier: 4.35,
  habillage: 0.75,
  cash: 1111.01,
  otherIncome: 0,
  fixedCharges: 734,
  baseExpenses: 584.96,
  reserveTarget: 1000,
  syncUrl: "",
  syncSecret: "",
  lastSyncedAt: "",
};

const viewTitles = {
  dashboard: "Accueil",
  hours: "Heures",
  advances: "Acomptes",
  expenses: "Depenses",
  settings: "Reglages",
};

let state = loadState();
let autoSyncTimer = null;
let autoPullTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  const saved =
    localStorage.getItem(STORAGE_KEY) ||
    LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return migrateState({
        settings: { ...defaultSettings, ...parsed.settings },
        shifts: parsed.shifts || [],
        advances: parsed.advances || [],
        expenses: parsed.expenses || [],
      });
    } catch {
      return createInitialState();
    }
  }
  return createInitialState();
}

function migrateState(savedState) {
  const settings = normalizeSettings(savedState.settings);
  if (settings.otherIncome === 1669.8) {
    settings.otherIncome = 982.89;
  }

  const cleaned = {
    ...savedState,
    settings,
    shifts: savedState.shifts
      .filter((shift) => shift.note !== "Pre-rempli hors week-end")
      .map(normalizeShift)
      .filter((shift) => shift.date),
    advances: savedState.advances.map(normalizeAdvance).filter((advance) => advance.date),
    expenses: savedState.expenses.map(normalizeExpense).filter((expense) => expense.date),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  return cleaned;
}

function coerceSettingNumber(value, fallback, options = {}) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const normalized = text
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  if (!normalized) return fallback;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return fallback;
  if (options.positive && number <= 0) return fallback;
  return number;
}

function normalizeSettings(settings = {}) {
  return {
    ...defaultSettings,
    ...settings,
    hourlyRate: coerceSettingNumber(settings.hourlyRate, defaultSettings.hourlyRate, { positive: true }),
    netRate: coerceSettingNumber(settings.netRate, defaultSettings.netRate, { positive: true }),
    ifmRate: coerceSettingNumber(settings.ifmRate, defaultSettings.ifmRate),
    paidLeaveRate: coerceSettingNumber(settings.paidLeaveRate, defaultSettings.paidLeaveRate),
    panier: coerceSettingNumber(settings.panier, defaultSettings.panier),
    habillage: coerceSettingNumber(settings.habillage, defaultSettings.habillage),
    cash: coerceSettingNumber(settings.cash, defaultSettings.cash),
    otherIncome: coerceSettingNumber(settings.otherIncome, defaultSettings.otherIncome),
    fixedCharges: coerceSettingNumber(settings.fixedCharges, defaultSettings.fixedCharges),
    baseExpenses: coerceSettingNumber(settings.baseExpenses, defaultSettings.baseExpenses),
    reserveTarget: coerceSettingNumber(settings.reserveTarget, defaultSettings.reserveTarget),
    syncUrl: String(settings.syncUrl || ""),
    syncSecret: String(settings.syncSecret || ""),
    lastSyncedAt: safeIsoDateTime(settings.lastSyncedAt) || "",
  };
}

function normalizeShift(shift) {
  return {
    ...shift,
    date: normalizeDateValue(shift.date),
    pausePaidMinutes: Number(shift.pausePaidMinutes || 25),
  };
}

function normalizeAdvance(advance) {
  const normalized = {
    ...advance,
    date: normalizeDateValue(advance.date),
  };
  if (
    Number(normalized.amount) === 180 &&
    normalized.date === "2026-07-11" &&
    normalized.status === "Prevu"
  ) {
    return {
      ...normalized,
      date: "2026-07-10",
      status: "Recu",
      note: "Recu - a deduire prochaine paie",
    };
  }
  return normalized;
}

function normalizeExpense(expense) {
  return {
    ...expense,
    date: normalizeDateValue(expense.date),
  };
}

function createInitialState() {
  return {
    settings: { ...defaultSettings },
    shifts: [],
    advances: [
      {
        id: crypto.randomUUID(),
        date: "2026-06-18",
        amount: 200,
        status: "Deduit",
        note: "Bulletin 06/2026",
      },
      {
        id: crypto.randomUUID(),
        date: "2026-06-24",
        amount: 300,
        status: "Deduit",
        note: "Bulletin 06/2026",
      },
      {
        id: crypto.randomUUID(),
        date: "2026-07-08",
        amount: 350,
        status: "Deduit",
        note: "Bulletin 06/2026",
      },
      {
        id: crypto.randomUUID(),
        date: "2026-07-10",
        amount: 180,
        status: "Recu",
        note: "Recu - a deduire prochaine paie",
      },
    ],
    expenses: [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseAmount(value) {
  return Number(String(value).replace(",", ".")) || 0;
}

function safeIsoDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function formatDateTime(value) {
  const iso = safeIsoDateTime(value);
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-FR");
}

function normalizeDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const frMatch = text.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (frMatch) {
    const day = frMatch[1].padStart(2, "0");
    const month = frMatch[2].padStart(2, "0");
    const year = frMatch[3].length === 2 ? `20${frMatch[3]}` : frMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function parseDate(value) {
  const normalized = normalizeDateValue(value);
  const parsed = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateSortKey(value) {
  const normalized = normalizeDateValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "0000-00-00";
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
  const parsed = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Mois en cours";
  const label = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(parsed);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isInMonth(date, monthKey) {
  return dateSortKey(date).startsWith(`${monthKey}-`);
}

function isInMonthToDate(date, monthKey) {
  const key = dateSortKey(date);
  return key.startsWith(`${monthKey}-`) && key <= todayKey();
}

function formatMoney(value) {
  return money.format(value || 0).replace(/\u00a0/g, " ");
}

function formatHours(value) {
  return `${numberFr.format(value || 0)} h`;
}

function formatDate(dateString) {
  const parsed = parseDate(dateString);
  if (!parsed) return String(dateString || "Date inconnue");
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function paidHours(shift) {
  const start = timeToMinutes(shift.start);
  let end = timeToMinutes(shift.end);
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function isoWeek(dateString) {
  const normalized = normalizeDateValue(dateString);
  const source = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(source.getTime())) return 0;
  const dayNumber = source.getUTCDay() || 7;
  source.setUTCDate(source.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(source.getUTCFullYear(), 0, 1));
  return Math.ceil(((source - yearStart) / 86400000 + 1) / 7);
}

function calculatePayroll(shifts) {
  const settings = state.settings;
  const hourlyRate = settings.hourlyRate;
  const netRate = settings.netRate / 100;
  const ifmRate = settings.ifmRate / 100;
  const paidLeaveRate = settings.paidLeaveRate / 100;
  const sorted = [...shifts].sort((a, b) => dateSortKey(a.date).localeCompare(dateSortKey(b.date)));
  const weeklyTotals = new Map();

  const rows = sorted.map((shift) => {
    const parsedDate = parseDate(shift.date);
    const year = parsedDate ? parsedDate.getFullYear() : "0000";
    const week = `${year}-${isoWeek(shift.date)}`;
    const previous = weeklyTotals.get(week) || 0;
    const hours = paidHours(shift);
    const normal = Math.max(0, Math.min(hours, 35 - previous));
    const afterNormal = Math.max(0, hours - normal);
    const usedBeforeOt50 = Math.max(35, previous);
    const ot25 = Math.max(0, Math.min(afterNormal, 43 - usedBeforeOt50));
    const ot50 = Math.max(0, hours - normal - ot25);
    weeklyTotals.set(week, previous + hours);

    const premium = (shift.panier ? settings.panier : 0) + (shift.habillage ? settings.habillage : 0);
    const grossHours = normal * hourlyRate + ot25 * hourlyRate * 1.25 + ot50 * hourlyRate * 1.5;
    const grossBase = grossHours + premium;
    const ifm = grossBase * ifmRate;
    const paidLeave = (grossBase + ifm) * paidLeaveRate;
    const grossTotal = grossBase + ifm + paidLeave;
    const net = grossTotal * netRate;

    return {
      shift,
      hours,
      normal,
      ot25,
      ot50,
      grossTotal,
      net,
    };
  });

  return rows.reduce(
    (total, row) => {
      total.hours += row.hours;
      total.normal += row.normal;
      total.ot25 += row.ot25;
      total.ot50 += row.ot50;
      total.gross += row.grossTotal;
      total.net += row.net;
      total.rows.push(row);
      return total;
    },
    { hours: 0, normal: 0, ot25: 0, ot50: 0, gross: 0, net: 0, rows: [] },
  );
}

function sumPayrollRows(rows) {
  return rows.reduce(
    (total, row) => {
      total.hours += row.hours;
      total.normal += row.normal;
      total.ot25 += row.ot25;
      total.ot50 += row.ot50;
      total.gross += row.grossTotal;
      total.net += row.net;
      total.rows.push(row);
      return total;
    },
    { hours: 0, normal: 0, ot25: 0, ot50: 0, gross: 0, net: 0, rows: [] },
  );
}

function payrollForMonth(monthKey) {
  const payroll = calculatePayroll(state.shifts);
  return sumPayrollRows(payroll.rows.filter((row) => isInMonthToDate(row.shift.date, monthKey)));
}

function localExpenseTotal(monthKey = "") {
  return state.expenses
    .filter((expense) => !monthKey || isInMonthToDate(expense.date, monthKey))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function advanceWatchTotal(monthKey = "") {
  return state.advances
    .filter((advance) => advance.status !== "Deduit" && (!monthKey || isInMonthToDate(advance.date, monthKey)))
    .reduce((sum, advance) => sum + Number(advance.amount || 0), 0);
}

function advanceRemainTotal() {
  return state.advances
    .filter((advance) => advance.status !== "Deduit")
    .reduce((sum, advance) => sum + Number(advance.amount || 0), 0);
}

function dashboardTotals() {
  const monthKey = currentMonthKey();
  const payroll = payrollForMonth(monthKey);
  const advanceDeduction = advanceWatchTotal(monthKey);
  const payrollAfterAdvances = Math.max(0, payroll.net - advanceDeduction);
  const expenses = localExpenseTotal(monthKey);
  const chargesRemaining = state.settings.fixedCharges;
  const income = state.settings.otherIncome;
  const projectedEndOfMonth = state.settings.cash + income - chargesRemaining;
  const investSafe = Math.max(
    0,
    Math.min(income * 0.05, projectedEndOfMonth - state.settings.reserveTarget),
  );
  return {
    monthKey,
    payroll,
    payrollAfterAdvances,
    advanceDeduction,
    expenses,
    chargesRemaining,
    outgoing: chargesRemaining,
    income,
    currentCash: state.settings.cash,
    projectedEndOfMonth,
    investSafe,
  };
}

function renderAll() {
  renderDashboard();
  renderShifts();
  renderAdvances();
  renderExpenses();
  renderSettings();
}

function renderDashboard() {
  const totals = dashboardTotals();
  const watch = totals.advanceDeduction;

  $("#monthLabel").textContent = formatMonthLabel(totals.monthKey);
  $("#availableAfter").textContent = formatMoney(totals.currentCash);
  $("#dashboardState").textContent = `Prevision fin de mois: ${formatMoney(totals.projectedEndOfMonth)} hors paie Adecco du mois`;
  $("#estimatedPay").textContent = formatMoney(totals.payrollAfterAdvances);
  $("#advanceWatch").textContent = formatMoney(watch);
  $("#outgoingTotal").textContent = formatMoney(totals.chargesRemaining);
  $("#monthExpenses").textContent = formatMoney(totals.expenses);
  $("#incomeTotal").textContent = formatMoney(totals.income);
  $("#outgoingTotalBar").textContent = formatMoney(totals.chargesRemaining);
  $("#reserveValue").textContent = formatMoney(state.settings.reserveTarget);

  const max = Math.max(totals.income, totals.chargesRemaining, state.settings.reserveTarget, 1);
  $("#incomeBar").style.width = `${Math.min(100, (totals.income / max) * 100)}%`;
  $("#outgoingBar").style.width = `${Math.min(100, (totals.chargesRemaining / max) * 100)}%`;
  $("#reserveBar").style.width = `${Math.min(100, (state.settings.reserveTarget / max) * 100)}%`;

  const watchItems = [];
  if (watch > 0) {
    watchItems.push({
      title: "Acompte a deduire",
      value: formatMoney(watch),
      detail: "Deduit de la prochaine paie, pas une charge immediate",
    });
  }
  if (totals.projectedEndOfMonth < state.settings.reserveTarget) {
    watchItems.push({
      title: "Reserve non couverte",
      value: formatMoney(state.settings.reserveTarget - totals.projectedEndOfMonth),
      detail: "Priorite au cash",
    });
  }
  if (!watchItems.length) {
    watchItems.push({
      title: "Situation stable",
      value: "OK",
      detail: "Pas d'alerte locale",
    });
  }

  $("#watchCount").textContent = String(watchItems.length);
  $("#watchList").innerHTML = watchItems
    .map(
      (item) => `
        <li class="watch-item">
          <div>
            <strong>${item.title}</strong>
            <span>${item.detail}</span>
          </div>
          <strong>${item.value}</strong>
        </li>
      `,
    )
    .join("");

  const activities = latestActivities();
  $("#activityList").innerHTML = activities.length
    ? activities
        .map(
          (item) => `
            <li class="activity-item">
              <strong>${item.title}</strong>
              <span>${item.detail}</span>
            </li>
          `,
        )
        .join("")
    : emptyHtml();
}

function latestActivities() {
  const shifts = state.shifts.slice(-3).map((shift) => ({
    date: shift.date,
    title: `Heures ${formatDate(shift.date)}`,
    detail: `${formatHours(paidHours(shift))} - ${shift.start} / ${shift.end}`,
  }));
  const advances = state.advances.slice(-2).map((advance) => ({
    date: advance.date,
    title: `Acompte ${formatMoney(advance.amount)}`,
    detail: `${advance.status} - ${formatDate(advance.date)}`,
  }));
  const expenses = state.expenses.slice(-2).map((expense) => ({
    date: expense.date,
    title: `Depense ${formatMoney(expense.amount)}`,
    detail: `${expense.category} - ${formatDate(expense.date)}`,
  }));
  return [...shifts, ...advances, ...expenses]
    .sort((a, b) => dateSortKey(b.date).localeCompare(dateSortKey(a.date)))
    .slice(0, 5);
}

function renderShifts() {
  const monthKey = currentMonthKey();
  const fullPayroll = calculatePayroll(state.shifts);
  const monthPayroll = sumPayrollRows(fullPayroll.rows.filter((row) => isInMonthToDate(row.shift.date, monthKey)));
  $("#shiftMonthTotal").textContent = formatMoney(monthPayroll.net);
  $("#shiftCount").textContent = `${monthPayroll.rows.length} jours a ce jour`;

  const rowMap = new Map(fullPayroll.rows.map((row) => [row.shift.id, row]));
  $("#shiftList").innerHTML = state.shifts.length
    ? [...state.shifts]
        .sort((a, b) => dateSortKey(b.date).localeCompare(dateSortKey(a.date)))
        .map((shift) => {
          const row = rowMap.get(shift.id);
          return `
            <li class="entry-item">
              <div>
                <strong>${formatDate(shift.date)} - ${formatMoney(row?.net || 0)}</strong>
                <span>${shift.start} / ${shift.end} - pause payee ${shift.pausePaidMinutes} min</span>
                <div class="entry-meta">
                  <span class="pill">${formatHours(row?.hours || 0)}</span>
                  <span class="pill is-green">HS 25 ${numberFr.format(row?.ot25 || 0)} h</span>
                </div>
              </div>
              <div class="entry-actions">
                <button class="mini-button" type="button" data-edit-shift="${shift.id}" aria-label="Modifier">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4-.8L19 8l-3-3L5 16l-1 4Z"/><path d="m14 6 3 3"/></svg>
                </button>
                <button class="mini-button is-danger" type="button" data-delete-shift="${shift.id}" aria-label="Supprimer">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
                </button>
              </div>
            </li>
          `;
        })
        .join("")
    : emptyHtml();
}

function renderAdvances() {
  const remain = advanceRemainTotal();
  $("#advanceRemain").textContent = formatMoney(remain);
  $("#advanceCount").textContent = `${state.advances.length}`;
  $("#advanceList").innerHTML = state.advances.length
    ? [...state.advances]
        .sort((a, b) => dateSortKey(b.date).localeCompare(dateSortKey(a.date)))
        .map(
          (advance) => `
            <li class="entry-item">
              <div>
                <strong>${formatMoney(advance.amount)} - ${advance.status}</strong>
                <span>${formatDate(advance.date)}${advance.note ? ` - ${escapeHtml(advance.note)}` : ""}</span>
                <div class="entry-meta">
                  <span class="pill ${advance.status === "Deduit" ? "is-green" : "is-amber"}">${advance.status}</span>
                </div>
              </div>
              <button class="mini-button is-danger" type="button" data-delete-advance="${advance.id}" aria-label="Supprimer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
              </button>
            </li>
          `,
        )
        .join("")
    : emptyHtml();
}

function renderExpenses() {
  const monthKey = currentMonthKey();
  const monthlyExpenses = state.expenses.filter((expense) => isInMonthToDate(expense.date, monthKey));
  $("#expenseMonthTotal").textContent = formatMoney(localExpenseTotal(monthKey));
  $("#expenseCount").textContent = `${monthlyExpenses.length} ce mois`;
  $("#expenseList").innerHTML = state.expenses.length
    ? [...state.expenses]
        .sort((a, b) => dateSortKey(b.date).localeCompare(dateSortKey(a.date)))
        .map(
          (expense) => `
            <li class="entry-item">
              <div>
                <strong>${formatMoney(expense.amount)} - ${escapeHtml(expense.category)}</strong>
                <span>${formatDate(expense.date)}${expense.note ? ` - ${escapeHtml(expense.note)}` : ""}</span>
              </div>
              <button class="mini-button is-danger" type="button" data-delete-expense="${expense.id}" aria-label="Supprimer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>
              </button>
            </li>
          `,
        )
        .join("")
    : emptyHtml();
}

function renderSettings() {
  $("#settingHourlyRate").value = state.settings.hourlyRate;
  $("#settingNetRate").value = state.settings.netRate;
  $("#settingPanier").value = state.settings.panier;
  $("#settingHabillage").value = state.settings.habillage;
  $("#settingCash").value = state.settings.cash;
  $("#settingReserve").value = state.settings.reserveTarget;
  $("#settingOtherIncome").value = state.settings.otherIncome;
  $("#settingFixedCharges").value = state.settings.fixedCharges;
  $("#settingBaseExpenses").value = state.settings.baseExpenses;
  $("#syncUrl").value = state.settings.syncUrl || "";
  $("#syncSecret").value = state.settings.syncSecret || "";
  renderSyncStatus();
}

function syncConfigured() {
  return Boolean((state.settings.syncUrl || "").trim() && (state.settings.syncSecret || "").trim());
}

function renderSyncStatus(message, type = "") {
  const badge = $("#syncBadge");
  const status = $("#syncStatus");
  const configured = syncConfigured();
  badge.textContent = configured ? "Pret" : "A configurer";
  if (message) {
    status.textContent = message;
  } else if (state.settings.lastSyncedAt) {
    const lastSyncedAt = formatDateTime(state.settings.lastSyncedAt);
    status.textContent = lastSyncedAt
      ? `Derniere synchro: ${lastSyncedAt}`
      : "La synchro est configuree. Tu peux envoyer ou recevoir les donnees.";
  } else {
    status.textContent = configured
      ? "La synchro est configuree. Tu peux envoyer ou recevoir les donnees."
      : "Ajoute l'URL du script Google pour activer la synchronisation.";
  }
  status.className = `sync-status${type ? ` is-${type}` : ""}`;
  $("#pullSyncButton").disabled = !configured;
  $("#pushSyncButton").disabled = !configured;
}

function cleanSyncUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withoutSpaces = raw.replace(/\s/g, "");
  if (/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+$/i.test(withoutSpaces)) {
    return `${withoutSpaces}/exec`;
  }
  return withoutSpaces;
}

function saveSyncForm(showMessage = true) {
  state.settings.syncUrl = cleanSyncUrl($("#syncUrl").value);
  state.settings.syncSecret = $("#syncSecret").value.trim();
  $("#syncUrl").value = state.settings.syncUrl;
  saveState();
  if (showMessage) {
    renderSyncStatus("Reglages de synchronisation enregistres.", "ok");
  }
}

function syncSnapshot() {
  const { syncSecret, ...safeSettings } = state.settings;
  return {
    schemaVersion: 1,
    appVersion: APP_VERSION,
    updatedAt: new Date().toISOString(),
    settings: normalizeSettings(safeSettings),
    shifts: localOnlyRows(state.shifts).filter((shift) => shift.date),
    advances: localOnlyRows(state.advances).filter((advance) => advance.date),
    expenses: localOnlyRows(state.expenses).filter((expense) => expense.date),
  };
}

function mergeRowsByKey(primaryRows, secondaryRows, keyFn) {
  const rows = new Map();
  primaryRows.forEach((row) => rows.set(keyFn(row), row));
  secondaryRows.forEach((row) => {
    const key = keyFn(row);
    if (!rows.has(key)) {
      rows.set(key, row);
    }
  });
  return Array.from(rows.values());
}

function localOnlyRows(rows = []) {
  return rows.filter((row) => !String(row.id || "").startsWith("sheet-"));
}

function shiftMergeKey(shift) {
  return ["shift", shift.date, shift.start, shift.end, String(shift.site || "").toLowerCase()].join("|");
}

function advanceMergeKey(advance) {
  return [
    "advance",
    advance.date,
    Number(advance.amount || 0).toFixed(2),
  ].join("|");
}

function expenseMergeKey(expense) {
  return [
    "expense",
    expense.date,
    Number(expense.amount || 0).toFixed(2),
    expense.category,
    expense.note || "",
  ].join("|");
}

function rowsContainAll(remoteRows = [], expectedRows = [], keyFn) {
  const remoteKeys = new Set(remoteRows.map(keyFn));
  return expectedRows.every((row) => remoteKeys.has(keyFn(row)));
}

function snapshotConfirmed(remoteState, snapshot) {
  if (!remoteState || typeof remoteState !== "object") return false;
  return (
    rowsContainAll(remoteState.shifts || [], snapshot.shifts || [], shiftMergeKey) &&
    rowsContainAll(remoteState.advances || [], snapshot.advances || [], advanceMergeKey) &&
    rowsContainAll(remoteState.expenses || [], snapshot.expenses || [], expenseMergeKey)
  );
}

async function waitForPushConfirmation(snapshot) {
  let lastPayload = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await wait(attempt === 0 ? 1800 : 1400);
    lastPayload = await syncGet("pull");
    if (snapshotConfirmed(lastPayload.state, snapshot)) {
      return lastPayload;
    }
  }
  throw new Error("L'envoi n'a pas encore ete confirme par le Sheet.");
}

function applySyncedState(remoteState) {
  if (!remoteState || typeof remoteState !== "object") {
    throw new Error("Aucune donnee valide recue.");
  }
  const keepSync = {
    syncUrl: state.settings.syncUrl,
    syncSecret: state.settings.syncSecret,
    lastSyncedAt: safeIsoDateTime(remoteState.updatedAt) || new Date().toISOString(),
  };
  state = migrateState({
    settings: normalizeSettings({ ...state.settings, ...(remoteState.settings || {}), ...keepSync }),
    shifts: mergeRowsByKey(remoteState.shifts || [], localOnlyRows(state.shifts), shiftMergeKey),
    advances: mergeRowsByKey(remoteState.advances || [], localOnlyRows(state.advances), advanceMergeKey),
    expenses: mergeRowsByKey(remoteState.expenses || [], localOnlyRows(state.expenses), expenseMergeKey),
  });
  saveState();
}

function syncUrl(action, callbackName) {
  const url = new URL(cleanSyncUrl(state.settings.syncUrl));
  url.searchParams.set("action", action);
  url.searchParams.set("secret", state.settings.syncSecret.trim());
  url.searchParams.set("callback", callbackName);
  url.searchParams.set("_", String(Date.now()));
  return url.toString();
}

function syncFrameUrl(action, frameToken) {
  const url = new URL(cleanSyncUrl(state.settings.syncUrl));
  url.searchParams.set("action", action === "pull" ? "pullFrame" : action);
  url.searchParams.set("secret", state.settings.syncSecret.trim());
  url.searchParams.set("frameToken", frameToken);
  url.searchParams.set("_", String(Date.now()));
  return url.toString();
}

function syncErrorMessage(message) {
  if (/confirme/.test(message)) {
    return "L'envoi est parti, mais le Sheet met trop longtemps a renvoyer la confirmation. Attends quelques secondes puis clique Recevoir du Sheet pour verifier.";
  }
  if (/script Google|repond pas/.test(message)) {
    return `${message} Sur telephone, utilise Tester le script. Si la page affiche Code secret incorrect, le reseau est OK. Sinon, coupe VPN, DNS prive ou bloqueur, puis verifie que l'URL finit par /exec.`;
  }
  return message;
}

function testScriptAccess() {
  saveSyncForm(false);
  if (!state.settings.syncUrl) {
    renderSyncStatus("Ajoute d'abord l'URL du script Google.", "error");
    return;
  }
  const testUrl = cleanSyncUrl(state.settings.syncUrl);
  $("#syncUrl").value = testUrl;
  renderSyncStatus("J'ouvre le test. Si la page affiche Code secret incorrect, le script est joignable.", "busy");
  window.open(`${testUrl}?action=pull`, "_blank", "noopener,noreferrer");
}

function syncGet(action) {
  return syncGetJsonp(action).catch((error) => {
    if (/script Google|repond pas/.test(error.message)) {
      return syncGetFrame(action);
    }
    throw error;
  });
}

function syncGetJsonp(action) {
  return new Promise((resolve, reject) => {
    if (!syncConfigured()) {
      reject(new Error("Synchronisation non configuree."));
      return;
    }
    const callbackName = `financeHubSync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      script.remove();
      delete window[callbackName];
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Le script Google ne repond pas."));
    }, 15000);

    window[callbackName] = (payload) => {
      window.clearTimeout(timer);
      cleanup();
      if (payload && payload.ok) {
        resolve(payload);
      } else {
        reject(new Error(payload?.error || "Erreur de synchronisation."));
      }
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("Impossible de joindre le script Google."));
    };
    script.src = syncUrl(action, callbackName);
    document.body.appendChild(script);
  });
}

function syncGetFrame(action) {
  return new Promise((resolve, reject) => {
    if (!syncConfigured()) {
      reject(new Error("Synchronisation non configuree."));
      return;
    }

    const frameToken = `financeHubFrame_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.left = "-10px";
    iframe.style.bottom = "-10px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.border = "0";
    iframe.style.opacity = "0.01";
    iframe.style.pointerEvents = "none";

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Le script Google ne repond pas sur ce telephone."));
    }, 20000);

    const onMessage = (event) => {
      const payload = event.data;
      if (!payload || payload.frameToken !== frameToken) return;
      cleanup();
      if (payload.ok) {
        resolve(payload);
      } else {
        reject(new Error(payload.error || "Erreur de synchronisation."));
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("Impossible de joindre le script Google sur ce telephone."));
    };

    window.addEventListener("message", onMessage);
    iframe.src = syncFrameUrl(action, frameToken);
    document.body.appendChild(iframe);
  });
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function queueAutoPush(reason = "Modification locale") {
  if (!syncConfigured()) return;
  window.clearTimeout(autoSyncTimer);
  autoSyncTimer = window.setTimeout(async () => {
    renderSyncStatus(`${reason}. Envoi automatique...`, "busy");
    await pushToSheet();
  }, 600);
}

function queueAutoPull() {
  if (!syncConfigured()) return;
  window.clearTimeout(autoPullTimer);
  autoPullTimer = window.setTimeout(() => pullFromSheet({ silent: true }), 1200);
}

async function pullFromSheet(options = {}) {
  const silent = Boolean(options.silent);
  saveSyncForm(!silent);
  try {
    renderSyncStatus(silent ? "Verification du Sheet..." : "Reception depuis Google Sheets...", "busy");
    const payload = await syncGet("pull");
    applySyncedState(payload.state);
    renderAll();
    renderSyncStatus(silent ? "Synchro automatique terminee." : "Donnees recues depuis Google Sheets.", "ok");
  } catch (error) {
    renderSyncStatus(syncErrorMessage(error.message), "error");
  }
}

async function pushToSheet() {
  saveSyncForm(false);
  try {
    renderSyncStatus("Envoi vers Google Sheets...", "busy");
    const snapshot = syncSnapshot();
    await fetch(cleanSyncUrl(state.settings.syncUrl), {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "push",
        secret: state.settings.syncSecret.trim(),
        state: snapshot,
      }),
    });
    const payload = await waitForPushConfirmation(snapshot);
    applySyncedState(payload.state);
    state.settings.lastSyncedAt = snapshot.updatedAt;
    saveState();
    renderAll();
    renderSyncStatus("Donnees envoyees vers Google Sheets.", "ok");
  } catch (error) {
    renderSyncStatus(syncErrorMessage(error.message), "error");
  }
}

function emptyHtml() {
  return $("#emptyTemplate").innerHTML;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function setView(name) {
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.target === name));
  $("#screenTitle").textContent = viewTitles[name] || "FinanceHub";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function currentDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fillFormDefaults() {
  const today = currentDateInput();
  $("#shiftDate").value = today;
  $("#advanceDate").value = today;
  $("#expenseDate").value = today;
  $("#advanceAmount").value = "";
  $("#expenseAmount").value = "";
}

function updateShiftPreview() {
  const shift = readShiftForm();
  const payroll = calculatePayroll([shift]);
  $("#shiftPreviewHours").textContent = formatHours(paidHours(shift));
  $("#shiftPreviewNet").textContent = formatMoney(payroll.net);
}

function readShiftForm() {
  return {
    id: $("#shiftId").value || crypto.randomUUID(),
    date: $("#shiftDate").value,
    start: $("#shiftStart").value,
    end: $("#shiftEnd").value,
    pausePaidMinutes: Number($("#shiftPause").value || 25),
    site: $("#shiftSite").value.trim() || "Mission Adecco",
    panier: $("#shiftPanier").checked,
    habillage: $("#shiftHabillage").checked,
    note: $("#shiftNote").value.trim(),
  };
}

function bindEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.target));
  });

  $("#refreshButton").addEventListener("click", () => renderAll());

  ["shiftDate", "shiftStart", "shiftEnd", "shiftPause", "shiftPanier", "shiftHabillage"].forEach((id) => {
    $(`#${id}`).addEventListener("input", updateShiftPreview);
  });

  $("#shiftForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const shift = readShiftForm();
    const index = state.shifts.findIndex((item) => item.id === shift.id || item.date === shift.date);
    if (index >= 0) {
      shift.id = state.shifts[index].id;
      state.shifts[index] = shift;
    } else {
      state.shifts.push(shift);
    }
    saveState();
    $("#shiftForm").reset();
    $("#shiftId").value = "";
    $("#shiftPause").value = "25";
    $("#shiftPanier").checked = true;
    $("#shiftHabillage").checked = true;
    $("#shiftSite").value = "Mission Adecco";
    $("#shiftDate").value = shift.date;
    updateShiftPreview();
    renderAll();
    queueAutoPush("Heures enregistrees");
  });

  $("#shiftList").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-shift]");
    const deleteButton = event.target.closest("[data-delete-shift]");
    if (editButton) {
      const shift = state.shifts.find((item) => item.id === editButton.dataset.editShift);
      if (!shift) return;
      $("#shiftId").value = shift.id;
      $("#shiftDate").value = shift.date;
      $("#shiftStart").value = shift.start;
      $("#shiftEnd").value = shift.end;
      $("#shiftPause").value = String(shift.pausePaidMinutes || 25);
      $("#shiftSite").value = shift.site;
      $("#shiftPanier").checked = Boolean(shift.panier);
      $("#shiftHabillage").checked = Boolean(shift.habillage);
      $("#shiftNote").value = shift.note || "";
      updateShiftPreview();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (deleteButton) {
      state.shifts = state.shifts.filter((item) => item.id !== deleteButton.dataset.deleteShift);
      saveState();
      renderAll();
      queueAutoPush("Heures modifiees");
    }
  });

  $("#advanceForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.advances.push({
      id: crypto.randomUUID(),
      date: $("#advanceDate").value,
      amount: parseAmount($("#advanceAmount").value),
      status: $("#advanceStatus").value,
      note: $("#advanceNote").value.trim(),
    });
    saveState();
    $("#advanceAmount").value = "";
    $("#advanceNote").value = "";
    renderAll();
    queueAutoPush("Acompte enregistre");
  });

  $("#advanceList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-advance]");
    if (!button) return;
    state.advances = state.advances.filter((item) => item.id !== button.dataset.deleteAdvance);
    saveState();
    renderAll();
    queueAutoPush("Acomptes modifies");
  });

  $("#expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.expenses.push({
      id: crypto.randomUUID(),
      date: $("#expenseDate").value,
      amount: parseAmount($("#expenseAmount").value),
      category: $("#expenseCategory").value,
      note: $("#expenseNote").value.trim(),
    });
    saveState();
    $("#expenseAmount").value = "";
    $("#expenseNote").value = "";
    renderAll();
    queueAutoPush("Depense enregistree");
  });

  $("#expenseList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-expense]");
    if (!button) return;
    state.expenses = state.expenses.filter((item) => item.id !== button.dataset.deleteExpense);
    saveState();
    renderAll();
    queueAutoPush("Depenses modifiees");
  });

  $("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.settings = {
      ...state.settings,
      hourlyRate: parseAmount($("#settingHourlyRate").value),
      netRate: parseAmount($("#settingNetRate").value),
      panier: parseAmount($("#settingPanier").value),
      habillage: parseAmount($("#settingHabillage").value),
      cash: parseAmount($("#settingCash").value),
      reserveTarget: parseAmount($("#settingReserve").value),
      otherIncome: parseAmount($("#settingOtherIncome").value),
      fixedCharges: parseAmount($("#settingFixedCharges").value),
      baseExpenses: parseAmount($("#settingBaseExpenses").value),
    };
    saveState();
    renderAll();
    setView("dashboard");
  });

  $("#syncForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveSyncForm();
    queueAutoPull();
  });

  $("#pullSyncButton").addEventListener("click", pullFromSheet);
  $("#pushSyncButton").addEventListener("click", pushToSheet);
  $("#testScriptButton").addEventListener("click", testScriptAccess);

  $("#exportButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "financehub-mobile-export.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#resetButton").addEventListener("click", () => {
    state = createInitialState();
    saveState();
    fillFormDefaults();
    renderAll();
    setView("dashboard");
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function startAutoSync() {
  queueAutoPull();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      queueAutoPull();
    }
  });
}

fillFormDefaults();
bindEvents();
updateShiftPreview();
renderAll();
registerServiceWorker();
startAutoSync();

window.financeHubDebug = {
  getState: () => state,
  sheetUrl: SHEET_URL,
};
