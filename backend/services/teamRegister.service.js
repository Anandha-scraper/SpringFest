/** Print-ready, team-grouped attendee registers for organisers.
 *
 * This deliberately has a different grain from the flat CSV export: one
 * registration is one team block, while every ticket holder gets a row for a
 * handwritten signature.  The same normalizer (`ticketHolders`) the QR and
 * admin read models use keeps the lead/member order and personal details
 * consistent everywhere.  Only completed registrations are eligible: an
 * attendance register must never put a draft, a declined payment, or an
 * unapproved proof at the door.
 */
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { ApiError } from "../utils/ApiError.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import * as aggregate from "./aggregate.js";
import { ticketHolders } from "./qr.js";

const FEST_NAME = "Spring Fest 2k26";
const DEPARTMENT = "Computer Science and Engineering";
const INSTITUTION = "K.S.R College of Engineering";
const TABLE_COLUMNS = [
  { key: "serial", label: "S.No", width: 8 },
  { key: "name", label: "Name", width: 26 },
  { key: "college", label: "College Name", width: 26 },
  { key: "email", label: "Email", width: 30 },
  { key: "phone", label: "Phone", width: 16 },
  { key: "team", label: "Team Name", width: 22 },
  { key: "signature", label: "Signature", width: 26 },
];
const ALL_EVENT_TABLE_COLUMNS = [
  ...TABLE_COLUMNS.slice(0, -1),
  { key: "event", label: "Event", width: 28 },
  TABLE_COLUMNS.at(-1),
];

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

function asString(value) {
  return String(value ?? "").trim();
}

function sortByName(a, b) {
  return (a.name || a.id || "").localeCompare(b.name || b.id || "");
}

