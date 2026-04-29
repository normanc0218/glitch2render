// This is the function for exporting firebase data into google sheets, it is not used in the main app
function exportFirebaseToSheets() {
  const sheetId = "1ly2FufJuZzb5b2VewVK7gOdNKTMGus16gs3QXFj-C00";
  const ss = SpreadsheetApp.openById(sheetId);

  if (!ss) {
    throw new Error("❌ Cannot open spreadsheet. Check the Sheet ID.");
  }

  const firebaseUrl = "https://maintenance-form-602d9-default-rtdb.firebaseio.com";
  const endpoint = firebaseUrl + "/jobs.json";

  let response, jobs;
  
  try {
    response = UrlFetchApp.fetch(endpoint, {
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Firebase API error: ${response.getResponseCode()}`);
    }
    
    jobs = JSON.parse(response.getContentText()) || {};
  } catch (error) {
    Logger.log(`❌ Error fetching Firebase data: ${error.message}`);
    throw error;
  }

  if (!jobs || typeof jobs !== "object") {
    Logger.log("❌ Firebase returned null / empty / invalid JSON");
    return;
  }

  // 1. Dispatch
  writeCategoryToSheet(ss, "Dispatch", jobs.Dispatch || {}, null);

  // 2. Release: merge Project/Regular/Daily
  const releaseData = {};

  if (jobs.Release) {
    ["Project", "Regular", "Daily"].forEach(cat => {
      if (jobs.Release[cat]) {
        Object.keys(jobs.Release[cat]).forEach(jobId => {
          const row = { ...jobs.Release[cat][jobId] };
          row.releaseCategory = cat;
          releaseData[jobId] = row;
        });
      }
    });
  }

  writeCategoryToSheet(ss, "Release", releaseData, "releaseCategory");

  // 3. Train
  writeCategoryToSheet(ss, "Train", jobs.Train || {}, null);

  Logger.log("✅ Export Completed Successfully");
}


/**
 * Convert arrays and objects to readable strings
 */
function formatValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    // For image URLs or file paths
    if (value.length > 0 && typeof value[0] === 'string' && 
        (value[0].includes('http') || value[0].includes('/'))) {
      return value.join('\n'); // Each URL on new line
    }
    // For other arrays
    return value.join(', ');
  }
  
  // Handle objects
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  
  // Handle numbers and strings
  return String(value);
}


/**
 * Write / Update category sheet with proper column alignment
 */
function writeCategoryToSheet(ss, sheetName, jsonData, releaseCategoryField) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Get all headers from new data
  const newHeaders = getAllHeaders(jsonData);
  
  // Ensure releaseCategory is in headers if needed
  if (releaseCategoryField && !newHeaders.includes(releaseCategoryField)) {
    newHeaders.push(releaseCategoryField);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  let headers = [];
  let colIndex = {};

  // If sheet is empty, initialize with headers
  if (lastRow === 0) {
    headers = newHeaders;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    headers.forEach((h, i) => colIndex[h] = i + 1);
  } else {
    // Get existing headers
    const existingHeaderRange = sheet.getRange(1, 1, 1, lastCol);
    const existingHeaders = existingHeaderRange.getValues()[0];
    
    // Build column index from existing headers
    existingHeaders.forEach((h, i) => {
      if (h) {
        headers.push(h);
        colIndex[h] = i + 1;
      }
    });

    // Find new headers that don't exist yet
    const headersToAdd = newHeaders.filter(h => !colIndex[h]);
    
    if (headersToAdd.length > 0) {
      // Add new headers to the right
      const startCol = headers.length + 1;
      sheet.getRange(1, startCol, 1, headersToAdd.length).setValues([headersToAdd]);
      
      // Update headers array and colIndex
      headersToAdd.forEach((h, i) => {
        headers.push(h);
        colIndex[h] = startCol + i;
      });
      
      Logger.log(`Added ${headersToAdd.length} new columns: ${headersToAdd.join(', ')}`);
    }
  }

  // Build jobId index map from existing data
  const jobIdMap = {};
  const jobIdCol = colIndex["jobId"];
  
  if (jobIdCol && lastRow > 1) {
    const existingJobIds = sheet.getRange(2, jobIdCol, lastRow - 1, 1).getValues();
    existingJobIds.forEach((row, index) => {
      if (row[0]) {
        jobIdMap[row[0]] = index + 2;
      }
    });
  }

  // Process each job
  Object.keys(jsonData).forEach(jobId => {
    const obj = { ...jsonData[jobId] };
    obj.jobId = jobId;

    if (jobIdMap[jobId]) {
      // Update existing row - write each cell individually
      const rowNum = jobIdMap[jobId];
      
      Object.keys(obj).forEach(key => {
        if (colIndex[key]) {
          const formattedValue = formatValue(obj[key]);
          sheet.getRange(rowNum, colIndex[key]).setValue(formattedValue);
        }
      });
      
    } else {
      // Append new row - must align with all headers
      const rowValues = headers.map(h => {
        const val = obj[h];
        return formatValue(val);
      });
      
      sheet.appendRow(rowValues);
    }
  });

  Logger.log(`✅ ${sheetName}: Processed ${Object.keys(jsonData).length} jobs`);
}


/**
 * Collect all unique keys from JSON data
 */
function getAllHeaders(jsonData) {
  const keys = new Set(["jobId"]);
  Object.values(jsonData).forEach(obj => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(k => keys.add(k));
    }
  });
  return Array.from(keys);
}


/**
 * Optional: Remove jobs from sheets that no longer exist in Firebase
 */
function cleanupDeletedJobs() {
  const sheetId = "1ly2FufJuZzb5b2VewVK7gOdNKTMGus16gs3QXFj-C00";
  const ss = SpreadsheetApp.openById(sheetId);
  const firebaseUrl = "https://maintenance-form-602d9-default-rtdb.firebaseio.com";
  
  try {
    const response = UrlFetchApp.fetch(firebaseUrl + "/jobs.json");
    const jobs = JSON.parse(response.getContentText()) || {};
    
    ["Dispatch", "Release", "Train"].forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;
      
      const validJobIds = new Set();
      
      if (sheetName === "Release" && jobs.Release) {
        ["Project", "Regular", "Daily"].forEach(cat => {
          if (jobs.Release[cat]) {
            Object.keys(jobs.Release[cat]).forEach(id => validJobIds.add(id));
          }
        });
      } else if (jobs[sheetName]) {
        Object.keys(jobs[sheetName]).forEach(id => validJobIds.add(id));
      }
      
      const data = sheet.getDataRange().getValues();
      const jobIdColIndex = data[0].indexOf("jobId");
      
      if (jobIdColIndex === -1) return;
      
      let deletedCount = 0;
      
      // Delete from bottom to top to avoid index shifting
      for (let i = data.length - 1; i >= 1; i--) {
        const jobId = data[i][jobIdColIndex];
        if (jobId && !validJobIds.has(jobId)) {
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        Logger.log(`🗑️ ${sheetName}: Deleted ${deletedCount} obsolete rows`);
      }
    });
    
    Logger.log("✅ Cleanup completed");
  } catch (error) {
    Logger.log(`❌ Cleanup error: ${error.message}`);
  }
}
