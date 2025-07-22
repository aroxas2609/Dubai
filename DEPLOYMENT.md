# 🚀 Full Version Deployment Guide

This guide will help you deploy the complete Dubai Itinerary App with backend API and Google Sheets integration.

## 📋 Prerequisites

1. **Google Sheets Setup** (Already done)
   - Sheet ID: `1pgLAX-xGwfLFpi8uZmpfYeGnITQkdkiKgj3tPV4Jmmc`
   - Service Account: `service-account.json`

2. **Authentication Credentials**
   - Username: `Dubai2025`
   - Password: `Desert`

## 🎯 Deployment Options

### Option 1: Railway (Recommended - Free)

1. **Sign up** at [railway.app](https://railway.app)
2. **Connect your GitHub** account
3. **Create new project** → "Deploy from GitHub repo"
4. **Select your Dubai repository**
5. **Add Environment Variables**:
   ```
   BASIC_AUTH_USER=Dubai2025
   BASIC_AUTH_PASS=Desert
   SHEET_ID=1pgLAX-xGwfLFpi8uZmpfYeGnITQkdkiKgj3tPV4Jmmc
   SHEET_RANGE=Web
   GOOGLE_SERVICE_ACCOUNT_JSON=service-account.json
   PORT=3002
   ```
6. **Deploy!** Your app will be live at `https://your-app.railway.app`

### Option 2: Render (Free tier)

1. **Sign up** at [render.com](https://render.com)
2. **Create new Web Service**
3. **Connect your GitHub** repository
4. **Configure**:
   - Build Command: `npm install`
   - Start Command: `node backend/index.js`
5. **Add Environment Variables** (same as above)
6. **Deploy!**

### Option 3: Heroku (Paid)

1. **Install Heroku CLI**
2. **Login**: `heroku login`
3. **Create app**: `heroku create your-dubai-app`
4. **Set environment variables**:
   ```bash
   heroku config:set BASIC_AUTH_USER=Dubai2025
   heroku config:set BASIC_AUTH_PASS=Desert
   heroku config:set SHEET_ID=1pgLAX-xGwfLFpi8uZmpfYeGnITQkdkiKgj3tPV4Jmmc
   heroku config:set SHEET_RANGE=Web
   ```
5. **Deploy**: `git push heroku main`

## 🔧 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the backend**:
   ```bash
   cd backend
   node index.js
   ```

3. **Open frontend**:
   - Open `frontend/index.html` in your browser
   - Login with: `Dubai2025` / `Desert`

## 📱 Features of Full Version

✅ **Real-time Google Sheets integration**
✅ **Secure authentication** (Basic Auth)
✅ **Dynamic data loading**
✅ **Mobile responsive design**
✅ **Luxury Dubai theme**
✅ **Clickable links in notes**
✅ **Professional styling**

## 🌐 Access Your App

After deployment, your app will be available at:
- **Frontend**: Your deployment URL (e.g., `https://your-app.railway.app`)
- **Backend API**: Same URL + `/api/itinerary`

## 🔐 Security Notes

- The app uses Basic Authentication
- Google Sheets API requires service account credentials
- All sensitive data is stored in environment variables
- CORS is configured for web deployment

## 🆘 Troubleshooting

### Common Issues:

1. **"Authentication failed"**
   - Check `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` environment variables

2. **"Error loading itinerary"**
   - Verify `SHEET_ID` and `SHEET_RANGE` are correct
   - Ensure Google Service Account has access to the sheet

3. **CORS errors**
   - Backend CORS is already configured for web deployment

4. **Port issues**
   - Set `PORT` environment variable or let the platform choose

## 📞 Support

If you encounter issues:
1. Check the deployment platform logs
2. Verify all environment variables are set
3. Ensure Google Sheets permissions are correct
4. Test locally first with `node backend/index.js` 