function eventFilePart(sections) {
  if (sections.length !== 1) return "all-events";
  return (sections[0].event.name || sections[0].event.id || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "event";
}

function teamDisplayName(row) {
  return asString(row.team_name) || "Individual registration";
}

function teamHeading(row, codes) {
  const name = asString(row.team_name);
  const label = name ? `Team ${name}` : "Individual registration";
  return `${label} - ${codes.join(", ")}`;
}

function tableColumns(section) {
  return section.includeEvent ? ALL_EVENT_TABLE_COLUMNS : TABLE_COLUMNS;
}

function buildSection(event, rows, { includeEvent = false, events = {} } = {}) {
  const ordered = [...rows].sort((a, b) => {
    if (includeEvent) {
      const byEvent = aggregate.eventName(events, a.event_id || "").localeCompare(
        aggregate.eventName(events, b.event_id || "")
      );
      if (byEvent) return byEvent;
    }
    const byTeam = teamDisplayName(a).localeCompare(teamDisplayName(b));
    return byTeam || (a.created_at || "").localeCompare(b.created_at || "");
  });

  let serial = 0;
  const teams = ordered.map((registration) => {
    const holders = ticketHolders(registration);
    const codes = holders.map((_, index) => asString(registration.allocation_codes?.[index]) || "-");
    const eventName = aggregate.eventName(events, registration.event_id || "");
    return {
      name: teamDisplayName(registration),
      heading: `${includeEvent ? `${eventName} - ` : ""}${teamHeading(registration, codes)}`,
      members: holders.map((holder, index) => ({
        serial: ++serial,
        name: `${index === 0 ? "Lead" : `Member ${index}`} - ${asString(holder.name) || "-"}`,
        college: asString(holder.college) || "-",
        email: asString(holder.email) || "-",
        phone: asString(holder.phone) || "-",
        team: teamDisplayName(registration),
        event: eventName,
        signature: "",
      })),
    };
  });

  const sizeCounts = new Map();
  for (const team of teams) {
    const size = team.members.length;
    sizeCounts.set(size, (sizeCounts.get(size) || 0) + 1);
  }
  const teamSizeBreakdown = [...sizeCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([size, count]) => `${size}-person teams: ${count}`)
    .join("; ");

  return {
    event,
    includeEvent,
    teams,
    teamCount: teams.length,
    participantCount: serial,
    teamSizeBreakdown: teamSizeBreakdown || "No teams",
  };
}

/** Resolve the exact event/team blocks shared by both output formats. */
export async function loadTeamRegister({ eventId = "" } = {}) {
  const data = await aggregate.loadAll();
  const requestedEventId = asString(eventId);
  if (requestedEventId && !data.events[requestedEventId]) {
    throw new ApiError(404, "Event not found");
  }

  const completed = data.registrations.filter(
    (row) => row.status === STATUS_COMPLETED && (!requestedEventId || row.event_id === requestedEventId)
  );
  if (!completed.length) {
    throw new ApiError(404, "No confirmed registrations match this export");
  }

  const knownRows = completed.filter((row) => data.events[row.event_id]);
  if (!knownRows.length) throw new ApiError(404, "No confirmed registrations match this export");
  if (requestedEventId) {
    return [buildSection({ id: requestedEventId, ...data.events[requestedEventId] }, knownRows, { events: data.events })];
  }
  return [
    buildSection(
      { id: "all-events", name: "All Events" },
      knownRows,
      { includeEvent: true, events: data.events }
    ),
  ];
}

function columnLetter(index) {
  return String.fromCharCode(64 + index);
}

function addRegisterHeader(sheet, section, columns) {
  const last = columnLetter(columns.length);
  const split = columnLetter(Math.ceil(columns.length / 2));
  const rightStart = columnLetter(Math.ceil(columns.length / 2) + 1);
  sheet.mergeCells(`A1:${last}1`);
  sheet.mergeCells(`A2:${last}2`);
  sheet.mergeCells(`A3:${last}3`);
  sheet.mergeCells(`A4:${split}4`);
  sheet.mergeCells(`${rightStart}4:${last}4`);
  sheet.getCell("A1").value = `${FEST_NAME} - ${section.event.name || section.event.id}`;
  sheet.getCell("A2").value = DEPARTMENT;
  sheet.getCell("A3").value = INSTITUTION;
  sheet.getCell("A4").value = `Total Registration Team Count: ${section.teamCount}`;
  sheet.getCell("E4").value = `Total Participant Count: ${section.participantCount}`;
  sheet.mergeCells(`A5:${last}5`);
  sheet.getCell("A5").value = `Team-size breakdown: ${section.teamSizeBreakdown}`;

  for (const rowNumber of [1, 2, 3, 4, 5]) {
    const row = sheet.getRow(rowNumber);
    row.alignment = { vertical: "middle", horizontal: rowNumber < 4 ? "center" : "left" };
  }
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF000000" } };
  sheet.getCell("A2").font = { bold: true, size: 11 };
  sheet.getCell("A3").font = { bold: true, size: 11 };
  for (const cell of ["A4", "E4", "A5"]) {
    sheet.getCell(cell).font = { bold: true, size: 10 };
  }
}

function addRegisterTable(sheet, section, columns) {
  const headerRowNumber = 7;
  const header = sheet.getRow(headerRowNumber);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  });
  header.height = 24;

  for (const team of section.teams) {
    const heading = sheet.addRow([team.heading]);
    sheet.mergeCells(`A${heading.number}:${columnLetter(columns.length)}${heading.number}`);
    const headingCell = sheet.getCell(`A${heading.number}`);
    headingCell.font = { bold: true, color: { argb: "FF000000" } };
    headingCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    headingCell.alignment = { vertical: "middle", wrapText: true };
    headingCell.border = {
      top: { style: "thin", color: { argb: "FF808080" } },
      left: { style: "thin", color: { argb: "FF808080" } },
      bottom: { style: "thin", color: { argb: "FF808080" } },
      right: { style: "thin", color: { argb: "FF808080" } },
    };
    heading.height = 22;

    for (const member of team.members) {
      const row = sheet.addRow(columns.map((column) => member[column.key]));
      row.height = 32;
      row.alignment = { vertical: "middle", wrapText: true };
      for (let index = 1; index <= columns.length; index += 1) {
        const cell = row.getCell(index);
        cell.alignment = {
          vertical: "middle",
          horizontal: index === 1 ? "center" : "left",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF808080" } },
          left: { style: "thin", color: { argb: "FF808080" } },
          bottom: { style: "thin", color: { argb: "FF808080" } },
          right: { style: "thin", color: { argb: "FF808080" } },
        };
      }
    }
  }
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
}

