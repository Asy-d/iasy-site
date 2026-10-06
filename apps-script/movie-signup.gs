// Movie Nights sign-up receiver.
// Paste into the Google Sheet: Extensions > Apps Script, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). Copy the Web app URL into movie/index.html (data-endpoint).

const SHEET_NAME = "Sheet1";
const HEADERS = ["Timestamp", "Name", "Movie Night Type", "Phone Number"];
const MAX_LEN = 200;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const p = (e && e.parameter) || {};

    if (p.website) return json_({ ok: true }); // honeypot: bots fill this in

    const name = clean_(p.name);
    const types = clean_(p.types);
    const phone = clean_(p.phone);

    if (!name || !types || !phone) return json_({ ok: false, error: "missing_fields" });
    if (!/^[+()\d][\d\s().+-]{6,24}$/.test(phone)) return json_({ ok: false, error: "bad_phone" });

    const sheet = getSheet_();
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 4).setNumberFormat("@").setValues([[
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
      name,
      types,
      phone,
    ]]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: "server_error" });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, message: "Movie Nights sign-up endpoint is live." });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

// Trim, cap length, and neutralise spreadsheet formulas (=, +, -, @ at the start).
function clean_(value) {
  let s = String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  if (/^[=+\-@]/.test(s) && !/^\+?[\d(]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
