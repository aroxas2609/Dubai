require('dotenv').config({ path: __dirname + '/.env' });
console.log('Loaded .env from:', process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const express = require('express');
const basicAuth = require('basic-auth');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { Dropbox } = require('dropbox');
const app = express();
const PORT = process.env.PORT || 3002;

// CORS for frontend
app.use(cors());

// Parse JSON bodies with increased size limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  console.log('=== TEST ENDPOINT CALLED ===');
  res.json({ 
    message: 'Server is working', 
    timestamp: new Date().toISOString(),
    version: '1.0.1',
    debug: 'Debug endpoints are loaded'
  });
});

// Test Dropbox token endpoint
app.get('/api/test-dropbox', async (req, res) => {
  console.log('=== TEST DROPBOX TOKEN ===');
  try {
    const dbx = getDropboxClient();
    
    // Test a simple API call to verify the token works
    const accountInfo = await dbx.usersGetCurrentAccount();
    console.log('Dropbox account info:', accountInfo.result);
    
    res.json({ 
      success: true, 
      message: 'Dropbox token is valid',
      account: accountInfo.result
    });
  } catch (error) {
    console.error('Dropbox token test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Dropbox token test failed',
      details: error.message,
      status: error.status
    });
  }
});

// Performance Optimization: Caching System
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const HEADERS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes (headers rarely change)

function getCacheKey(type, identifier = '') {
  return `${type}:${identifier}`;
}

function isCacheValid(key) {
  const cached = cache.get(key);
  if (!cached) return false;
  
  const ttl = key.startsWith('headers') ? HEADERS_CACHE_TTL : CACHE_TTL;
  return Date.now() - cached.timestamp < ttl;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

function getCache(key) {
  if (!isCacheValid(key)) {
    cache.delete(key);
    return null;
  }
  return cache.get(key).data;
}

function invalidateCache(pattern) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// User roles and permissions
const USERS = {
  'Dubaiadm': {
    password: 'Admin2025',
    role: 'admin',
    permissions: ['view', 'add', 'edit', 'delete']
  },
  'Dubai2025': {
    password: 'Desert',
    role: 'viewer',
    permissions: ['view']
  }
};

// Basic Auth Middleware
const auth = (req, res, next) => {
  const user = basicAuth(req);
  console.log('Auth attempt:', user);
  console.log('Available users:', Object.keys(USERS));
  
  if (!user) {
    res.set('WWW-Authenticate', 'Basic realm=\"Dubai Trip\"');
    return res.status(401).send('Authentication required.');
  }
  
  const userConfig = USERS[user.name];
  console.log('User config for', user.name, ':', userConfig);
  
  if (!userConfig || userConfig.password !== user.pass) {
    console.log('Authentication failed for', user.name);
    console.log('Expected password:', userConfig?.password);
    console.log('Provided password:', user.pass);
    res.set('WWW-Authenticate', 'Basic realm=\"Dubai Trip\"');
    return res.status(401).send('Invalid credentials.');
  }
  
  // Add user info to request for later use
  req.user = {
    username: user.name,
    role: userConfig.role,
    permissions: userConfig.permissions
  };
  
  console.log('Authenticated user:', req.user);
  next();
};

// Permission check middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userRole: req.user?.role
      });
    }
    next();
  };
};

// Google Sheets API setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = process.env.SHEET_ID;

console.log('Using sheet ID:', SHEET_ID);

