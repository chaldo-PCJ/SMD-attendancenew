/**
 * Google Apps Script backend for the attendance web application.
 *
 * Data model
 * - One sheet per classroom.
 * - Sheet names are the compact classroom codes used in the workbook: 21, 22, ... 65.
 * - The first row is the header row:
 *   วันเดือนปี | เลขประจำตัว | เลขที่ | ชื่อ-สกุล | ชั้น | มา | สาย | ลา | ขาด
 *
 * Row conventions
 * - Roster row: date is blank, student fields are filled, status columns are blank.
 * - Attendance row: date is filled, student fields are filled, exactly one status column has a value.
 *
 * Deployment steps:
 * 1. Open the spreadsheet that contains the classroom tabs.
 * 2. Extensions > Apps Script.
 * 3. Paste this file.
 * 4. Deploy > New deployment > Web app.
 * 5. Execute as: Me.
 * 6. Who has access: Anyone.
 * 7. Copy the web app URL into NEXT_PUBLIC_APPS_SCRIPT_URL.
 */

var TIME_ZONE = "Asia/Bangkok";
var SPREADSHEET_ID = "1ygvqyv5xc0Bu9LoE6-QRrrCMzsdyPed2MZa_TXIQauM";
var SHEET_HEADERS = ["วันเดือนปี", "เลขประจำตัว", "เลขที่", "ชื่อ-สกุล", "ชั้น", "มา", "สาย", "ลา", "ขาด"];
var STATUS_HEADERS = ["มา", "สาย", "ลา", "ขาด"];
var CLASSROOMS = [
  "2/1", "2/2", "2/3", "2/4",
  "3/1", "3/2", "3/3", "3/4",
  "4/1", "4/2", "4/3", "4/4", "4/5",
  "5/1", "5/2", "5/3", "5/4", "5/5",
  "6/1", "6/2", "6/3", "6/4", "6/5"
];

function doPost(e) {
  var result;

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No post data received");
    }

    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;

    switch (action) {
      case "getStudents":
        result = getStudents(requestData.classroom);
        break;
      case "getAllStudents":
        result = getAllStudents();
        break;
      case "saveStudents":
        result = saveStudents(requestData.classroom, requestData.students);
        break;
      case "deleteStudent":
        result = deleteStudent(requestData.classroom, requestData.studentId);
        break;
      case "saveAttendance":
        result = saveAttendance(requestData.classroom, requestData.date, requestData.attendance);
        break;
      case "getAttendance":
        result = getAttendance(requestData.classroom, requestData.date);
        break;
      case "bootstrapWorkbook":
        result = bootstrapWorkbook();
        break;
      default:
        result = { success: false, error: "Unknown action: " + action };
    }
  } catch (err) {
    result = { success: false, error: String(err && err.message ? err.message : err) };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.TEXT);
}


function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Attendance backend is running",
    classrooms: CLASSROOMS
  })).setMimeType(ContentService.MimeType.TEXT);
}

function bootstrapWorkbook() {
  var ss = getSpreadsheet();
  var created = [];

  CLASSROOMS.forEach(function (classroom) {
    var sheet = getOrCreateClassroomSheet(classroom);
    ensureHeaderRow(sheet);
    created.push(sheet.getName());
  });

  return { success: true, sheets: created.length, created: created };
}

function getStudents(classroom) {
  if (!classroom) {
    throw new Error("Classroom is required for getStudents");
  }

  // CacheService for roster (6h)
  var cache = CacheService.getScriptCache();
  var cacheKey = "getStudents:" + String(classroom);
  var cached = cache.get(cacheKey);
  if (cached) {
    var parsed = JSON.parse(cached);
    return parsed;
  }

  var sheet = getClassroomSheet(classroom, false);
  if (!sheet) {
    return { success: true, students: [] };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, students: [] };
  }

  var roster = [];
  var rosterSeen = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!hasStudentIdentity(row)) {
      continue;
    }

    var student = toStudent(row, classroom);
    if (!student.studentId || !student.name) {
      continue;
    }
    student.classroom = classroom;

    if (isRosterRow(row)) {
      if (!rosterSeen[student.studentId]) {
        rosterSeen[student.studentId] = true;
        roster.push(student);
      }
    }
  }

  roster.sort(sortStudents);

  var result = { success: true, students: roster };
  // ScriptCache TTL max ~ 21600 seconds (6h)
  cache.put(cacheKey, JSON.stringify(result), 60 * 60 * 6);
  return result;
}

