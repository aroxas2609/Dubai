const https = require('https');
const querystring = require('querystring');

class DropboxTokenManager {
  constructor() {
    this.accessToken = process.env.DROPBOX_ACCESS_TOKEN;
    this.refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    this.appKey = process.env.DROPBOX_APP_KEY;
    this.appSecret = process.env.DROPBOX_APP_SECRET;
    this.tokenExpiry = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  // Check if we have the required configuration
  isConfigured() {
    return !!(this.accessToken && this.appKey && this.appSecret);
  }

  // Check if we have refresh token capability
  hasRefreshToken() {
    return !!(this.refreshToken && this.refreshToken !== 'NO_REFRESH_TOKEN_AVAILABLE');
  }

  // Get a valid access token, refreshing if necessary
  async getValidAccessToken() {
    // If we're already refreshing, wait for that to complete
    if (this.isRefreshing && this.refreshPromise) {
      return await this.refreshPromise;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    if (this.isTokenExpired()) {
      if (this.hasRefreshToken()) {
        console.log('🔄 Dropbox token expired or expiring soon, refreshing...');
        return await this.refreshAccessToken();
      } else {
        console.log('⚠️  Dropbox token expired and no refresh token available. You need to generate a new token.');
        throw new Error('Access token expired and no refresh token available. Please run the token generator again.');
      }
    }

    return this.accessToken;
  }

  // Check if token is expired or will expire soon
  isTokenExpired() {
    if (!this.tokenExpiry) {
      // If we don't have expiry info, assume it might be expired
      return true;
    }
    
    // Consider token expired if it expires within 5 minutes
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return this.tokenExpiry <= fiveMinutesFromNow;
  }

  // Refresh the access token using the refresh token
  async refreshAccessToken() {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  // Perform the actual token refresh
  async performTokenRefresh() {
    if (!this.refreshToken || !this.appKey || !this.appSecret) {
      throw new Error('Missing refresh token, app key, or app secret for Dropbox token refresh');
    }

    const refreshData = querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.appKey,
      client_secret: this.appSecret
    });

    try {
      const response = await this.makeRequest({
        hostname: 'api.dropboxapi.com',
        path: '/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(refreshData)
        }
      }, refreshData);

      if (response.access_token) {
        // Update the access token
        this.accessToken = response.access_token;
        
        // Update refresh token if a new one was provided
        if (response.refresh_token) {
          this.refreshToken = response.refresh_token;
          console.log('🔄 Dropbox refresh token updated');
        }

        // Set token expiry (typically 4 hours = 14400000 ms)
        this.tokenExpiry = Date.now() + (response.expires_in * 1000);
        
        console.log('✅ Dropbox access token refreshed successfully');
        console.log(`⏰ Token expires in ${Math.round(response.expires_in / 60)} minutes`);
        
        return this.accessToken;
      } else {
        throw new Error('No access token received in refresh response');
      }
    } catch (error) {
      console.error('❌ Failed to refresh Dropbox token:', error.message);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // Make HTTP request
  makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  // Get current token info for debugging
  getTokenInfo() {
    return {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: this.hasRefreshToken(),
      hasAppCredentials: !!(this.appKey && this.appSecret),
      isConfigured: this.isConfigured(),
      canRefresh: this.hasRefreshToken(),
      isExpired: this.isTokenExpired(),
      expiryTime: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : null,
      timeUntilExpiry: this.tokenExpiry ? Math.round((this.tokenExpiry - Date.now()) / 1000 / 60) : null
    };
  }
}

// Create and export a singleton instance
const tokenManager = new DropboxTokenManager();

module.exports = tokenManager; 