function getSheetsClient() {
  let credentials;
  
  // Try to read from environment variable first (for production)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CONTENT) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CONTENT);
      console.log('Using service account from environment variable');
    } catch (parseError) {
      console.error('Error parsing service account from environment:', parseError.message);
      throw new Error('Invalid service account JSON in environment variable');
    }
  } else {
    // Fallback to file (for local development)
    try {
      const serviceAccountPath = path.join(__dirname, process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      console.log('Using service account from file');
    } catch (fileError) {
      console.error('Error reading service account file:', fileError.message);
      throw new Error('Service account file not found and no environment variable set');
    }
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
  return google.sheets({ version: 'v4', auth });
}

function getDropboxClient() {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  console.log('=== DROPBOX CLIENT DEBUG ===');
  console.log('Dropbox access token configured:', accessToken ? 'YES' : 'NO');
  console.log('Token length:', accessToken ? accessToken.length : 0);
  console.log('Token starts with:', accessToken ? accessToken.substring(0, 10) + '...' : 'N/A');
  console.log('Token ends with:', accessToken ? '...' + accessToken.substring(accessToken.length - 10) : 'N/A');
  console.log('Full token (first 50 chars):', accessToken ? accessToken.substring(0, 50) + '...' : 'N/A');
  
  if (!accessToken) {
    throw new Error('DROPBOX_ACCESS_TOKEN not configured');
  }
  
  try {
    const dbx = new Dropbox({ accessToken });
    console.log('Dropbox client created successfully');
    return dbx;
  } catch (error) {
    console.error('Error creating Dropbox client:', error);
    throw error;
  }
}

// Helper function to get sheet name from day number
function getSheetName(dayNumber) {
  return `DAY ${dayNumber}`;
}

// Helper function to extract day number from sheet name
function extractDayNumber(sheetName) {
  const match = sheetName.match(/DAY (\d+)/i);
  return match ? parseInt(match[1]) : null;
}

// Helper function to compare times
function compareTimes(time1, time2) {
  // Convert times to minutes for comparison
  const getMinutes = (timeStr) => {
    const time = timeStr.trim().toLowerCase();
    let hours = 0;
    let minutes = 0;
    
    // Handle various time formats
    if (time.includes('am') || time.includes('pm')) {
      const match = time.match(/(\d+):?(\d*)\s*(am|pm)/);
      if (match) {
        hours = parseInt(match[1]);
        minutes = match[2] ? parseInt(match[2]) : 0;
        if (match[3] === 'pm' && hours !== 12) hours += 12;
        if (match[3] === 'am' && hours === 12) hours = 0;
      }
    } else {
      // Handle 24-hour format
      const match = time.match(/(\d+):?(\d*)/);
      if (match) {
        hours = parseInt(match[1]);
        minutes = match[2] ? parseInt(match[2]) : 0;
      }
    }
    
    return hours * 60 + minutes;
  };
  
  return getMinutes(time1) - getMinutes(time2);
}

// Helper function to get sheet ID by name
async function getSheetId(sheetName) {
  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });
  
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found`);
  }
  
  return sheet.properties.sheetId;
}

// Add rate limiting helper function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Performance Optimization: Reduced rate limiting delays
const rateLimitedSheetsCall = async (callFunction, delayMs = 100) => {
    try {
        const result = await callFunction();
        await delay(delayMs); // Reduced from 300ms to 100ms
        return result;
    } catch (error) {
        if (error.message.includes('Quota exceeded') || error.code === 429) {
            console.log('Rate limit hit, waiting 2 seconds before retry...');
            await delay(2000); // Reduced from 3000ms to 2000ms
            try {
                return await callFunction(); // Retry once
            } catch (retryError) {
                if (retryError.message.includes('Quota exceeded') || retryError.code === 429) {
                    console.log('Rate limit hit again, waiting 5 seconds...');
                    await delay(5000); // Reduced from 8000ms to 5000ms
                    return await callFunction(); // Final retry
                }
                throw retryError;
            }
        }
        throw error;
    }
};

// Performance Optimization: Cached headers fetching
async function getCachedHeaders() {
  const cacheKey = getCacheKey('headers');
  let headersData = getCache(cacheKey);
  
  if (!headersData) {
    console.log('Headers not in cache, fetching from sheet...');
    const sheets = getSheetsClient();
    try {
      const headersResponse = await rateLimitedSheetsCall(() => 
        sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Headers',
        })
      );
      
      headersData = headersResponse.data.values || [];
      setCache(cacheKey, headersData);
      console.log(`Fetched and cached ${headersData.length} header rows`);
    } catch (error) {
      console.log(`Headers sheet not found or empty, using default headers:`, error.message);
      headersData = [];
      setCache(cacheKey, headersData);
    }
  } else {
    console.log('Using cached headers data');
  }
  
  return headersData;
}

// Performance Optimization: Cached day data fetching
async function getCachedDayData(dayNumber) {
  const cacheKey = getCacheKey('day', dayNumber);
  let dayData = getCache(cacheKey);
  
  if (!dayData) {
    console.log(`Day ${dayNumber} not in cache, fetching from sheet...`);
    const sheets = getSheetsClient();
    const sheetName = getSheetName(dayNumber);
    
    try {
      const response = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: sheetName,
        })
      );
      
      dayData = response.data.values || [];
      setCache(cacheKey, dayData);
      console.log(`Fetched and cached ${dayData.length} rows from ${sheetName}`);
    } catch (error) {
      console.error(`Error fetching data from ${sheetName}:`, error.message);
      dayData = [];
      setCache(cacheKey, dayData);
    }
  } else {
    console.log(`Using cached data for Day ${dayNumber}`);
  }
  
  return dayData;
}

// Test endpoint to check environment variables
app.get('/api/test', (req, res) => {
  res.json({
    sheetId: SHEET_ID ? 'Set' : 'Missing',
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? 'Set' : 'Missing',
    serviceAccountContent: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CONTENT ? 'Set' : 'Missing',
    port: PORT
  });
});

// User info endpoint - moved here to ensure it's not caught by catch-all
app.get('/api/user-info', auth, (req, res) => {
  console.log('=== USER-INFO ENDPOINT CALLED ===');
  console.log('User:', req.user);
  res.json({
    username: req.user.username,
    role: req.user.role,
    permissions: req.user.permissions
  });
});

// Temporary endpoint to list all sheets
app.get('/api/sheets', auth, async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    
    const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);
    console.log('Available sheets:', sheetNames);
    
    res.json({
      availableSheets: sheetNames,
      totalSheets: sheetNames.length
    });
  } catch (error) {
    console.error('Error fetching sheets:', error);
    res.status(500).json({ error: 'Failed to fetch sheets' });
  }
});

// Performance Optimization: Get all itinerary data with caching
app.get('/api/itinerary', auth, async (req, res) => {
  try {
    const allData = [];
    
    // Get cached headers
    const headersData = await getCachedHeaders();
    
    // Create a map of day numbers to their header info
    const dayHeaders = {};
    headersData.forEach(row => {
      if (row && row.length >= 3) {
        const dayMatch = row[1] ? row[1].match(/Day (\d+)/) : null;
        if (dayMatch) {
          const dayNumber = parseInt(dayMatch[1]);
          dayHeaders[dayNumber] = {
            date: row[0] || '',
            day: row[1] || '',
            title: row[2] || ''
          };
        }
      }
    });
    
    // If no headers found, create default headers for each day
    if (Object.keys(dayHeaders).length === 0) {
      console.log('No headers found in Headers sheet, creating default headers');
      for (let day = 1; day <= 10; day++) {
        dayHeaders[day] = {
          date: '',
          day: `Day ${day}`,
          title: ''
        };
      }
    }
    
    console.log(`Processed ${Object.keys(dayHeaders).length} day headers`);
    
    // Performance Optimization: Fetch data from all 10 day sheets in parallel with caching
    console.log('Fetching data from all day sheets in parallel with caching...');
    const dayPromises = [];
    
    for (let day = 1; day <= 10; day++) {
      const promise = getCachedDayData(day).then(values => ({
        day,
        sheetName: getSheetName(day),
        values,
        success: true
      })).catch(error => ({
        day,
        sheetName: getSheetName(day),
        values: [],
        success: false,
        error: error.message
      }));
      
      dayPromises.push(promise);
    }
    
    // Wait for all day sheets to be fetched
    const dayResults = await Promise.all(dayPromises);
    
    // Process the results in order
    dayResults.forEach(result => {
      if (result.success) {
        console.log(`Processed ${result.values.length} rows from ${result.sheetName}`);
        
        if (result.values.length > 0) {
          // Get the header info for this day
          const headerInfo = dayHeaders[result.day] || { date: '', day: `Day ${result.day}`, title: '' };
          
          // First, add a day header row if we have header info
          if (headerInfo.date || headerInfo.day || headerInfo.title) {
            const dayHeaderRow = [
              headerInfo.date,
              headerInfo.day,
              headerInfo.title,
              '', // Time
              '', // Activity
              '', // Notes
              '', // Cost
              ''  // Link
            ];
            allData.push(dayHeaderRow);
          }
          
          // Then add each activity row with empty header fields
          result.values.forEach(row => {
            if (row && row.length > 0) {
              // Check visibility for viewer users
              const isVisible = row[5] !== 'false' && row[5] !== false; // Column 5 (index 5) is visibility
              const user = basicAuth(req);
              const userConfig = USERS[user.name];
              const isViewer = userConfig && userConfig.permissions && !userConfig.permissions.includes('edit');
              
              // Skip hidden activities for viewer users
              if (isViewer && !isVisible) {
                return;
              }
              
              // Create activity row with empty header fields: [Date, Day, Title, Time, Activity, Notes, Cost, Link, Visibility, Image]
              const activityRow = [
                '', // Empty Date (will be filled by the day header)
                '', // Empty Day (will be filled by the day header)
                '', // Empty Title (will be filled by the day header)
                row[0] || '', // Time
                row[1] || '', // Activity
                row[2] || '', // Notes
                row[3] || '', // Cost
                row[4] || '', // Link
                row[5] || 'true', // Visibility (default to true if not set)
                row[6] || '' // Image URL
              ];
              allData.push(activityRow);
            }
          });
        }
      } else {
        console.error(`Error processing data from ${result.sheetName}:`, result.error);
      }
    });
    
    console.log(`Combined ${allData.length} total rows from all sheets`);
    
    res.json(allData);
  } catch (error) {
    console.error('Error fetching itinerary data:', error);
    res.status(500).json({ error: 'Failed to fetch itinerary data' });
  }
});

// Performance Optimization: Add new activity with minimal response
app.post('/api/itinerary/add', auth, requirePermission('add'), async (req, res) => {
  try {
    const { day, time, activity, notes, cost, link, image } = req.body;
    
    if (!day || !time || !activity) {
      return res.status(400).json({ error: 'Day, time, and activity are required' });
    }
    
    const dayNumber = parseInt(day.replace(/\D/g, ''));
    if (dayNumber < 1 || dayNumber > 10) {
      return res.status(400).json({ error: 'Day must be between 1 and 10' });
    }
    
    const sheetName = getSheetName(dayNumber);
    const sheets = getSheetsClient();
    
    console.log(`Adding activity to ${sheetName}:`, { time, activity, notes, cost, link });
    
    // Get current data from the day sheet (use cache if available)
    const values = await getCachedDayData(dayNumber);
    console.log(`Current data in ${sheetName}:`, values);
    
    // Prepare the new row data for the new structure (Time, Activity, Notes, Cost, Link, Visibility, Image)
    const newRow = [
      time || '',
      activity,
      notes || '',
      cost || '',
      link || '',
      'true', // Default to visible for new activities
      image || '' // Use provided image URL or empty string
    ];
    
    // Find the correct position to insert based on time
    let insertRowIndex = 1; // Default to after header row
    
    // Skip header row if it exists
    if (values.length > 0 && values[0] && values[0][0] === 'Date') {
      insertRowIndex = 1; // Start after header
    } else {
      insertRowIndex = 0; // Start from beginning if no header
    }
    
    console.log(`Starting time comparison for "${time}" in ${sheetName}`);
    console.log(`Initial insertRowIndex: ${insertRowIndex}`);
    console.log(`Total rows in sheet: ${values.length}`);
    
    // Find the correct position by comparing times
    // Skip day header rows (rows that have a date in column 0 and day in column 1)
    let dayHeaderCount = 0; // Track how many day headers we've seen
    for (let i = insertRowIndex; i < values.length; i++) {
      const row = values[i];
      
      // Skip day header rows - these should never move
      if (row && row.length > 1 && row[0] && row[1] && 
          row[0].match(/\d{2}\/\d{2}\/\d{4}/) && row[1].match(/Day \d+/)) {
        console.log(`Skipping day header row at index ${i}: ${row[0]} ${row[1]}`);
        dayHeaderCount++;
        continue;
      }
      
      // Skip column header rows
      if (row && row.length > 0 && row[0] === 'Date') {
        console.log(`Skipping column header row at index ${i}`);
        continue;
      }
      
      if (row && row.length > 0) {
        const existingTime = row[0]; // Time is now in column 0 (index 0)
        if (existingTime && existingTime.trim()) {
          console.log(`Comparing new time "${time}" with existing time "${existingTime}" at row ${i}`);
          // Compare times
          const comparison = compareTimes(time, existingTime);
          console.log(`Time comparison result: ${comparison}`);
          if (comparison <= 0) {
            // Adjust insertRowIndex to account for day headers we've skipped
            insertRowIndex = i - dayHeaderCount;
            console.log(`Found insertion point at row ${i}, adjusted to ${insertRowIndex} (accounting for ${dayHeaderCount} day headers)`);
            break;
          }
        }
      }
      insertRowIndex = i + 1 - dayHeaderCount; // If we reach the end, insert at the end
    }
    
    console.log(`Final insertRowIndex: ${insertRowIndex}`);
    console.log(`Inserting new activity at row ${insertRowIndex + 1} in ${sheetName}`);
    
    try {
      // Get the sheet ID first
      const sheetId = await getSheetId(sheetName);
      console.log(`Got sheet ID: ${sheetId} for sheet: ${sheetName}`);
      
      // Insert the new row at the correct position
      const insertResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: insertRowIndex,
                  endIndex: insertRowIndex + 1
                },
                inheritFromBefore: false
              }
            }
          ]
        }
      });
      
      console.log(`Row inserted successfully, now updating with data`);
      
      // Now update the inserted row with the new data
      // Use USER_ENTERED to preserve the original time format
      const updateResponse = await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A${insertRowIndex + 1}:G${insertRowIndex + 1}`,
        valueInputOption: 'USER_ENTERED', // Changed from RAW to USER_ENTERED
        resource: {
          values: [newRow]
        }
      });
      
      console.log(`Update response:`, updateResponse.data);
      
    } catch (insertError) {
      console.error('Error during insertion:', insertError);
      
      // Fallback: append to the end if insertion fails
      console.log('Falling back to append method');
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [newRow]
        }
      });
      
      console.log(`Appended activity to end of sheet:`, appendResponse.data);
    }
    
    // Performance Optimization: Invalidate cache for this day only
    invalidateCache(`day:${dayNumber}`);
    
    // Performance Optimization: Return minimal response without refetching entire itinerary
    res.json({
      success: true,
      message: 'Activity added successfully',
      updatedRange: `${sheetName}!A${insertRowIndex + 1}:G${insertRowIndex + 1}`,
      day: dayNumber,
      newActivity: { time, activity, notes, cost, link }
    });
    
  } catch (error) {
    console.error('Error adding activity:', error);
    res.status(500).json({ error: 'Failed to add activity' });
  }
});

