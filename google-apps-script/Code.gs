const SPREADSHEET_ID = "10XJELK1gXiBho_0YdpGvEzyDOOV_kzbW25C47iku1lw";
const SYNC_SECRET = "CHANGE_MOI";
const SYNC_SHEET_NAME = "Mobile Sync";

function doGet(e) {
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
    settings: Object.assign({}, sheetState.settings || {}, savedState.settings || {}),
    shifts: mergeRows_(sheetState.shifts || [], savedState.shifts || [], shiftKey_),
    advances: mergeRows_(sheetState.advances || [], savedState.advances || [], advanceKey_),
    expenses: mergeRows_(sheetState.expenses || [], savedState.expenses || [], expenseKey_),
  };
}

function newestDate_(a, b) {
  return new Date(a || 0) > new Date(b || 0) ? a : b;
}

function mergeRows_(first, second, keyFn) {
  const map = {};
  first.concat(second).forEach(function (item) {
    const key = keyFn(item);
    map[key] = item;
  });
  return Object.keys(map).map(function (key) { return map[key]; });
}

function shiftKey_(shift) {
  return ["shift", shift.date, shift.start, shift.end, shift.site].join("|");
}

function advanceKey_(advance) {
  return ["advance", advance.date, Number(advance.amount || 0).toFixed(2), advance.status, advance.note].join("|");
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
  if (!sheet || sheet.getLastRow() < 5) {
    return null;
  }
  const values = sheet.getRange(5, 2, Math.max(1, sheet.getLastRow() - 4), 1).getValues();
  const json = values.map(function (row) { return row[0] || ""; }).join("");
  return json ? JSON.parse(json) : null;
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
    return expense.date && !String(expense.id || "").startsWith("sheet-expense-");
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
    reserveTarget: parseNumber_(map["Reserve securite cible"], 1000),
  };
}

function importShifts_() {
  return rows_("Heures Adecco", 6, 500, 15)
    .filter(function (row) { return row[0]; })
    .map(function (row) {
      return {
        id: "sheet-hours-" + row[0],
        date: toIsoDate_(row[0]),
        start: row[3] || "08:00",
        end: row[4] || "16:00",
        pausePaidMinutes: Math.round(parseNumber_(row[5], 0.42) * 60),
        site: row[2] || "Mission Adecco",
        panier: parseNumber_(row[13], 0) > 0,
        habillage: parseNumber_(row[14], 0) > 0,
        note: "Import Google Sheets",
      };
    });
}

function importAdvances_() {
  return rows_("Acomptes", 11, 200, 10)
    .filter(function (row) { return row[0]; })
    .map(function (row, index) {
      return {
        id: "sheet-advance-" + index + "-" + row[0],
        date: toIsoDate_(row[0]),
        amount: parseNumber_(row[3], 0),
        status: normalizeStatus_(row[7]),
        note: row[9] || row[5] || "",
      };
    });
}

function importExpenses_() {
  return rows_("Depenses variables", 6, 700, 9)
    .filter(function (row) { return row[0] && row[4]; })
    .map(function (row, index) {
      return {
        id: "sheet-expense-" + index + "-" + row[0],
        date: toIsoDate_(row[0]),
        amount: parseNumber_(row[4], 0),
        category: row[2] || "Autre",
        note: row[3] || row[8] || "",
      };
    });
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
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function toIsoDate_(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : text;
}

function monthStart_(date) {
  const iso = toIsoDate_(date);
  return iso ? iso.slice(0, 7) + "-01" : "";
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
