/** The .xlsx an admin downloads, fills in, and uploads back.
 *
 * Generated from live data rather than shipped as a static file, for one
 * reason that matters: the Events sheet and the `event_id` dropdown are built
 * from the events that exist *right now*. A checked-in template goes stale the
 * first time somebody renames an event, and the resulting import fails row by
 * row with "event not found" against ids that used to be right. It also means
 * the same template serves a completely different fest — replace the events
 * and the next download lists those instead, with nothing to edit here.
 *
 * Three sheets, all visible: **Participants** is the only one read on import,
 * **Events** is the reference table AND the source of every dropdown, and
 * **Instructions** explains the grouping with a worked example. The dropdown
 * lists used to live on a fourth, hidden sheet; they were folded into Events
 * so that someone wondering where a dropdown's values come from can go and
 * look, and so there is one fewer sheet to explain.
 *
 * The column list here is the contract. `registrationImport.service.js`
 * rejects a workbook whose header row doesn't match it exactly — a silently
 * reordered file would map every column to the wrong field, which is the one
 * failure mode that is both catastrophic and invisible.
 *
 * ── Why `location` is one column and not two ──
 * `parseParticipantDetails` wants a Tamil Nadu district plus a free-text
 * `location_other` when the answer is "Other". Asking an admin to fill two
 * columns correctly is a worse trade than mapping at the boundary: anything
 * not in TN_CITIES is passed through as `{ location: "Other", location_other:
 * <what they typed> }`, so someone from outside the state just types their
 * city and the validator is reused untouched.
 */
import ExcelJS from "exceljs";

import { DEPARTMENTS, STUDY_YEARS, TN_CITIES } from "../utils/validate.js";
import { SPOT_PAYMENT_METHODS } from "./spotRegistration.service.js";

/** Header row, in order. Also the import's expected header — changing this
 * changes what an already-distributed template validates against. */
export const IMPORT_COLUMNS = [
  "team_name",
  "event_id",
  "name",
  "email",
  "phone",
  "college",
  "department",
  "year",
  "location",
  "payment_method",
  "transaction_id",
];

const COLUMN_WIDTHS = {
  team_name: 20,
  event_id: 34,
  name: 24,
  email: 30,
  phone: 16,
  college: 24,
  department: 14,
  year: 8,
  location: 18,
  payment_method: 16,
  transaction_id: 22,
};

/** Worked rows for the Instructions sheet.
 *
 * A filled-in example answers the two questions the prose above it never
 * quite does — what a team actually looks like when it is typed out, and
 * where the payment columns go — faster than another paragraph. The team is
 * shown first because it is the shape people get wrong.
 */
const EXAMPLE_ROWS = [
  // A three-person team: same team_name, same event_id, lead first, and the
  // payment on the lead's row only.
  ["Byte Squad", "<event id>", "Anitha R", "anitha@example.edu", "9876500011",
   "KIOT", "CSE", "3", "Salem", "online", "UPI2451XY"],
  ["Byte Squad", "<event id>", "Karthik S", "karthik@example.edu", "9876500012",
   "KIOT", "IT", "3", "Erode", "", ""],
  ["Byte Squad", "<event id>", "Meera V", "meera@example.edu", "9876500013",
   "KIOT", "ECE", "2", "Coimbatore", "", ""],
  // An individual: team_name blank, pays for themselves.
  ["", "<event id>", "Suresh B", "suresh@example.edu", "9876500014",
   "Kongu Engg", "MECH", "4", "Tiruppur", "cash", ""],
];

const INSTRUCTIONS = [
  ["Spring Fest 2k26 — bulk participant import"],
  [],
  ["Fill in the Participants sheet. One row per PERSON. Upload this whole file."],
  ["The Events sheet is reference only — it also holds the dropdown lists, so don't delete it."],
  [],
  ["Teams"],
  ["  Give every member of a team the SAME team_name and the SAME event_id."],
  ["  Rows are grouped by that pair, and the FIRST row of a group is the team lead."],
  ["  Leave team_name blank for an individual registration — one row, one registration."],
  ["  Two different events may reuse a team name; grouping is per event."],
  [],
  ["Columns"],
  ["  event_id        Pick from the dropdown. The Events sheet lists them with fees and team sizes."],
  ["  email           Must be unique within an event, and one phone belongs to one email across the fest."],
  ["  phone           Exactly 10 digits. Format the column as Text if Excel strips a leading zero."],
  ["  department      Pick from the dropdown."],
  ["  year            1-4, or PG."],
  ["  location        Pick your district, or just type any other city."],
  ["  payment_method  cash or online. Lead's row only — the team pays once."],
  ["  transaction_id  Required when payment_method is online. Lead's row only."],
  [],
  ["Example — a team of three, then one individual"],
  ["  Replace <event id> with a real id from the Events sheet. Don't copy these rows in as-is."],
  [],
  ["Notes"],
  ["  The fee is taken from the event, never from this sheet."],
  ["  Imported people are recorded as paid and get their allocation code immediately."],
  ["  They do not need an account first — signing in later attaches the registration to them."],
  ["  Validate with a dry run before importing. Errors are reported by row number."],
  ["  Re-uploading the same file is safe: rows already imported are reported, never duplicated."],
  ["  At most 300 rows per file."],
];