function getAllStudents() {
  // CacheService for all students (6h)
  var cache = CacheService.getScriptCache();
  var cacheKey = "getAllStudents";
  var cached = cache.get(cacheKey);
  if (cached) {
    var parsed = JSON.parse(cached);
    return parsed;
  }

  var roster = [];
  var rosterSeen = {};

  for (var c = 0; c < CLASSROOMS.length; c++) {
    var classroom = CLASSROOMS[c];
    var sheet = getClassroomSheet(classroom, false);
    if (!sheet) continue;

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!hasStudentIdentity(row)) continue;

      var student = toStudent(row, classroom);
      if (!student.studentId || !student.name) continue;
      student.classroom = classroom;

      if (isRosterRow(row)) {
        // stable unique key: classroom + studentId
        var key = classroom + ":" + String(student.studentId);
        if (!rosterSeen[key]) {
          rosterSeen[key] = true;
          roster.push(student);
        }
      }
    }
  }

  roster.sort(function (a, b) {
    var cls = String(a.classroom || "").localeCompare(String(b.classroom || ""), "en", { numeric: true });
    if (cls !== 0) return cls;
    return sortStudents(a, b);
  });

  var result = { success: true, students: roster };
  cache.put(cacheKey, JSON.stringify(result), 60 * 60 * 6);
  return result;
}


function saveStudents(classroom, students) {
  if (!classroom) {
    throw new Error("Classroom is required for saveStudents");
  }
  if (!Array.isArray(students)) {
    throw new Error("Students must be an array");
  }

  var sheet = getOrCreateClassroomSheet(classroom);
  ensureHeaderRow(sheet);

  var attendanceRows = [];
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (isAttendanceRow(row)) {
      attendanceRows.push(normalizeAttendanceRow(row, classroom));
    }
  }

  var rosterRows = students
    .filter(function (student) {
      return student && String(student.studentId || "").trim() && String(student.name || "").trim();
    })
    .map(function (student) {
      return [
        "",
        String(student.studentId).trim(),
        student.number !== undefined && student.number !== null && String(student.number).trim() !== ""
          ? Number(student.number)
          : "",
        String(student.name).trim(),
        classroom,
        "",
        "",
        "",
        ""
      ];
    });

  writeSheetRows(sheet, rosterRows.concat(attendanceRows));

  return { success: true, count: rosterRows.length };
}

function deleteStudent(classroom, studentId) {
  if (!classroom || !studentId) {
    throw new Error("Classroom and Student ID are required for deleteStudent");
  }

  var sheet = getClassroomSheet(classroom, false);
  if (!sheet) {
    return { success: false, error: "Classroom sheet not found" };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, message: "No data to delete" };
  }

  var remaining = [];
  var removed = false;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (isRosterRow(row) && String(row[1]).trim() === String(studentId).trim()) {
      removed = true;
      continue;
    }
    remaining.push(isAttendanceRow(row) ? normalizeAttendanceRow(row, classroom) : rowToRaw(row, classroom));
  }

  if (!removed) {
    return { success: false, error: "Student ID " + studentId + " not found in classroom " + classroom };
  }

  writeSheetRows(sheet, remaining);
  return { success: true, message: "Deleted student ID: " + studentId };
}

