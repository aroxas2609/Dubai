require('dotenv').config({ path: __dirname + '/.env' });
console.log('Loaded user:', process.env.BASIC_AUTH_USER);
console.log('Loaded pass:', process.env.BASIC_AUTH_PASS);
console.log('Loaded .env from:', process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const express = require('express');
const basicAuth = require('basic-auth');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3002;

// CORS for frontend
app.use(cors());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Basic Auth Middleware
const auth = (req, res, next) => {
  const user = basicAuth(req);
  console.log('Auth attempt:', user);
  console.log('Expected:', process.env.BASIC_AUTH_USER, process.env.BASIC_AUTH_PASS);
  if (!user || user.name !== process.env.BASIC_AUTH_USER || user.pass !== process.env.BASIC_AUTH_PASS) {
    res.set('WWW-Authenticate', 'Basic realm=\"Dubai Trip\"');
    return res.status(401).send('Authentication required.');
  }
  next();
};

// Google Sheets API setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const SHEET_ID = process.env.SHEET_ID;
const SHEET_RANGE = process.env.SHEET_RANGE || 'Web';

console.log('Using sheet ID:', SHEET_ID);
console.log('Using sheet range:', SHEET_RANGE);

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

// Test endpoint to check environment variables
app.get('/api/test', (req, res) => {
  res.json({
    sheetId: SHEET_ID ? 'Set' : 'Missing',
    sheetRange: SHEET_RANGE,
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? 'Set' : 'Missing',
    serviceAccountContent: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_CONTENT ? 'Set' : 'Missing',
    port: PORT
  });
});

app.get('/api/itinerary', auth, async (req, res) => {
  try {
    const sheets = getSheetsClient();
    console.log('Fetching data from sheet:', SHEET_ID, 'range:', SHEET_RANGE);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });
    
    console.log('Raw data from Google Sheets:', response.data.values);
    console.log('Number of rows fetched:', response.data.values ? response.data.values.length : 0);
    
    res.json(response.data.values);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: err.message });
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
    const url = `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_API_KEY}&flight_iata=${flightNumber}&date=${date}`;
    
    console.log('Fetching flight status for:', flightNumber, 'on', date);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('AviationStack response:', data);
    
    if (data.error) {
      console.error('AviationStack API error:', data.error);
      return res.status(500).json({ error: 'Flight status service unavailable' });
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching flight status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Handle all other routes by serving the main HTML file (for SPA routing)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
}); 