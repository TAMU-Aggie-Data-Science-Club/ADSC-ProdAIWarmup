/**
 * Who’s in the Room? — Google Forms response endpoint.
 * Paste into Extensions → Apps Script in your linked response spreadsheet.
 * Deploy → New deployment → Web app.
 * Execute as: Me. Who has access: Anyone (not only signed-in Google users).
 * Authorize, deploy, and copy the /exec URL into DATA_ENDPOINT in app.js.
 * After edits: Deploy → Manage deployments → Edit → New version → Deploy.
 * Only the eight allowlisted questions are returned. Never publish the raw sheet.
 */
const SPREADSHEET_ID = ""; // Leave blank for a script bound to the response sheet.
const SHEET_NAME = "Form Responses 1"; // Change to your response tab's exact name.

const HEADERS = {
  "name": "What's your full name?",
  "classification": "What's your classification?",
  "major": "What's your major? (4 letter code, CSCE, DAEN, STAT, etc.)",
  "work": "How do you like to work?",
  "comfort": "Self-rating: comfort with the topic today (Pick 1)",
  "activity": "Pick your favorite activity out of this list",
  "fair": "Are you going to the SEC Career Fair?",
  "goal": "What's your goal right now?"
};
const keyOf = value => String(value??'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]/g,'');
function fieldFor(header){
 const key=keyOf(header);
 for(const [field,exact] of Object.entries(HEADERS)) if(key===keyOf(exact))return field;
 const aliases={name:['name','fullname','whatsyourname'],classification:['classification','class','year','classyear'],major:['major','whatsyourmajor'],work:['work','workstyle','workingstyle'],comfort:['comfort','aicomfort','topiccomfort','selfrating'],activity:['activity','favoriteactivity','favouriteactivity','interest'],fair:['fair','careerfair','seccareerfair'],goal:['goal','currentgoal']};
 return Object.keys(aliases).find(field=>aliases[field].includes(key));
}

function doGet() {
  try {
    const spreadsheet = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('Set SPREADSHEET_ID or bind this script to a sheet.');
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Response sheet not found.');
    const values = sheet.getDataRange().getDisplayValues();
    const sourceHeaders = values.shift() || [];
    const columns = [];
    sourceHeaders.forEach(function(header, index) {
      const field = fieldFor(header);
      if (field && !columns.some(function(c) { return c.field === field; })) {
        columns.push({ field: field, index: index });
      }
    });
    if (!columns.some(function(c) { return c.field === 'name'; })) throw new Error('Missing full name column.');
    const rows = values.filter(function(row) {
      return columns.some(function(c) { return String(row[c.index] || '').trim() !== ''; });
    }).map(function(row) {
      const clean = {};
      columns.forEach(function(c) { clean[HEADERS[c.field]] = String(row[c.index] || '').trim(); });
      return clean;
    });
    return json({
      headers: columns.map(function(c) { return HEADERS[c.field]; }),
      rows: rows,
      generatedAt: new Date().toISOString() // Response freshness, never a submission timestamp.
    });
  } catch (error) {
    // Do not expose spreadsheet identifiers, raw headers, row data, or internal errors.
    return json({ error: 'Unable to read the response sheet. Check script configuration.' });
  }
}
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
