require('dotenv').config();
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
  const credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
  return google.sheets({ version: 'v4', auth });
}

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

// Catch-all route to serve frontend for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
}); 