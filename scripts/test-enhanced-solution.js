#!/usr/bin/env node

// Test Enhanced Database Service Solution
// Validates that the persistence issue is resolved

require('dotenv').config();
const { EnhancedDatabaseService } = require('../src/lib/enhanced-db-service.ts');

async function testEnhancedSolution() {
  console.log('🚀 Testing Enhanced Database Service Solution...\n');
  
  const testUserId = 'test-enhanced-solution';
  const testQRName = `Enhanced Test QR ${Date.now()}`;
  const testTargetUrl = 'https://claude.ai';
  
  try {
    console.log('📋 Test Configuration:');
    console.log(`   - User ID: ${testUserId}`);
    console.log(`   - QR Name: ${testQRName}`);
    console.log(`   - Target URL: ${testTargetUrl}\n`);

    // Test 1: User Creation/Retrieval
    console.log('1️⃣  Testing Enhanced User Operations...');
    const user = await EnhancedDatabaseService.ensureUser(testUserId, 'Enhanced Test User');
    console.log(`   ✅ User ensured: ${user.id}\n`);

    // Test 2: QR Creation with Full Verification
    console.log('2️⃣  Testing Enhanced QR Creation...');
    const qrCode = await EnhancedDatabaseService.createQRCode(testUserId, {
      name: testQRName,
      targetUrl: testTargetUrl,
      enableAI: false,
    });
    console.log(`   ✅ QR created: ${qrCode.shortId} (ID: ${qrCode.id})\n`);

    // Test 3: Immediate QR Retrieval
    console.log('3️⃣  Testing Enhanced QR Retrieval (immediate)...');
    const retrievedQR = await EnhancedDatabaseService.getQRCode(qrCode.shortId);
    
    if (retrievedQR) {
      console.log(`   ✅ QR found immediately: ${retrievedQR.shortId}`);
      console.log(`   📊 Details: "${retrievedQR.name}" -> ${retrievedQR.targetUrl}\n`);
    } else {
      console.log(`   ❌ QR NOT found immediately: ${qrCode.shortId}\n`);
    }

    // Test 4: Dashboard QR Fetching
    console.log('4️⃣  Testing Enhanced Dashboard Fetching...');
    const userQRs = await EnhancedDatabaseService.getUserQRCodes(testUserId);
    console.log(`   📊 User QRs found: ${userQRs.length}`);
    
    if (userQRs.length > 0) {
      console.log('   ✅ Dashboard fetching SUCCESS!');
      userQRs.forEach((qr, index) => {
        console.log(`   ${index + 1}. ${qr.shortId}: "${qr.name}" -> ${qr.targetUrl}`);
      });
    } else {
      console.log('   ❌ Dashboard fetching FAILED - no QRs returned');
    }

    console.log('\n5️⃣  Testing Multiple Strategies...');
    
    // Test 5a: Anonymous User (most common case)
    console.log('   📝 Testing anonymous user...');
    const anonymousQR = await EnhancedDatabaseService.createQRCode('anonymous', {
      name: 'Anonymous Test QR',
      targetUrl: 'https://anthropic.com',
    });
    console.log(`   ✅ Anonymous QR created: ${anonymousQR.shortId}`);
    
    const anonymousQRs = await EnhancedDatabaseService.getUserQRCodes('anonymous');
    console.log(`   📊 Anonymous QRs found: ${anonymousQRs.length}`);
    
    // Test 5b: Redirect Functionality
    console.log('   🔗 Testing redirect functionality...');
    const redirectQR = await EnhancedDatabaseService.getQRCode(anonymousQR.shortId);
    if (redirectQR) {
      console.log(`   ✅ Redirect QR found: ${redirectQR.targetUrl}`);
    } else {
      console.log(`   ❌ Redirect QR NOT found: ${anonymousQR.shortId}`);
    }

    // Summary
    console.log('\n🏁 TEST SUMMARY:');
    console.log('════════════════════════════════════════');
    console.log(`✅ User Operations: WORKING`);
    console.log(`${qrCode ? '✅' : '❌'} QR Creation: ${qrCode ? 'WORKING' : 'FAILED'}`);
    console.log(`${retrievedQR ? '✅' : '❌'} QR Retrieval: ${retrievedQR ? 'WORKING' : 'FAILED'}`);
    console.log(`${userQRs.length > 0 ? '✅' : '❌'} Dashboard Fetching: ${userQRs.length > 0 ? 'WORKING' : 'FAILED'}`);
    console.log(`${redirectQR ? '✅' : '❌'} Redirect Functionality: ${redirectQR ? 'WORKING' : 'FAILED'}`);
    console.log('════════════════════════════════════════');

    const allPassed = qrCode && retrievedQR && userQRs.length > 0 && redirectQR;
    
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED! Enhanced solution is working correctly.');
      console.log('   The persistence issue has been resolved.');
    } else {
      console.log('⚠️  Some tests failed. Check the logs above for details.');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEnhancedSolution().catch(console.error);
}

module.exports = { testEnhancedSolution };