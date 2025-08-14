# 🗂️ Dropbox Integration Setup Guide

## 🎯 **Why Dropbox?**

✅ **No API quotas** - Unlike Google Drive service accounts  
✅ **Reliable storage** - 2GB free storage, 2TB with Dropbox Plus  
✅ **Simple setup** - Just need an access token  
✅ **Direct links** - Images load instantly in your app  
✅ **Works with personal accounts** - No workspace requirements  
✅ **Automatic token refresh** - Tokens never expire

## 📋 **Setup Steps**

### **1. Create a Dropbox App**

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click **"Create app"**
3. Choose **"Scoped access"**
4. Choose **"Full Dropbox"** access
5. Name your app: `dubai-trip-images`
6. Click **"Create app"**

### **2. Configure App Settings**

1. In your app settings, go to **"Permissions"** tab
2. Enable these permissions:
   - ✅ **files.content.write** - Upload files
   - ✅ **files.content.read** - Read files  
   - ✅ **sharing.write** - Create shared links
3. Click **"Submit"** to save permissions

### **3. Configure OAuth 2.0 Settings**

1. Go to **"Settings"** tab
2. Under **"OAuth 2"** section:
   - Set **"OAuth 2 type"** to **"Full Dropbox"**
   - Add **"Redirect URI"**: `http://localhost:3002/auth/dropbox/callback`
   - Click **"Add"** to save the redirect URI
3. **Copy your App Key and App Secret** - you'll need these for OAuth flow

### **4. Generate Initial Tokens (One-time setup)**

1. **Option A: Use the provided token generator script**
   ```bash
   cd backend
   node generate-dropbox-tokens.js
   ```
   Follow the prompts to authenticate and get your tokens.

2. **Option B: Manual OAuth flow**
   - Visit: `https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&response_type=code&redirect_uri=http://localhost:3002/auth/dropbox/callback`
   - Replace `YOUR_APP_KEY` with your actual app key
   - Authorize the app and copy the authorization code
   - Use the code to get access and refresh tokens

### **5. Add Tokens to Backend**

1. Create `backend/.env` file (if it doesn't exist)
2. Add these lines:
   ```
   DROPBOX_APP_KEY=your_app_key_here
   DROPBOX_APP_SECRET=your_app_secret_here
   DROPBOX_REFRESH_TOKEN=your_refresh_token_here
   DROPBOX_ACCESS_TOKEN=your_initial_access_token_here
   ```
3. Replace the placeholder values with your actual tokens

### **6. Restart Backend**

```bash
# Stop the current backend (Ctrl+C)
# Then restart:
npm start
```

## 🚀 **How It Works**

1. **Automatic Token Refresh** → Tokens refresh automatically before expiration
2. **Image Upload** → Upload to Dropbox → Get direct link
3. **Image Display** → Load from Dropbox → Display in app
4. **Storage** → All images stored in `/dubai-trip-images/` folder

## 📁 **File Structure in Dropbox**

```
/dubai-trip-images/
├── 1753602000000_image1.jpg
├── 1753602000001_image2.png
└── 1753602000002_image3.jpg
```

## ✅ **Test It**

1. **Upload an image** in your app
2. **Check backend logs** for "Starting image upload to Dropbox..."
3. **Check Dropbox** - images appear in `/dubai-trip-images/` folder
4. **Images display** in your activity cards/table
5. **Token refresh** - Check logs for automatic token refresh messages

## 🔧 **Troubleshooting**

### **"DROPBOX_ACCESS_TOKEN not configured"**
- Make sure you added all required tokens to `backend/.env`
- Restart the backend after adding the tokens

### **"Permission denied"**
- Check that you enabled the required permissions in Dropbox app settings
- Make sure you're using the correct tokens

### **"Token expired"**
- The system should automatically refresh tokens
- If manual refresh is needed, run the token generator script again

### **"Upload failed"**
- Check your internet connection
- Verify the image file is valid (JPG, PNG, etc.)
- Ensure file size is under 10MB

## 🎉 **Benefits Over Previous Solutions**

| Feature | Google Drive | Base64 | **Dropbox** |
|---------|-------------|--------|-------------|
| Setup Complexity | ❌ Complex | ✅ Simple | ✅ **Simple** |
| API Quotas | ❌ Limited | ✅ None | ✅ **None** |
| Storage Limits | ❌ Service Account | ✅ Sheets Limit | ✅ **2GB Free** |
| Personal Account | ❌ No | ✅ Yes | ✅ **Yes** |
| Direct Links | ❌ No | ✅ Yes | ✅ **Yes** |
| Token Refresh | ❌ Manual | ✅ N/A | ✅ **Automatic** | 