// Performance Optimization: Update existing activity with minimal response
app.put('/api/itinerary/update', auth, requirePermission('edit'), async (req, res) => {
  try {
    const { day, originalTime, originalActivity, time, activity, notes, cost, link } = req.body;
    
    if (!day || !originalTime || !originalActivity || !time || !activity) {
      return res.status(400).json({ 
        error: 'Day, original time, original activity, new time, and new activity are required' 
      });
    }
    
    console.log(`Updating activity in ${day}:`, { 
      originalTime, originalActivity, time, activity, notes, cost, link 
    });
    
    const dayNumber = parseInt(day.replace(/\D/g, ''));
    if (dayNumber < 1 || dayNumber > 10) {
      return res.status(400).json({ error: 'Day must be between 1 and 10' });
    }
    
    const sheetName = getSheetName(dayNumber);
    const sheets = getSheetsClient();
    
    // Performance Optimization: Invalidate cache BEFORE the update to prevent stale data
    console.log(`Invalidating cache for Day ${dayNumber} before update`);
    invalidateCache(`day:${dayNumber}`);
    
    // Get current data from the day sheet (will fetch fresh data since cache was invalidated)
    const values = await getCachedDayData(dayNumber);
    console.log(`Current data in ${sheetName}:`, values);
    
    // Find the row to update by matching original time and activity
    let targetRowIndex = -1;
    let headerOffset = 0;
    
    // Check if first row is a header row
    if (values.length > 0 && values[0] && values[0][0] === 'Date') {
      headerOffset = 1;
    }
    
    // Search for the matching activity
    for (let i = headerOffset; i < values.length; i++) {
      const row = values[i];
      if (row && row.length >= 2) {
        const rowTime = (row[0] || '').trim();
        const rowActivity = (row[1] || '').trim();
        
        console.log(`Checking row ${i}: time="${rowTime}", activity="${rowActivity}"`);
        console.log(`Looking for: time="${originalTime.trim()}", activity="${originalActivity.trim()}"`);
        
        if (rowTime === originalTime.trim() && rowActivity === originalActivity.trim()) {
          targetRowIndex = i;
          console.log(`Found matching activity at row ${i}`);
                break;
              }
      }
    }
    
    if (targetRowIndex === -1) {
      return res.status(404).json({ 
        error: 'Activity not found',
        details: `No activity found with time "${originalTime}" and activity "${originalActivity}" in ${day}`
      });
    }
    
    console.log(`Updating activity in ${sheetName} at row ${targetRowIndex + 1}:`, { time, activity, notes, cost, link, image: req.body.image });
    
    // Get the current row to preserve existing data structure
    const currentRow = values[targetRowIndex] || [];
    
    // Create the updated row data with correct column structure
    const updatedRow = [
      time, // Column A: Time
      activity, // Column B: Activity  
      notes || '', // Column C: Notes
      cost || '', // Column D: Cost
      link || '', // Column E: Link
      currentRow[5] || 'true', // Column F: Visibility (preserve existing)
      req.body.image || '' // Column G: Image URL
    ];
    
    try {
      const updateResponse = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${sheetName}!A${targetRowIndex + 1}:${String.fromCharCode(65 + updatedRow.length - 1)}${targetRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [updatedRow]
          }
        })
      );
      
      console.log(`Successfully updated activity in ${sheetName}:`, updateResponse.data);
      
      // Performance Optimization: Invalidate cache again after successful update
      console.log(`Invalidating cache for Day ${dayNumber} after successful update`);
      invalidateCache(`day:${dayNumber}`);
      
      // Performance Optimization: Return minimal response without refetching entire itinerary
      res.json({
        success: true,
        message: 'Activity updated successfully',
        updatedRange: updateResponse.data.updatedRange,
        day: dayNumber,
        updatedActivity: { time, activity, notes, cost, link },
        originalActivity: { time: originalTime, activity: originalActivity }
      });
    } catch (updateError) {
      console.error(`Error updating activity in ${sheetName}:`, updateError);
      if (updateError.message.includes('Quota exceeded')) {
        res.status(429).json({ error: 'Rate limit exceeded. Please try again in a few seconds.' });
      } else {
        res.status(500).json({ error: 'Failed to update activity' });
      }
    }
    
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Performance Optimization: Delete activity with minimal response
app.delete('/api/itinerary/delete', auth, requirePermission('delete'), async (req, res) => {
  console.log('\n🔥🔥🔥 DELETE ENDPOINT CALLED 🔥🔥🔥');
  console.log('Request body:', req.body);
  try {
    const { day, time, activity } = req.body;
    
    if (!day || !time || !activity) {
      return res.status(400).json({ error: 'Day, time, and activity are required' });
    }
    
    const dayNumber = parseInt(day.replace(/\D/g, ''));
    if (dayNumber < 1 || dayNumber > 10) {
      return res.status(400).json({ error: 'Day must be between 1 and 10' });
    }
    
    const sheetName = getSheetName(dayNumber);
    const sheets = getSheetsClient();
    
    console.log(`=== DELETE ACTIVITY DEBUG ===`);
    console.log(`Day: ${day}`);
    console.log(`Time: ${time}`);
    console.log(`Activity: ${activity}`);
    console.log(`Day number: ${dayNumber}`);
    console.log(`Sheet name: ${sheetName}`);
    console.log(`Deleting activity from ${sheetName} with time "${time}" and activity "${activity}"`);
    
    // Get the sheet metadata to find the correct sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) {
      return res.status(404).json({ error: `Sheet ${sheetName} not found` });
    }
    
    const sheetId = sheet.properties.sheetId;
    console.log(`Found sheet ID for ${sheetName}:`, sheetId);
    
    // Get the current data from the sheet (use cache if available)
    const values = await getCachedDayData(dayNumber);
    console.log(`Current data in ${sheetName}:`, values);
    
    // Find the row to delete by matching time and activity
    let targetRowIndex = -1;
    let headerOffset = 0;
    
    // Check if first row is a header row
    if (values.length > 0 && values[0] && values[0][0] === 'Date') {
      headerOffset = 1;
    }
    
    // Search for the matching activity
    for (let i = headerOffset; i < values.length; i++) {
      const row = values[i];
      if (row && row.length >= 2) {
        const rowTime = (row[0] || '').trim();
        const rowActivity = (row[1] || '').trim();
        
        console.log(`Checking row ${i}: time="${rowTime}", activity="${rowActivity}"`);
        console.log(`Looking for: time="${time.trim()}", activity="${activity.trim()}"`);
        
        if (rowTime === time.trim() && rowActivity === activity.trim()) {
          targetRowIndex = i;
          console.log(`Found matching activity at row ${i}`);
          break;
        }
      }
    }
    
    if (targetRowIndex === -1) {
      return res.status(404).json({ 
        error: 'Activity not found',
        details: `No activity found with time "${time}" and activity "${activity}" in ${day}`
      });
    }
    
    console.log(`Attempting to delete row with startIndex: ${targetRowIndex}, endIndex: ${targetRowIndex + 1}`);
    
    const deleteResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: targetRowIndex,
                endIndex: targetRowIndex + 1
              }
            }
          }
        ]
      }
    });
    
    console.log(`Successfully deleted activity from ${sheetName}:`, deleteResponse.data);
    console.log('🔥🔥🔥 DELETE OPERATION COMPLETED SUCCESSFULLY 🔥🔥🔥');
    
    // Performance Optimization: Invalidate cache for this day only
    invalidateCache(`day:${dayNumber}`);
    
    // Performance Optimization: Return minimal response without refetching entire itinerary
    res.json({
      success: true,
      message: 'Activity deleted successfully',
      day: dayNumber,
      deletedActivity: { time, activity }
    });
    
  } catch (error) {
    console.error('Error deleting activity:', error);
        
        // Check if it's a rate limit error
        if (error.message && error.message.includes('Quota exceeded') || error.code === 429) {
            return res.status(429).json({ 
                error: 'Rate limit exceeded. Please wait a moment and try again.',
                details: 'Google Sheets API rate limit reached'
            });
        }
    
    // Fallback: try to clear the row content instead of deleting
    try {
            const { day, time, activity } = req.body;
      const dayNumber = parseInt(day.replace(/\D/g, ''));
      const sheetName = getSheetName(dayNumber);
      const sheets = getSheetsClient();
      
      console.log(`=== FALLBACK CLEAR DEBUG ===`);
            console.log(`Fallback: Clearing row content in ${sheetName} with time "${time}" and activity "${activity}"`);
            
            // Get the current data to find the correct row for clearing (use cache if available)
            const values = await getCachedDayData(dayNumber);
            let targetRowIndex = -1;
            let headerOffset = 0;
            
            // Check if first row is a header row
      if (values.length > 0 && values[0] && values[0][0] === 'Date') {
                headerOffset = 1;
            }
            
            // Search for the matching activity
            for (let i = headerOffset; i < values.length; i++) {
                const row = values[i];
                if (row && row.length >= 2) {
                    const rowTime = (row[0] || '').trim();
                    const rowActivity = (row[1] || '').trim();
                    
                    if (rowTime === time.trim() && rowActivity === activity.trim()) {
                        targetRowIndex = i;
                        break;
                    }
                }
            }
            
            if (targetRowIndex === -1) {
                return res.status(404).json({ 
                    error: 'Activity not found for clearing',
                    details: `No activity found with time "${time}" and activity "${activity}" in ${day}`
                });
            }
            
      console.log(`Clear range: ${sheetName}!A${targetRowIndex + 1}:H${targetRowIndex + 1}`);
      
            const clearResponse = await rateLimitedSheetsCall(() =>
                sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A${targetRowIndex + 1}:H${targetRowIndex + 1}`,
                })
            );
      
      console.log(`Successfully cleared row content in ${sheetName}:`, clearResponse.data);
      console.log('🔥🔥🔥 FALLBACK CLEAR OPERATION COMPLETED 🔥🔥🔥');
      
            // Performance Optimization: Invalidate cache for this day only
            invalidateCache(`day:${dayNumber}`);
            
            // Performance Optimization: Return minimal response without refetching entire itinerary
      res.json({
        success: true,
                message: 'Activity cleared successfully (row deletion failed)',
                day: dayNumber,
                clearedActivity: { time, activity }
      });
    } catch (fallbackError) {
      console.error('Fallback clear also failed:', fallbackError);
            if (fallbackError.message && fallbackError.message.includes('Quota exceeded') || fallbackError.code === 429) {
                res.status(429).json({ 
                    error: 'Rate limit exceeded. Please wait a moment and try again.',
                    details: 'Google Sheets API rate limit reached'
                });
            } else {
      res.status(500).json({ error: 'Failed to delete activity' });
            }
    }
  }
});

// Activity visibility toggle endpoint
app.put('/api/itinerary/visibility', auth, requirePermission('edit'), async (req, res) => {
  console.log('=== VISIBILITY ENDPOINT CALLED ===');
  console.log('Request body:', req.body);
  try {
    const { day, time, activity, visible } = req.body;
    
    if (!day || !time || !activity || typeof visible !== 'boolean') {
      return res.status(400).json({ error: 'Day, time, activity, and visible status are required' });
    }
    
    const dayNumber = parseInt(day.replace(/\D/g, ''));
    if (dayNumber < 1 || dayNumber > 10) {
      return res.status(400).json({ error: 'Day must be between 1 and 10' });
    }
    
    const sheetName = getSheetName(dayNumber);
    const sheets = getSheetsClient();
    
    console.log(`Toggling visibility for activity in ${sheetName}:`, { time, activity, visible });
    
    // Get current data from the day sheet
    const values = await getCachedDayData(dayNumber);
    console.log(`Current data in ${sheetName}:`, values);
    console.log(`Looking for time: "${time}" and activity: "${activity}"`);
    
    // Find the row to update by matching time and activity
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      console.log(`Row ${i}:`, row);
      if (row && row.length > 1) {
        console.log(`  Comparing: row[0]="${row[0]}" with time="${time}"`);
        console.log(`  Comparing: row[1]="${row[1]}" with activity="${activity}"`);
        if (row[0] === time && row[1] === activity) {
          rowIndex = i + 1; // Sheets API uses 1-based indexing
          console.log(`  MATCH FOUND at row ${rowIndex}`);
          break;
        }
      }
    }
    
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    // Update the visibility column (column 6, index 5)
    // If the row doesn't have enough columns, we need to extend it
    const updateRange = `${sheetName}!F${rowIndex}`;
    const updateValue = visible ? 'true' : 'false';
    
    console.log(`Updating visibility at ${updateRange} to: ${updateValue}`);
    
    const updateResponse = await rateLimitedSheetsCall(() => 
      sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: updateRange,
        valueInputOption: 'RAW',
        resource: {
          values: [[updateValue]]
        }
      })
    );
    
    console.log(`Successfully updated visibility in ${sheetName}:`, updateResponse.data);
    
    // Invalidate cache for this day
    invalidateCache(`day:${dayNumber}`);
    
    res.json({
      success: true,
      message: `Activity ${visible ? 'made visible' : 'hidden'} successfully`,
      day: dayNumber,
      updatedActivity: { time, activity, visible }
    });
    
  } catch (error) {
    console.error('Error updating activity visibility:', error);
    
    if (error.message && error.message.includes('Quota exceeded') || error.code === 429) {
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please wait a moment and try again.',
        details: 'Google Sheets API rate limit reached'
      });
    } else {
      res.status(500).json({ error: 'Failed to update activity visibility' });
    }
  }
});

// Move activity between days endpoint
app.post('/api/itinerary/move', auth, requirePermission('edit'), async (req, res) => {
  console.log('\n🔄🔄🔄 MOVE ACTIVITY ENDPOINT CALLED 🔄🔄🔄');
  console.log('Request body:', req.body);
  try {
    const { sourceDay, targetDay, targetDate, time, activity, notes, cost, link } = req.body;
    
    if (!sourceDay || !targetDay || !targetDate || !time || !activity) {
      return res.status(400).json({ error: 'Source day, target day, target date, time, and activity are required' });
    }
    
    if (sourceDay < 1 || sourceDay > 10 || targetDay < 1 || targetDay > 10) {
      return res.status(400).json({ error: 'Day numbers must be between 1 and 10' });
    }
    
    if (sourceDay === targetDay) {
      return res.status(400).json({ error: 'Source and target days must be different' });
    }
    
    const sourceSheetName = getSheetName(sourceDay);
    const targetSheetName = getSheetName(targetDay);
    const sheets = getSheetsClient();
    
    console.log(`=== MOVE ACTIVITY DEBUG ===`);
    console.log(`Source Day: ${sourceDay} (${sourceSheetName})`);
    console.log(`Target Day: ${targetDay} (${targetSheetName})`);
    console.log(`Target Date: ${targetDate}`);
    console.log(`Activity: ${activity}`);
    console.log(`Time: ${time}`);
    
    // Performance Optimization: Invalidate cache for both days before operations
    console.log(`Invalidating cache for Day ${sourceDay} and Day ${targetDay} before move`);
    invalidateCache(`day:${sourceDay}`);
    invalidateCache(`day:${targetDay}`);
    
    // Get current data from the source day sheet
    const sourceValues = await getCachedDayData(sourceDay);
    console.log(`Current data in ${sourceSheetName}:`, sourceValues);
    
    // Find the row to move by matching time and activity
    let sourceRowIndex = -1;
    let headerOffset = 0;
    
    // Check if first row is a header row
    if (sourceValues.length > 0 && sourceValues[0] && sourceValues[0][0] === 'Date') {
      headerOffset = 1;
    }
    
    // Search for the matching activity in source sheet
    for (let i = headerOffset; i < sourceValues.length; i++) {
      const row = sourceValues[i];
      if (row && row.length >= 2) {
        const rowTime = (row[0] || '').trim();
        const rowActivity = (row[1] || '').trim();
        
        console.log(`Checking source row ${i}: time="${rowTime}", activity="${rowActivity}"`);
        console.log(`Looking for: time="${time.trim()}", activity="${activity.trim()}"`);
        
        if (rowTime === time.trim() && rowActivity === activity.trim()) {
          sourceRowIndex = i;
          console.log(`Found matching activity at source row ${i}`);
          break;
        }
      }
    }
    
    if (sourceRowIndex === -1) {
      return res.status(404).json({ 
        error: 'Activity not found in source day',
        details: `No activity found with time "${time}" and activity "${activity}" in Day ${sourceDay}`
      });
    }
    
    // Get the current row data to preserve all information
    const currentRow = sourceValues[sourceRowIndex] || [];
    console.log(`Source row data:`, currentRow);
    
    // Get current data from the target day sheet
    const targetValues = await getCachedDayData(targetDay);
    console.log(`Current data in ${targetSheetName}:`, targetValues);
    
    // Find the next available row in target sheet
    let targetRowIndex = targetValues.length;
    
    // Check if target sheet has a header row
    if (targetValues.length > 0 && targetValues[0] && targetValues[0][0] === 'Date') {
      targetRowIndex = targetValues.length;
    }
    
    console.log(`Target row index: ${targetRowIndex + 1}`);
    
    // Create the new row data for target sheet
    const newRow = [
      time, // Column A: Time
      activity, // Column B: Activity  
      notes || '', // Column C: Notes
      cost || '', // Column D: Cost
      link || '', // Column E: Link
      'true', // Column F: Visibility (set to visible by default)
      currentRow[6] || '' // Column G: Image URL (preserve existing image)
    ];
    
    console.log(`New row data for target:`, newRow);
    
    try {
      // Step 1: Add the activity to the target day
      console.log(`Adding activity to ${targetSheetName} at row ${targetRowIndex + 1}`);
      
      const addResponse = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${targetSheetName}!A${targetRowIndex + 1}:${String.fromCharCode(65 + newRow.length - 1)}${targetRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [newRow]
          }
        })
      );
      
      console.log(`Successfully added activity to ${targetSheetName}:`, addResponse.data);
      
      // Step 2: Delete the activity from the source day
      console.log(`Deleting activity from ${sourceSheetName} at row ${sourceRowIndex + 1}`);
      
      // Get the sheet metadata to find the correct sheet ID for source sheet
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
      });
      
      const sourceSheet = spreadsheet.data.sheets.find(s => s.properties.title === sourceSheetName);
      if (!sourceSheet) {
        return res.status(404).json({ error: `Source sheet ${sourceSheetName} not found` });
      }
      
      const sourceSheetId = sourceSheet.properties.sheetId;
      console.log(`Found source sheet ID:`, sourceSheetId);
      
      const deleteResponse = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          resource: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sourceSheetId,
                    dimension: 'ROWS',
                    startIndex: sourceRowIndex,
                    endIndex: sourceRowIndex + 1
                  }
                }
              }
            ]
          }
        })
      );
      
      console.log(`Successfully deleted activity from ${sourceSheetName}:`, deleteResponse.data);
      
      // Performance Optimization: Invalidate cache for both days after successful move
      console.log(`Invalidating cache for Day ${sourceDay} and Day ${targetDay} after successful move`);
      invalidateCache(`day:${sourceDay}`);
      invalidateCache(`day:${targetDay}`);
      
      // Return success response
      res.json({
        success: true,
        message: 'Activity moved successfully',
        sourceDay: sourceDay,
        targetDay: targetDay,
        targetDate: targetDate,
        movedActivity: { time, activity, notes, cost, link },
        sourceRowDeleted: sourceRowIndex + 1,
        targetRowAdded: targetRowIndex + 1
      });
      
    } catch (operationError) {
      console.error(`Error during move operation:`, operationError);
      
      // If we get a rate limit error, provide a helpful message
      if (operationError.message && (operationError.message.includes('Quota exceeded') || operationError.code === 429)) {
        res.status(429).json({ 
          error: 'Rate limit exceeded. Please wait a moment and try again.',
          details: 'Google Sheets API rate limit reached during move operation'
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to move activity',
          details: operationError.message 
        });
      }
    }
    
  } catch (error) {
    console.error('Error moving activity:', error);
    res.status(500).json({ error: 'Failed to move activity' });
  }
});

// Test endpoint to check if upload-image is accessible
app.get('/api/test-upload', (req, res) => {
  res.json({ message: 'Upload endpoint is accessible', timestamp: new Date().toISOString() });
});

// Image upload endpoint for Dropbox
app.post('/api/upload-image', auth, requirePermission('edit'), upload.single('image'), async (req, res) => {
  console.log('=== UPLOAD IMAGE ENDPOINT CALLED ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request headers:', req.headers);
  console.log('Request body keys:', Object.keys(req.body || {}));
  console.log('Request file:', req.file ? 'Present' : 'Missing');
  
  try {
    if (!req.file) {
      console.log('No file provided in request');
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { originalname, mimetype, buffer } = req.file;
    
    // Validate file type
    if (!mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'File must be an image' });
    }

    // Validate file size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image file too large. Maximum size is 10MB.' });
    }

    console.log('Starting image upload to Dropbox...');
    console.log('File details:', {
      originalname,
      mimetype,
      size: buffer.length,
      timestamp: Date.now()
    });
    
    const dbx = getDropboxClient();
    
    // Create a unique filename
    const timestamp = Date.now();
    const fileExtension = originalname.split('.').pop();
    const fileName = `dubai-trip-images/${timestamp}_${originalname}`;
    
    console.log('Uploading to Dropbox path:', `/${fileName}`);
    
    // Upload to Dropbox
    const uploadResponse = await dbx.filesUpload({
      path: `/${fileName}`,
      contents: buffer,
      mode: 'add'
    });
    
    console.log('Upload response received:', uploadResponse.result);
    
    console.log('Creating shared link for path:', uploadResponse.result.path_display);
    
    // Get a shared link (public) with robust settings for mobile compatibility
    const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: uploadResponse.result.path_display,
      settings: {
        requested_visibility: 'public',
        audience: 'public',
        access: 'viewer',
        allow_download: true
      }
    });
    
    console.log('Shared link response:', sharedLinkResponse.result);
    
    // Convert to direct link for public access - use more reliable format
    const sharedLink = sharedLinkResponse.result.url;
    const directLink = sharedLink.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '?raw=1');
    
    console.log('Original shared link:', sharedLink);
    console.log('Converted direct link:', directLink);
    
    console.log('Image uploaded successfully to Dropbox:', fileName);
    
    res.json({
      success: true,
      imageId: uploadResponse.result.id,
      imageName: originalname,
      imageUrl: directLink,
      thumbnailUrl: directLink,
      storageType: 'dropbox'
    });

  } catch (error) {
    console.error('Error uploading image to Dropbox:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      statusCode: error.statusCode
    });
    res.status(500).json({ 
      error: 'Failed to upload image',
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Delete image endpoint for Dropbox
app.delete('/api/delete-image/:imageId', auth, requirePermission('edit'), async (req, res) => {
  try {
    const { imageId } = req.params;
    
    const dbx = getDropboxClient();
    
    // For Dropbox, we need the path, not the ID
    // Since we're storing the ID, we'll need to handle this differently
    // For now, we'll just return success (the image will remain in Dropbox)
    console.log('Image delete requested for ID:', imageId);

    res.json({
      success: true,
      message: 'Image delete request received (Dropbox cleanup handled separately)'
    });

  } catch (error) {
    console.error('Error deleting image from Dropbox:', error);
    res.status(500).json({ 
      error: 'Failed to delete image',
      details: error.message 
    });
  }
});

// Fix existing Dropbox links endpoint
app.post('/api/fix-dropbox-links', auth, requirePermission('edit'), async (req, res) => {
  try {
    console.log('Fixing existing Dropbox links...');
    
    const dbx = getDropboxClient();
    
    // Get all activities with images
    const itinerary = await getCachedHeaders();
    const allActivities = [];
    
    for (let dayNumber = 1; dayNumber <= 10; dayNumber++) {
      const dayData = await getCachedDayData(dayNumber);
      if (dayData && dayData.length > 0) {
        dayData.forEach((row, index) => {
          if (row.length >= 7 && row[6] && row[6].includes('dropboxusercontent.com')) {
            allActivities.push({
              day: dayNumber,
              rowIndex: index,
              imageUrl: row[6]
            });
          }
        });
      }
    }
    
    console.log(`Found ${allActivities.length} activities with Dropbox images`);
    
    // For each image, try to create a new public link
    const updatedActivities = [];
    
    for (const activity of allActivities) {
      try {
        // Extract the file path from the existing URL
        const urlParts = activity.imageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        const filePath = `/dubai-trip-images/${fileName}`;
        
        // Create a new public shared link with more robust settings
        const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
          path: filePath,
          settings: {
            requested_visibility: 'public',
            audience: 'public',
            access: 'viewer',
            allow_download: true
          }
        });
        
        // Convert to direct link - use more reliable format for mobile compatibility
        const sharedLink = sharedLinkResponse.result.url;
        const directLink = sharedLink.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '?raw=1');
        
        updatedActivities.push({
          day: activity.day,
          rowIndex: activity.rowIndex,
          oldUrl: activity.imageUrl,
          newUrl: directLink
        });
        
        console.log(`Updated link for day ${activity.day}, row ${activity.rowIndex}`);
        
        // Add a small delay to avoid rate limiting
        await delay(100);
        
      } catch (error) {
        console.error(`Error updating link for activity:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${allActivities.length} activities`,
      updatedActivities: updatedActivities
    });

  } catch (error) {
    console.error('Error fixing Dropbox links:', error);
    res.status(500).json({ 
      error: 'Failed to fix Dropbox links',
      details: error.message 
    });
  }
});

// AviationStack API endpoint
app.get('/api/flight-status', auth, async (req, res) => {
  try {
    const { flightNumber, date } = req.query;
    
    if (!flightNumber || !date) {
      return res.status(400).json({ error: 'Flight number and date are required' });
    }
    
    const AVIATION_API_KEY = 'be74647d8855ad71a4dd3838df162266';
    const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATION_API_KEY}&flight_iata=${flightNumber}&date=${date}`;
    
    console.log('Fetching flight status for:', flightNumber, 'on', date);
    console.log('API URL:', url);
    console.log('API Key being used:', AVIATION_API_KEY);
    
    const response = await fetch(url);
    
    // Check if response is OK
    if (!response.ok) {
      console.error('AviationStack API HTTP error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response body:', errorText);
      return res.status(500).json({ 
        error: 'Flight status service unavailable',
        details: `HTTP ${response.status}: ${response.statusText}`
      });
    }
    
    // Check content type to ensure we're getting JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Unexpected content type:', contentType);
      const responseText = await response.text();
      console.error('Non-JSON response:', responseText.substring(0, 200));
      return res.status(500).json({ 
        error: 'Flight status service returned invalid format',
        details: 'Expected JSON but got: ' + contentType
      });
    }
    
    const data = await response.json();
    console.log('AviationStack response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('AviationStack API error:', data.error);
      return res.status(500).json({ 
        error: 'Flight status service error',
        details: data.error
      });
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching flight status:', err);
    res.status(500).json({ 
      error: 'Flight status service unavailable',
      details: err.message 
    });
  }
});

// Handle all other routes by serving the main HTML file (for SPA routing)
app.use((req, res) => {
  console.log('=== CATCH-ALL ROUTE ===');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  
  // Only serve HTML for non-API routes
  if (!req.path.startsWith('/api/')) {
    console.log('Serving HTML file for:', req.path);
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    console.log('API endpoint not found:', req.path);
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
}); 