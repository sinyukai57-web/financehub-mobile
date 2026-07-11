const SPREADSHEET_ID = "10XJELK1gXiBho_0YdpGvEzyDOOV_kzbW25C47iku1lw";
const SYNC_SECRET = "CHANGE_MOI";
const SYNC_SHEET_NAME = "Mobile Sync";

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === "pullFrame") {
    try {
      checkSecret_(params.secret);
      return outputFrame_({
        ok: true,
        frameToken: params.frameToken || "",
        state: mergeStates_(importWorkbook_(), loadState_()),
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      return outputFrame_({
        ok: false,
        frameToken: params.frameToken || "",
        error: String(error && error.message ? error.message : error),
      });
    }
  }

  return handle_(e, function (params) {
    checkSecret_(params.secret);
    const action = params.action || "pull";
    if (action === "pull") {
      return {
        ok: true,
        state: mergeStates_(importWorkbook_(), loadState_()),
        serverTime: new Date().toISOString(),
      };
    }
    if (action === "importWorkbook") {
      return {
        ok: true,
        state: importWorkbook_(),
        serverTime: new Date().toISOString(),
      };
    }
    throw new Error("Action inconnue.");
  });
}

function doPost(e) {
  const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
  checkSecret_(body.secret);
  if (body.action !== "push") {
    throw new Error("Action POST inconnue.");
  }
  saveState_(body.state);
  writeReadableTabs_(body.state);
  writeMainShifts_(body.state);
  writeMainAdvances_(body.state);
  writeMainAdvanceRevenues_(body.state);
  writeMainExpenses_(body.state);
  return output_({
    ok: true,
    updatedAt: body.state && body.state.updatedAt,
    serverTime: new Date().toISOString(),
  });
}

function mergeStates_(sheetState, savedState) {
  if (!savedState) {
    return sheetState;
  }
  return {
    schemaVersion: 1,
    appVersion: savedState.appVersion || sheetState.appVersion || "merged",
    updatedAt: newestDate_(sheetState.updatedAt, savedState.updatedAt),
    settings: Object.assign({}, savedState.settings || {}, sheetState.settings || {}),
    shifts: mergeRows_(sheetState.shifts || [], savedState.shifts || [], shiftKey_),
    advances: mergeRows_(sheetState.advances || [], savedState.advances || [], advanceKey_),
    expenses: mergeRows_(sheetState.expenses || [], savedState.expenses || [], expenseKey_),
  };
}

function newestDate_(a, b) {
  const first = safeDate_(a);
  const second = safeDate_(b);
  if (!first && !second) {
    return new Date().toISOString();
  }
  if (!first) {
    return second.toISOString();
  }
  if (!second) {
    return first.toISOString();
  }
  return first > second ? first.toISOString() : second.toISOString();
}

function safeDate_(value) {
  const date = new Date(value || "");
  return isNaN(date.getTime()) ? null : date;
}

function mergeRows_(first, second, keyFn) {
  const map = {};
  first.concat(second).forEach(function (item) {
    const key = keyFn(item);
    if (!map[key]) {
      map[key] = item;
    }
  });
  return Object.keys(map).map(function (key) { return map[key]; });
}

function shiftKey_(shift) {
  return ["shift", shift.date, shift.start, shift.end, shift.site].join("|");
}

function advanceKey_(advance) {
  return ["advance", advance.date, Number(advance.amount || 0).toFixed(2)].join("|");
}

function expenseKey_(expense) {
  return [
    "expense",
    expense.date,
    Number(expense.amount || 0).toFixed(2),
    expense.category,
    expense.note,
  ].join("|");
}

function handle_(e, fn) {
  const params = (e && e.parameter) || {};
  try {
    return output_(fn(params), params.callback);
  } catch (error) {
    return output_({ ok: false, error: String(error && error.message ? error.message : error) }, params.callback);
  }
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function outputFrame_(payload) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html = [
    "<!doctype html><html><body>",
    "<script>",
    "var payload = " + json + ";",
    "function send(){",
    "  try { window.parent.postMessage(payload, '*'); } catch (e) {}",
    "  try { window.top.postMessage(payload, '*'); } catch (e) {}",
    "}",
    "send();",
    "var count = 0;",
    "var timer = setInterval(function(){",
    "  send();",
    "  count += 1;",
    "  if (count >= 10) clearInterval(timer);",
    "}, 500);",
    "</script>",
    "FinanceHub sync",
    "</body></html>",
  ].join("");
  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function checkSecret_(secret) {
  if (!SYNC_SECRET || SYNC_SECRET === "CHANGE_MOI") {
    throw new Error("Change d'abord SYNC_SECRET dans Apps Script.");
  }
  if (String(secret || "") !== SYNC_SECRET) {
    throw new Error("Code secret incorrect.");
  }
}

function spreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  const ss = spreadsheet_();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function loadState_() {
  const sheet = spreadsheet_().getSheetByName(SYNC_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 6) {
    return null;
  }
  const values = sheet.getRange(6, 2, Math.max(1, sheet.getLastRow() - 5), 1).getValues();
  const json = values.map(function (row) { return row[0] || ""; }).join("").trim();
  if (!json) {
    return null;
  }
  const jsonStart = json.indexOf("{");
  if (jsonStart < 0) {
    return null;
  }
  try {
    return JSON.parse(json.slice(jsonStart));
  } catch (error) {
    return null;
  }
}

function saveState_(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Etat FinanceHub invalide.");
  }
  const sheet = sheet_(SYNC_SHEET_NAME);
  const json = JSON.stringify(state);
  const rows = [
    ["FinanceHub Mobile Sync", ""],
    ["updatedAt", state.updatedAt || ""],
    ["savedAt", new Date().toISOString()],
    ["", ""],
    ["chunk", "json"],
  ];
  for (let i = 0; i < json.length; i += 40000) {
    rows.push([String(i / 40000 + 1), json.slice(i, i + 40000)]);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
}

function writeReadableTabs_(state) {
  writeTable_("Mobile - Heures", [
    "Date",
    "Debut",
    "Fin",
    "Pause payee min",
    "Site",
    "Panier",
    "Habillage",
    "Note",
  ], (state.shifts || []).map(function (shift) {
    return [
      shift.date || "",
      shift.start || "",
      shift.end || "",
      Number(shift.pausePaidMinutes || 0),
      shift.site || "",
      shift.panier ? "Oui" : "Non",
      shift.habillage ? "Oui" : "Non",
      shift.note || "",
    ];
  }));

  writeTable_("Mobile - Acomptes", [
    "Date",
    "Montant",
    "Statut",
    "Note",
  ], (state.advances || []).map(function (advance) {
    return [
      advance.date || "",
      Number(advance.amount || 0),
      advance.status || "",
      advance.note || "",
    ];
  }));

  writeTable_("Mobile - Depenses", [
    "Date",
    "Montant",
    "Categorie",
    "Note",
  ], (state.expenses || []).map(function (expense) {
    return [
      expense.date || "",
      Number(expense.amount || 0),
      expense.category || "",
      expense.note || "",
    ];
  }));
}

function writeMainExpenses_(state) {
  const sheet = spreadsheet_().getSheetByName("Depenses variables");
  if (!sheet) {
    return;
  }

  const marker = "FinanceHub Mobile ID:";
  const lastRow = sheet.getLastRow();
  if (lastRow >= 6) {
    const notes = sheet.getRange(6, 9, lastRow - 5, 1).getDisplayValues();
    for (let index = notes.length - 1; index >= 0; index--) {
      if (String(notes[index][0] || "").indexOf(marker) >= 0) {
        sheet.deleteRow(index + 6);
      }
    }
  }

  const mobileExpenses = (state.expenses || []).filter(function (expense) {
    return expense.date && !String(expense.id || "").startsWith("sheet-");
  });
  if (!mobileExpenses.length) {
    return;
  }

  const rows = mobileExpenses.map(function (expense) {
    return [
      expense.date || "",
      monthStart_(expense.date),
      expense.category || "Autre",
      expense.note || "Depense mobile",
      Number(expense.amount || 0),
      "FinanceHub Mobile",
      "App",
      "A verifier",
      marker + " " + (expense.id || ""),
    ];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
}

function writeMainShifts_(state) {
  const sheet = spreadsheet_().getSheetByName("Heures Adecco");
  if (!sheet) {
    return;
  }

  removeMarkedRows_(sheet, 6, 27, "FinanceHub Mobile ID:");
  const shifts = (state.shifts || []).filter(function (shift) {
    return shift.date && !String(shift.id || "").startsWith("sheet-hours-");
  });
  if (!shifts.length) {
    return;
  }

  const settings = Object.assign(importSettings_(), state.settings || {});
  const rows = buildShiftRows_(shifts, settings);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 27).setValues(rows);
}

function writeMainAdvances_(state) {
  const sheet = spreadsheet_().getSheetByName("Acomptes");
  if (!sheet) {
    return;
  }

  removeMarkedRows_(sheet, 11, 10, "FinanceHub Mobile ID:");
  const advances = (state.advances || []).filter(function (advance) {
    return advance.date && !String(advance.id || "").startsWith("sheet-");
  });
  if (!advances.length) {
    return;
  }

  const rows = advances.map(function (advance) {
    const isDeducted = advance.status === "Deduit";
    const amount = Number(advance.amount || 0);
    return [
      advance.date || "",
      "Adecco France",
      monthLabel_(advance.date),
      amount,
      isDeducted ? "Oui" : "Non",
      isDeducted ? "Deduit via app" : "A deduire prochaine paie",
      isDeducted ? 0 : amount,
      advance.status || "Recu",
      isDeducted ? "Deja deduit" : "A surveiller",
      [advance.note || "Acompte saisi depuis l'app", "FinanceHub Mobile ID: " + (advance.id || "")].join(" - "),
    ];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
}

function writeMainAdvanceRevenues_(state) {
  const sheet = spreadsheet_().getSheetByName("Revenus");
  if (!sheet) {
    return;
  }

  removeMarkedRows_(sheet, 6, 8, "FinanceHub Mobile ID:");
  const advances = (state.advances || []).filter(function (advance) {
    return advance.date && advance.status !== "Prevu" && !String(advance.id || "").startsWith("sheet-");
  });
  if (!advances.length) {
    return;
  }

  const rows = advances.map(function (advance) {
    return [
      advance.date || "",
      monthStart_(advance.date),
      "Adecco France - acompte",
      "Salaire",
      Number(advance.amount || 0),
      advance.status === "Deduit" || advance.status === "Recu" ? "Oui" : "Prevu",
      "Revolut",
      [advance.note || "Acompte saisi depuis l'app", "FinanceHub Mobile ID: " + (advance.id || "")].join(" - "),
    ];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
}

function removeMarkedRows_(sheet, firstDataRow, markerColumn, marker) {
  const lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) {
    return;
  }
  const values = sheet.getRange(firstDataRow, markerColumn, lastRow - firstDataRow + 1, 1).getDisplayValues();
  for (let index = values.length - 1; index >= 0; index--) {
    if (String(values[index][0] || "").indexOf(marker) >= 0) {
      sheet.deleteRow(index + firstDataRow);
    }
  }
}

function buildShiftRows_(shifts, settings) {
  const weeklyTotals = {};
  return shifts
    .slice()
    .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
    .map(function (shift) {
      const hours = paidHours_(shift);
      const week = weekNumber_(shift.date);
      const weekKey = String(shift.date).slice(0, 4) + "-" + week;
      const previous = weeklyTotals[weekKey] || 0;
      const normal = Math.max(0, Math.min(hours, 35 - previous));
      const afterNormal = Math.max(0, hours - normal);
      const usedBeforeOt50 = Math.max(35, previous);
      const ot25 = Math.max(0, Math.min(afterNormal, 43 - usedBeforeOt50));
      const ot50 = Math.max(0, hours - normal - ot25);
      weeklyTotals[weekKey] = previous + hours;

      const panier = shift.panier ? Number(settings.panier || 0) : 0;
      const habillage = shift.habillage ? Number(settings.habillage || 0) : 0;
      const grossHours =
        normal * Number(settings.hourlyRate || 0) +
        ot25 * Number(settings.hourlyRate || 0) * 1.25 +
        ot50 * Number(settings.hourlyRate || 0) * 1.5;
      const grossPremiums = panier + habillage;
      const grossBase = grossHours + grossPremiums;
      const ifm = grossBase * (Number(settings.ifmRate || 10) / 100);
      const paidLeave = (grossBase + ifm) * (Number(settings.paidLeaveRate || 10) / 100);
      const grossTotal = grossBase + ifm + paidLeave;
      const net = grossTotal * (Number(settings.netRate || 80.168) / 100);

      return [
        shift.date || "",
        weekday_(shift.date),
        shift.site || "Mission Adecco",
        shift.start || "",
        shift.end || "",
        Number(shift.pausePaidMinutes || 0) / 60,
        hours,
        monthStart_(shift.date),
        week,
        weeklyTotals[weekKey],
        normal,
        ot25,
        ot50,
        panier,
        habillage,
        0,
        0,
        grossHours,
        grossPremiums,
        grossBase,
        ifm,
        paidLeave,
        grossTotal,
        net,
        0,
        net,
        [shift.note || "Saisi depuis l'app mobile", "FinanceHub Mobile ID: " + (shift.id || "")].join(" - "),
      ];
    });
}

function writeTable_(name, headers, rows) {
  const sheet = sheet_(name);
  const values = [headers].concat(rows.length ? rows : [["", "", "", "", "", "", "", ""].slice(0, headers.length)]);
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
}

function importWorkbook_() {
  return {
    schemaVersion: 1,
    appVersion: "sheet-import",
    updatedAt: new Date().toISOString(),
    settings: importSettings_(),
    shifts: importShifts_(),
    advances: importAdvances_(),
    expenses: importExpenses_(),
  };
}

function importSettings_() {
  const values = rows_("Parametres", 4, 20, 3);
  const map = {};
  values.forEach(function (row) {
    if (row[0]) {
      map[row[0]] = row[1];
    }
  });
  return {
    hourlyRate: parseNumber_(map["Taux horaire brut Adecco"], 13.83),
    netRate: parseNumber_(map["Taux net estime"], 80.168),
    ifmRate: parseNumber_(map["IFM"], 10),
    paidLeaveRate: parseNumber_(map["Conges payes"], 10),
    panier: parseNumber_(map["Prime panier par defaut"], 4.35),
    habillage: parseNumber_(map["Prime habillage par defaut"], 0.75),
    cash: dashboardAmount_("Liquidites disponibles", accountCash_()),
    otherIncome: dashboardAmount_("Revenus a venir", 0),
    fixedCharges: dashboardAmount_("Charges fixes a venir", 0),
    baseExpenses: dashboardAmount_("Depenses deja passees / info", 0),
    reserveTarget: parseNumber_(map["Reserve securite cible"], 1000),
  };
}

function dashboardAmount_(label, fallback) {
  const values = rows_("Tableau de bord", 4, 40, 2);
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0] || "").trim() === label) {
      return parseNumber_(values[index][1], fallback);
    }
  }
  return fallback;
}

function accountCash_() {
  return rows_("Comptes", 6, 100, 4).reduce(function (sum, row) {
    return String(row[3] || "").toLowerCase() === "oui"
      ? sum + parseNumber_(row[2], 0)
      : sum;
  }, 0);
}

function importShifts_() {
  return rows_("Heures Adecco", 6, 500, 15)
    .filter(function (row) { return row[0]; })
    .map(function (row) {
      const date = toIsoDate_(row[0]);
      if (!isIsoDate_(date)) {
        return null;
      }
      return {
        id: "sheet-hours-" + row[0],
        date: date,
        start: row[3] || "08:00",
        end: row[4] || "16:00",
        pausePaidMinutes: Math.round(parseNumber_(row[5], 0.42) * 60),
        site: row[2] || "Mission Adecco",
        panier: parseNumber_(row[13], 0) > 0,
        habillage: parseNumber_(row[14], 0) > 0,
        note: "Import Google Sheets",
      };
    })
    .filter(function (row) { return row; });
}

function importAdvances_() {
  const advances = rows_("Acomptes", 11, 200, 10)
    .filter(function (row) { return row[0]; })
    .map(function (row, index) {
      const date = toIsoDate_(row[0]);
      if (!isIsoDate_(date)) {
        return null;
      }
      return {
        id: "sheet-advance-" + index + "-" + row[0],
        date: date,
        amount: parseNumber_(row[3], 0),
        status: normalizeStatus_(row[7]),
        note: row[9] || row[5] || "",
      };
    })
    .filter(function (row) { return row; });

  return mergeRows_(advances, [], advanceKey_);
}

function importExpenses_() {
  return rows_("Depenses variables", 6, 1000, 9)
    .filter(function (row) { return row[0] && row[4]; })
    .map(function (row, index) {
      const date = toIsoDate_(row[0]);
      if (!isIsoDate_(date)) {
        return null;
      }
      return {
        id: "sheet-expense-" + index + "-" + row[0],
        date: date,
        amount: parseNumber_(row[4], 0),
        category: row[2] || "Autre",
        note: row[3] || row[8] || "",
      };
    })
    .filter(function (row) { return row; });
}

function rows_(name, startRow, maxRows, columns) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) {
    return [];
  }
  const availableRows = Math.max(0, sheet.getLastRow() - startRow + 1);
  if (!availableRows) {
    return [];
  }
  return sheet.getRange(startRow, 1, Math.min(maxRows, availableRows), columns).getDisplayValues();
}