function saveAttendance(classroom, date, attendanceList) {
  if (!classroom || !date) {
    throw new Error("Classroom and Date are required for saveAttendance");
  }
  if (!Array.isArray(attendanceList)) {
    throw new Error("Attendance list must be an array");
  }

  var sheet = getOrCreateClassroomSheet(classroom);
  ensureHeaderRow(sheet);

  var data = sheet.getDataRange().getValues();
  var retainedRows = [];
  var attendanceDate = buildDateValue(date);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (isAttendanceRow(row) && formatDateCell(row[0]) === String(date).trim()) {
      continue;
    }

    if (isAttendanceRow(row)) {
      retainedRows.push(normalizeAttendanceRow(row, classroom));
    } else if (isRosterRow(row)) {
      retainedRows.push(rowToRaw(row, classroom));
    }
  }

  var timestamp = new Date();
  var newRows = attendanceList
    .filter(function (item) {
      return item && String(item.studentId || "").trim();
    })
    .map(function (item) {
      var status = normalizeStatus(item.status);
      var statusValues = ["", "", "", ""];
      if (status) {
        var idx = STATUS_HEADERS.indexOf(status);
        if (idx >= 0) {
          statusValues[idx] = status;
        }
      }

      return [
        attendanceDate,
        String(item.studentId).trim(),
        item.number !== undefined && item.number !== null && String(item.number).trim() !== ""
          ? Number(item.number)
          : "",
        String(item.studentName || item.name || "").trim(),
        classroom,
        statusValues[0],
        statusValues[1],
        statusValues[2],
        statusValues[3]
      ];
    });

  // Prefer roster order if the list already exists in the sheet.
  var rosterOrder = getRosterOrderMap(data);
  newRows.sort(function (a, b) {
    var aNumber = rosterOrder[a[1]];
    var bNumber = rosterOrder[b[1]];

    if (aNumber !== undefined && bNumber !== undefined) {
      return aNumber - bNumber;
    }
    if (aNumber !== undefined) return -1;
    if (bNumber !== undefined) return 1;
    return String(a[1]).localeCompare(String(b[1]), "en", { numeric: true });
  });

  writeSheetRows(sheet, retainedRows.concat(newRows));

  return { success: true, count: newRows.length, date: date };
}

function getAttendance(classroom, date) {
  var sheets = getAttendanceSheets(classroom);
  var result = [];

  sheets.forEach(function (sheet) {
    var classroomName = sheetNameToClassroom(sheet.getName());
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!isAttendanceRow(row)) {
        continue;
      }

      var rowDate = formatDateCell(row[0]);
      if (date && rowDate !== String(date).trim()) {
        continue;
      }

      var status = statusFromRow(row);
      result.push({
        classroom: classroomName || classroom,
        date: rowDate,
        studentId: String(row[1]).trim(),
        studentName: String(row[3] || "").trim(),
        status: status,
        timestamp: row[0] instanceof Date ? row[0].toISOString() : undefined
      });
    }
  });

  result.sort(function (a, b) {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.classroom !== b.classroom) return a.classroom.localeCompare(b.classroom, "en", { numeric: true });
    return String(a.studentId).localeCompare(String(b.studentId), "en", { numeric: true });
  });

  return { success: true, attendance: result };
}

function getAttendanceSheets(classroom) {
  var ss = getSpreadsheet();

  if (classroom) {
    var sheet = getClassroomSheet(classroom, false);
    return sheet ? [sheet] : [];
  }

  return ss.getSheets().filter(function (sheet) {
    return sheetNameToClassroom(sheet.getName()) !== null;
  });
}

function getClassroomSheet(classroom, createIfMissing) {
  if (createIfMissing === undefined) {
    createIfMissing = true;
  }

  var ss = getSpreadsheet();
  var sheetName = classroomToSheetName(classroom);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet && createIfMissing) {
    sheet = ss.insertSheet(sheetName);
    ensureHeaderRow(sheet);
  }

  if (sheet) {
    ensureHeaderRow(sheet);
  }

  return sheet;
}

function getOrCreateClassroomSheet(classroom) {
  return getClassroomSheet(classroom, true);
}

function ensureHeaderRow(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight("bold");
    return;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
  var normalizedCurrent = currentHeaders.map(function (value) {
    return String(value || "").trim();
  });

  var matches = true;
  for (var i = 0; i < SHEET_HEADERS.length; i++) {
    if (normalizedCurrent[i] !== SHEET_HEADERS[i]) {
      matches = false;
      break;
    }
  }

  if (!matches) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight("bold");
  }
}

function writeSheetRows(sheet, rows) {
  ensureHeaderRow(sheet);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).clearContent();
  }

  if (!rows || rows.length === 0) {
    return;
  }

  sheet.getRange(2, 1, rows.length, SHEET_HEADERS.length).setValues(rows);
  sheet.getRange(2, 1, rows.length, 1).setNumberFormat("dd/MM/yyyy");
}

function rowToRaw(row, classroom) {
  return [
    row[0] || "",
    String(row[1] || "").trim(),
    row[2] !== null && row[2] !== undefined && String(row[2]).trim() !== "" ? Number(row[2]) : "",
    String(row[3] || "").trim(),
    row[4] || classroom,
    row[5] || "",
    row[6] || "",
    row[7] || "",
    row[8] || ""
  ];
}