/** Point a column's cells at a list on the hidden Lists sheet. Excel caps an
 * inline `,`-joined list at 255 characters, which TN_CITIES comfortably
 * exceeds — a range reference has no such limit. */
function listValidation(sheet, columnLetter, range, rows) {
  for (let r = 2; r <= rows; r += 1) {
    sheet.getCell(`${columnLetter}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [range],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Not in the list",
      error: "Pick one of the listed values.",
    };
  }
}

/** Build the workbook. `events` is the live events collection as
 * `[{ id, ...data }]`. Returns a Buffer ready to stream. */
export async function buildTemplateWorkbook(events = []) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  // Room for validations to apply to empty rows the admin will fill in.
  const VALIDATED_ROWS = 400;

  // ── Participants — the sheet that gets filled in ───────────────────────
  const sheet = wb.addWorksheet("Participants");
  sheet.columns = IMPORT_COLUMNS.map((key) => ({
    header: key,
    key,
    width: COLUMN_WIDTHS[key] || 18,
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  // Frozen so the columns stay readable 200 rows down.
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Phone as text: Excel turns 9876543210 into a number and a leading zero
  // would vanish before the file ever reaches the server.
  sheet.getColumn("phone").numFmt = "@";
  sheet.getColumn("transaction_id").numFmt = "@";

  // Every dropdown points at a range on the Events sheet below — the event
  // list at its real `event_id` column, the enums at the lookup block beside
  // it. One reference sheet instead of a second hidden one: an admin who
  // wonders where a dropdown's values come from can now go and look.
  const eventIdRange = events.length ? `Events!$A$2:$A$${events.length + 1}` : "";
  const lookups = [
    ["I", DEPARTMENTS],
    ["J", STUDY_YEARS],
    ["K", [...TN_CITIES]],
    ["L", SPOT_PAYMENT_METHODS],
  ];
  const lookupRange = (letter, values) => `Events!$${letter}$2:$${letter}$${values.length + 1}`;

  const validations = [
    ["B", eventIdRange],
    ["G", lookupRange("I", DEPARTMENTS)],
    ["H", lookupRange("J", STUDY_YEARS)],
    ["I", lookupRange("K", [...TN_CITIES])],
    ["J", lookupRange("L", SPOT_PAYMENT_METHODS)],
  ];
  for (const [col, ref] of validations) {
    // location stays free-text on purpose — the dropdown is a convenience,
    // and anything unlisted is imported as "Other".
    if (ref) listValidation(sheet, col, ref, VALIDATED_ROWS);
  }

  // ── Events — reference table, and the lists every dropdown reads ───────
  const ref = wb.addWorksheet("Events");
  ref.columns = [
    { header: "event_id", key: "id", width: 34 },
    { header: "name", key: "name", width: 32 },
    { header: "category", key: "category", width: 16 },
    { header: "fee", key: "fee", width: 10 },
    { header: "team_event", key: "is_team_event", width: 12 },
    { header: "team_min", key: "team_min", width: 10 },
    { header: "team_max", key: "team_max", width: 10 },
    // H is a deliberate gap, so the lookup block reads as separate from the
    // event table rather than as more columns of it.
    { header: "", key: "gap", width: 4 },
    { header: "department", key: "l_department", width: 14 },
    { header: "year", key: "l_year", width: 8 },
    { header: "location", key: "l_location", width: 18 },
    { header: "payment_method", key: "l_payment", width: 16 },
  ];
  ref.getRow(1).font = { bold: true };
  ref.views = [{ state: "frozen", ySplit: 1 }];
  for (const e of events) {
    ref.addRow({
      id: e.id,
      name: e.name || "",
      category: e.category || "",
      fee: e.fee || 0,
      is_team_event: e.is_team_event ? "yes" : "no",
      team_min: e.team_min ?? 1,
      team_max: e.team_max ?? 1,
    });
  }

  // The lookup block. Written by cell rather than by row: these columns are
  // longer than the event table (TN_CITIES especially), so they can't be
  // filled in the same addRow() pass.
  for (const [letter, values] of lookups) {
    values.forEach((v, i) => {
      ref.getCell(`${letter}${i + 2}`).value = v;
    });
  }

  // ── Instructions ───────────────────────────────────────────────────────
  const help = wb.addWorksheet("Instructions");
  // Column A carries both the prose and the example's first column. Prose
  // lines overflow into the empty cells beside them, which is how Excel
  // renders them anyway, and keeping A narrow is what lets the worked example
  // below line up as a readable table.
  help.columns = [
    { width: 16 },
    { width: 26 },
    { width: 16 },
    { width: 24 },
    { width: 13 },
    { width: 14 },
    { width: 12 },
    { width: 7 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
  ];
  for (const line of INSTRUCTIONS) help.addRow(line);
  help.getRow(1).font = { bold: true, size: 14 };

  // The worked example, headed by the real column names so it reads as the
  // Participants sheet rather than as more prose.
  const exampleHead = help.addRow(IMPORT_COLUMNS);
  exampleHead.font = { bold: true };
  exampleHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  for (const row of EXAMPLE_ROWS) help.addRow(row);

  help.addRow([]);
  help.addRow(["Byte Squad is ONE registration of three people — the lead is the first row,"]);
  help.addRow(["and only the lead's row carries payment_method and transaction_id."]);
  help.addRow(["Suresh has no team_name, so he is a registration on his own."]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
