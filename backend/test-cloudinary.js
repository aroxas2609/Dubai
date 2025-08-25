// Test script for Cloudinary integration
// Run this with: node test-cloudinary.js

// Load environment variables first
require('dotenv').config();

const cloudinaryStorage = require('./cloudinary-storage');

async function testCloudinary() {
  console.log('🧪 Testing Cloudinary Integration...\n');
  
  // Test 1: Check if configured
  console.log('1. Configuration Check:');
  const isConfigured = cloudinaryStorage.isConfigured();
  console.log(`   Configured: ${isConfigured ? '✅ Yes' : '❌ No'}`);
  
  if (!isConfigured) {
    console.log('\n   ⚠️  Cloudinary not configured!');
    console.log('   Please set these environment variables:');
    console.log('   - CLOUDINARY_CLOUD_NAME');
    console.log('   - CLOUDINARY_API_KEY');
    console.log('   - CLOUDINARY_API_SECRET');
    console.log('\n   See CLOUDINARY_SETUP.md for instructions.');
    return;
  }
  
  // Test 2: Test connection
  console.log('\n2. Connection Test:');
  try {
    const connectionResult = await cloudinaryStorage.testConnection();
    if (connectionResult.success) {
      console.log('   ✅ Connection successful!');
      console.log(`   Response: ${JSON.stringify(connectionResult.result)}`);
    } else {
      console.log('   ❌ Connection failed:', connectionResult.error);
    }
  } catch (error) {
    console.log('   ❌ Connection test error:', error.message);
  }
  
  // Test 3: Get storage info
  console.log('\n3. Storage Info:');
  try {
    const storageInfo = cloudinaryStorage.getStorageInfo();
    console.log('   Storage Info:', JSON.stringify(storageInfo, null, 2));
  } catch (error) {
    console.log('   ❌ Storage info error:', error.message);
  }
  
  console.log('\n🎯 Test completed!');
  console.log('\nNext steps:');
  console.log('1. Restart your backend server');
  console.log('2. Test image upload in your app');
  console.log('3. Check the /api/test-cloudinary endpoint');
}

// Run the test
testCloudinary().catch(console.error);