function normalizeAttendanceRow(row, classroom) {
  var status = statusFromRow(row);
  var statusValues = ["", "", "", ""];
  if (status) {
    var idx = STATUS_HEADERS.indexOf(status);
    if (idx >= 0) {
      statusValues[idx] = status;
    }
  }

  return [
    row[0] || buildDateValue(formatDateCell(row[0])),
    String(row[1] || "").trim(),
    row[2] !== null && row[2] !== undefined && String(row[2]).trim() !== "" ? Number(row[2]) : "",
    String(row[3] || "").trim(),
    row[4] || classroom,
    statusValues[0],
    statusValues[1],
    statusValues[2],
    statusValues[3]
  ];
}

function isRosterRow(row) {
  if (!row || row.length < 4) return false;
  return !formatDateCell(row[0]) &&
    String(row[1] || "").trim() &&
    String(row[3] || "").trim() &&
    !rowHasStatus(row);
}

function isAttendanceRow(row) {
  if (!row) return false;
  return !!formatDateCell(row[0]) && !!String(row[1] || "").trim() && !!String(row[3] || "").trim();
}

function rowHasStatus(row) {
  for (var i = 5; i <= 8; i++) {
    if (String(row[i] || "").trim()) return true;
  }
  return false;
}

function hasStudentIdentity(row) {
  return !!String(row && row[1] || "").trim() || !!String(row && row[3] || "").trim();
}

function statusFromRow(row) {
  for (var i = 5; i <= 8; i++) {
    var value = String(row[i] || "").trim();
    if (!value) continue;

    var header = STATUS_HEADERS[i - 5];
    if (value === header || value === "1" || value === "✓" || value === "TRUE") {
      return header;
    }
    // If the cell already contains the Thai status text, accept it.
    if (STATUS_HEADERS.indexOf(value) >= 0) {
      return value;
    }
    return header;
  }
  return "";
}

function normalizeStatus(status) {
  var text = String(status || "").trim();
  return STATUS_HEADERS.indexOf(text) >= 0 ? text : "";
}

function formatDateCell(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, TIME_ZONE, "yyyy-MM-dd");
  }
  return String(value).trim();
}

function buildDateValue(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value;
  }

  var text = String(value).trim();
  if (!text) return "";

  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }

  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return text;
}

function classroomToSheetName(classroom) {
  var text = String(classroom || "").trim();
  if (!text) return text;

  if (/^\d{2}$/.test(text)) {
    return text;
  }

  var match = text.match(/^([2-6])\s*\/\s*([1-5])$/);
  if (match) {
    return match[1] + match[2];
  }

  var digits = text.replace(/\D/g, "");
  if (digits.length === 2) {
    return digits;
  }

  return text;
}

function sheetNameToClassroom(sheetName) {
  var name = String(sheetName || "").trim();
  if (!name) return null;

  if (/^[2-6][1-5]$/.test(name)) {
    return name.charAt(0) + "/" + name.charAt(1);
  }

  var match = name.match(/^([2-6])\s*\/\s*([1-5])$/);
  if (match) {
    return match[1] + "/" + match[2];
  }

  return null;
}

function sortStudents(a, b) {
  var aNumber = Number(a.number || 0);
  var bNumber = Number(b.number || 0);

  if (aNumber !== bNumber) return aNumber - bNumber;
  return String(a.studentId || "").localeCompare(String(b.studentId || ""), "en", { numeric: true });
}

function toStudent(row, classroom) {
  return {
    studentId: String(row[1] || "").trim(),
    name: String(row[3] || "").trim(),
    number: row[2] !== null && row[2] !== undefined && String(row[2]).trim() !== ""
      ? Number(row[2])
      : 0,
    classroom: normalizeClassroomValue(row[4], classroom)
  };
}

function getRosterOrderMap(data) {
  var map = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!isRosterRow(row)) {
      continue;
    }

    var sid = String(row[1] || "").trim();
    if (!sid) continue;

    var number = row[2] !== null && row[2] !== undefined && String(row[2]).trim() !== ""
      ? Number(row[2])
      : i;
    map[sid] = Number.isFinite(number) ? number : i;
  }

  return map;
}

function getSpreadsheet() {
  if (!SPREADSHEET_ID) {
    throw new Error("SPREADSHEET_ID is not configured");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function normalizeClassroomValue(value, fallbackClassroom) {
  var text = String(value || "").trim();
  if (/^[2-6]\/[1-5]$/.test(text)) {
    return text;
  }
  return fallbackClassroom || text;
}