function parseNumber_(value, fallback) {
  if (value === "" || value === null || typeof value === "undefined") {
    return fallback;
  }
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  if (!normalized) {
    return fallback;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function toIsoDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return match[0];
  }
  const frenchMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (frenchMatch) {
    const day = frenchMatch[1].padStart(2, "0");
    const month = frenchMatch[2].padStart(2, "0");
    const year = frenchMatch[3].length === 2 ? "20" + frenchMatch[3] : frenchMatch[3];
    return year + "-" + month + "-" + day;
  }
  return "";
}

function isIsoDate_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function monthStart_(date) {
  const iso = toIsoDate_(date);
  return iso ? iso.slice(0, 7) + "-01" : "";
}

function monthLabel_(date) {
  const iso = toIsoDate_(date);
  return iso ? iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
}

function weekday_(date) {
  const labels = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const parsed = new Date(toIsoDate_(date) + "T12:00:00");
  return labels[parsed.getDay()] || "";
}

function timeToMinutes_(value) {
  const parts = String(value || "00:00").split(":");
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
}

function paidHours_(shift) {
  const start = timeToMinutes_(shift.start);
  let end = timeToMinutes_(shift.end);
  if (end < start) {
    end += 24 * 60;
  }
  return Math.max(0, (end - start) / 60);
}

function weekNumber_(date) {
  const parsed = new Date(toIsoDate_(date) + "T00:00:00Z");
  const dayNumber = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(parsed.getUTCFullYear(), 0, 1));
  return Math.ceil(((parsed - yearStart) / 86400000 + 1) / 7);
}

function normalizeStatus_(value) {
  const text = String(value || "").toLowerCase();
  if (text.indexOf("deduit") >= 0) {
    return "Deduit";
  }
  if (text.indexOf("recu") >= 0) {
    return "Recu";
  }
  return "Prevu";
}
