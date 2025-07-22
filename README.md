# Dubai Trip Itinerary App

A beautiful, responsive web application for displaying Dubai trip itineraries with real-time data from Google Sheets.

## Features

- 🌟 **Luxury Dubai Theme** - Golden desert-inspired design
- 📱 **Mobile Responsive** - Works perfectly on all devices
- 🔐 **Secure Authentication** - Basic auth protection
- 📊 **Real-time Data** - Pulls from Google Sheets
- 🔗 **Smart Links** - Automatic URL detection and formatting
- 🎨 **Animated Elements** - Dynamic gradients and effects

## Quick Deploy Options

### Option 1: Deploy to Railway (Recommended)

1. **Fork this repository** to your GitHub account
2. **Sign up** at [railway.app](https://railway.app)
3. **Connect your GitHub** account
4. **Create new project** → Deploy from GitHub repo
5. **Add environment variables**:
   - `BASIC_AUTH_USER` = your username
   - `BASIC_AUTH_PASS` = your password
   - `SHEET_ID` = your Google Sheet ID
   - `SHEET_RANGE` = Web (or your sheet range)
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = your service account file path
6. **Deploy!** Your app will be live at `https://your-app.railway.app`

### Option 2: Deploy to Render

1. **Sign up** at [render.com](https://render.com)
2. **Create new Web Service**
3. **Connect your GitHub** repository
4. **Configure**:
   - Build Command: `npm install`
   - Start Command: `node backend/index.js`
5. **Add environment variables** (same as above)
6. **Deploy!**

### Option 3: Deploy to Heroku

1. **Install Heroku CLI**
2. **Login**: `heroku login`
3. **Create app**: `heroku create your-app-name`
4. **Set environment variables**:
   ```bash
   heroku config:set BASIC_AUTH_USER=your_username
   heroku config:set BASIC_AUTH_PASS=your_password
   heroku config:set SHEET_ID=your_sheet_id
   heroku config:set SHEET_RANGE=Web
   ```
5. **Deploy**: `git push heroku main`

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables** in `backend/.env`:
   ```
   BASIC_AUTH_USER=Dubai2025
   BASIC_AUTH_PASS=Desert
   SHEET_ID=your_google_sheet_id
   SHEET_RANGE=Web
   GOOGLE_SERVICE_ACCOUNT_JSON=service-account.json
   PORT=3002
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Open** `frontend/index.html` in your browser

## Google Sheets Setup

1. **Create a Google Sheet** with your itinerary data
2. **Set up Google Service Account**:
   - Go to Google Cloud Console
   - Create a new project
   - Enable Google Sheets API
   - Create a service account
   - Download the JSON key file
   - Share your Google Sheet with the service account email
3. **Add the JSON file** to your `backend/` folder as `service-account.json`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BASIC_AUTH_USER` | Username for login | `Dubai2025` |
| `BASIC_AUTH_PASS` | Password for login | `Desert` |
| `SHEET_ID` | Google Sheet ID | `1pgLAX-xGwfLFpi8uZmpfYeGnITQkdkiKgj3tPV4Jmmc` |
| `SHEET_RANGE` | Sheet range to read | `Web` |
| `PORT` | Server port | `3002` |

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: Google Sheets API
- **Authentication**: Basic Auth
- **Styling**: Custom CSS with Dubai theme

## License

ISC 