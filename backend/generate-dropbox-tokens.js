const readline = require('readline');
const https = require('https');
const querystring = require('querystring');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function makeRequest(options, postData = null) {
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
          resolve(data);
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

async function generateTokens() {
  console.log('🔐 Dropbox OAuth Token Generator\n');
  console.log('This script will help you generate access and refresh tokens for Dropbox.\n');

  // Get app credentials
  const appKey = await question('Enter your Dropbox App Key: ');
  const appSecret = await question('Enter your Dropbox App Secret: ');

  console.log('\n📋 Step 1: Generate Authorization URL');
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&redirect_uri=http://localhost:3002/auth/dropbox/callback`;
  
  console.log('\n🔗 Please visit this URL in your browser:');
  console.log(authUrl);
  console.log('\nAfter authorizing, you\'ll be redirected to a URL that looks like:');
  console.log('http://localhost:3002/auth/dropbox/callback?code=YOUR_AUTH_CODE');
  console.log('\nCopy the "code" parameter from that URL.\n');

  const authCode = await question('Enter the authorization code: ');

  console.log('\n🔄 Step 2: Exchanging authorization code for tokens...');

  // Exchange auth code for tokens
  const tokenData = querystring.stringify({
    code: authCode,
    grant_type: 'authorization_code',
    client_id: appKey,
    client_secret: appSecret,
    redirect_uri: 'http://localhost:3002/auth/dropbox/callback'
  });

  try {
    const tokenResponse = await makeRequest({
      hostname: 'api.dropboxapi.com',
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData)
      }
    }, tokenData);

    if (tokenResponse.access_token) {
      console.log('\n✅ Success! Here are your tokens:\n');
      console.log('=== Add these to your backend/.env file ===');
      console.log(`DROPBOX_APP_KEY=${appKey}`);
      console.log(`DROPBOX_APP_SECRET=${appSecret}`);
      console.log(`DROPBOX_ACCESS_TOKEN=${tokenResponse.access_token}`);
      
      if (tokenResponse.refresh_token) {
        console.log(`DROPBOX_REFRESH_TOKEN=${tokenResponse.refresh_token}`);
        console.log('==========================================\n');
        console.log('🎉 Perfect! You have both access and refresh tokens.');
        console.log('The system will automatically refresh tokens when needed.\n');
      } else {
        console.log('DROPBOX_REFRESH_TOKEN=NO_REFRESH_TOKEN_AVAILABLE');
        console.log('==========================================\n');
        console.log('⚠️  Warning: No refresh token received.');
        console.log('This means your access token will expire in 4 hours.');
        console.log('To get refresh tokens, make sure your Dropbox app is configured for OAuth 2.0 with refresh tokens.\n');
        console.log('📋 To fix this:');
        console.log('1. Go to your Dropbox App Console');
        console.log('2. Go to "Settings" tab');
        console.log('3. Under "OAuth 2", make sure "OAuth 2 type" is set to "Full Dropbox"');
        console.log('4. Ensure the redirect URI is added correctly');
        console.log('5. Run this script again\n');
      }
      
      console.log('📝 Instructions:');
      console.log('1. Create a file called `.env` in your backend directory');
      console.log('2. Add the lines above to the file');
      console.log('3. Restart your backend server');
      console.log(`4. Token expires in ${Math.round(tokenResponse.expires_in / 60)} minutes\n`);
      
      console.log('🔒 Security Note: Keep these tokens secure and never commit them to version control!');
    } else {
      console.log('\n❌ Error: Failed to get tokens');
      console.log('Response:', tokenResponse);
    }
  } catch (error) {
    console.log('\n❌ Error exchanging authorization code:', error.message);
  }

  rl.close();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Token generation cancelled. Goodbye!');
  rl.close();
  process.exit(0);
});

generateTokens().catch(console.error); 