function safeWorksheetName(name, used) {
  const base = (asString(name) || "Event").replace(/[\\/*?:\[\]]/g, " ").slice(0, 31) || "Event";
  let candidate = base;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${index++})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function buildTeamRegisterXlsx(sections) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = FEST_NAME;
  workbook.created = new Date();
  const usedNames = new Set();

  for (const section of sections) {
    const sheet = workbook.addWorksheet(safeWorksheetName(section.event.name || section.event.id, usedNames));
    const columns = tableColumns(section);
    sheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
    sheet.views = [{ state: "frozen", ySplit: 7 }];
    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    };
    addRegisterHeader(sheet, section, columns);
    addRegisterTable(sheet, section, columns);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const PDF_PAGE = { width: 841.89, height: 595.28, margin: 32 };
const PDF_BASE_COLUMNS = [32, 112, 112, 142, 80, 96, 170];
const PDF_ALL_EVENT_COLUMNS = [28, 90, 90, 115, 68, 76, 96, 150];

function pdfColumnWidths(section) {
  return section.includeEvent ? PDF_ALL_EVENT_COLUMNS : PDF_BASE_COLUMNS;
}

function pdfTableWidth(widths) {
  return widths.reduce((total, width) => total + width, 0);
}

function pdfHeader(doc, section, tableWidth, { continued = false } = {}) {
  const left = PDF_PAGE.margin;
  const top = PDF_PAGE.margin;
  const title = `${FEST_NAME} - ${section.event.name || section.event.id}${continued ? " (continued)" : ""}`;
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#000000").text(title, left, top, {
    width: tableWidth,
    align: "center",
  });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000").text(DEPARTMENT, left, top + 20, {
    width: tableWidth,
    align: "center",
  });
  doc.text(INSTITUTION, left, top + 33, { width: tableWidth, align: "center" });
  doc.font("Helvetica").fontSize(8).text(
    `Total Registration Team Count: ${section.teamCount}    Total Participant Count: ${section.participantCount}`,
    left,
    top + 48,
    { width: tableWidth, align: "center" }
  );
  doc.text(`Team-size breakdown: ${section.teamSizeBreakdown}`, left, top + 60, {
    width: tableWidth,
    align: "center",
  });
  return top + 78;
}

function pdfTableHeader(doc, y, columns, widths) {
  let x = PDF_PAGE.margin;
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF");
  for (let index = 0; index < columns.length; index += 1) {
    const width = widths[index];
    doc.rect(x, y, width, 20).fillAndStroke("#000000", "#000000");
    doc.fillColor("#FFFFFF").text(columns[index].label, x + 3, y + 6, {
      width: width - 6,
      align: "center",
    });
    x += width;
  }
  return y + 20;
}

function memberRowHeight(doc, member, columns, widths) {
  const values = columns.map((column) => member[column.key]);
  const heights = values.map((value, index) =>
    index === columns.length - 1
      ? 20
      : doc.heightOfString(value, { width: widths[index] - 6, lineGap: 1 })
  );
  return Math.max(26, Math.ceil(Math.max(...heights) + 8));
}

function drawMemberRow(doc, y, member, height, columns, widths) {
  let x = PDF_PAGE.margin;
  doc.font("Helvetica").fontSize(7).fillColor("#000000");
  for (let index = 0; index < columns.length; index += 1) {
    const width = widths[index];
    doc.rect(x, y, width, height).strokeColor("#808080").stroke();
    if (index !== columns.length - 1) {
      doc.fillColor("#000000").text(member[columns[index].key], x + 3, y + 4, {
        width: width - 6,
        align: index === 0 ? "center" : "left",
        lineGap: 1,
      });
    }
    x += width;
  }
  return y + height;
}

function teamHeadingHeight(doc, heading, tableWidth) {
  doc.font("Helvetica-Bold").fontSize(8);
  return Math.max(19, Math.ceil(doc.heightOfString(heading, { width: tableWidth - 10 }) + 7));
}

function drawTeamHeading(doc, y, heading, tableWidth) {
  const height = teamHeadingHeight(doc, heading, tableWidth);
  doc.rect(PDF_PAGE.margin, y, tableWidth, height).fillAndStroke("#F2F2F2", "#808080");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000").text(heading, PDF_PAGE.margin + 5, y + 4, {
    width: tableWidth - 10,
  });
  return { height, nextY: y + height };
}

function newPdfPage(doc, section, columns, widths, continued) {
  doc.addPage();
  const tableWidth = pdfTableWidth(widths);
  return pdfTableHeader(doc, pdfHeader(doc, section, tableWidth, { continued }), columns, widths);
}

export async function buildTeamRegisterPdf(sections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PDF_PAGE.width, PDF_PAGE.height],
      margin: PDF_PAGE.margin,
      info: { Title: `${FEST_NAME} team register` },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    sections.forEach((section, sectionIndex) => {
      const columns = tableColumns(section);
      const widths = pdfColumnWidths(section);
      const tableWidth = pdfTableWidth(widths);
      if (sectionIndex > 0) doc.addPage();
      let y = pdfTableHeader(doc, pdfHeader(doc, section, tableWidth), columns, widths);
      const bottom = PDF_PAGE.height - PDF_PAGE.margin;

      for (const team of section.teams) {
        const rowHeights = team.members.map((member) => memberRowHeight(doc, member, columns, widths));
        const headingHeight = teamHeadingHeight(doc, team.heading, tableWidth);
        const fullTeamHeight = headingHeight + rowHeights.reduce((total, height) => total + height, 0);
        if (y + fullTeamHeight > bottom && fullTeamHeight <= bottom - (PDF_PAGE.margin + 98)) {
          y = newPdfPage(doc, section, columns, widths, true);
        }

        if (y + headingHeight > bottom) y = newPdfPage(doc, section, columns, widths, true);
        y = drawTeamHeading(doc, y, team.heading, tableWidth).nextY;
        for (let index = 0; index < team.members.length; index += 1) {
          const height = rowHeights[index];
          if (y + height > bottom) {
            y = newPdfPage(doc, section, columns, widths, true);
            y = drawTeamHeading(doc, y, `${team.heading} (continued)`, tableWidth).nextY;
          }
          y = drawMemberRow(doc, y, team.members[index], height, columns, widths);
        }
      }
    });
    doc.end();
  });
}

export async function generateTeamRegister({ eventId = "", format } = {}) {
  if (format !== "xlsx" && format !== "pdf") {
    throw new ApiError(400, "format must be xlsx or pdf");
  }
  const sections = await loadTeamRegister({ eventId });
  const suffix = eventFilePart(sections);
  if (format === "xlsx") {
    return {
      buffer: await buildTeamRegisterXlsx(sections),
      contentType: XLSX_CONTENT_TYPE,
      filename: `spring-fest-2k26-${suffix}-team-register.xlsx`,
    };
  }
  return {
    buffer: await buildTeamRegisterPdf(sections),
    contentType: PDF_CONTENT_TYPE,
    filename: `spring-fest-2k26-${suffix}-team-register.pdf`,
  };
}
