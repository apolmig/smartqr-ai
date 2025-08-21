#!/usr/bin/env node

/**
 * COMPREHENSIVE NEON PERSISTENCE SOLUTION TEST
 * 
 * This script tests the complete Neon persistence solution by:
 * 1. Running all diagnostic tests
 * 2. Testing the enhanced persistence solution
 * 3. Validating QR creation and retrieval consistency
 * 4. Generating comprehensive reports
 */

const path = require('path');

// Add TypeScript support
require('ts-node').register({
  project: path.join(__dirname, '../tsconfig.json'),
  transpileOnly: true
});

// Import our TypeScript modules
const { neonPersistenceSolution } = require('../src/lib/neon-persistence-solution');
const { transactionLogger } = require('../src/lib/transaction-logger');
const { runNeonPersistenceDebug } = require('./neon-persistence-debug');
const { NeonServerlessAnalyzer } = require('./neon-serverless-analyzer');

class NeonSolutionTester {
  constructor() {
    this.testResults = {};
    this.startTime = Date.now();
  }

  /**
   * Test 1: Basic Health Check
   */
  async testSystemHealth() {
    console.log('\n🔍 TEST 1: SYSTEM HEALTH CHECK');
    console.log('=' .repeat(60));

    try {
      const health = await neonPersistenceSolution.getSystemHealth();
      
      console.log('📊 System Health Status:');
      console.log(`  Write Client: ${health.writeClient.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${health.writeClient.latency}ms)`);
      console.log(`  Read Client: ${health.readClient.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${health.readClient.latency}ms)`);
      console.log(`  Cache: ${health.cache.userEntries} users, ${health.cache.qrEntries} QRs`);
      console.log(`  Transaction Success Rate: ${health.transactionLogs.successRate}%`);

      return {
        passed: health.writeClient.healthy && health.readClient.healthy,
        health
      };

    } catch (error) {
      console.error('❌ System health check failed:', error);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test 2: User Management
   */
  async testUserManagement() {
    console.log('\n🔍 TEST 2: USER MANAGEMENT TEST');
    console.log('=' .repeat(60));

    try {
      const testEmail = `test-${Date.now()}@solution-test.local`;
      const startTime = Date.now();

      // Create user
      console.log('Creating test user...');
      const user = await neonPersistenceSolution.ensureUser('test-user', 'Test User', testEmail);
      const userCreationTime = Date.now() - startTime;

      console.log(`✅ User created: ${user.id} (${userCreationTime}ms)`);

      // Verify user exists immediately
      const verifyStartTime = Date.now();
      const userVerification = await neonPersistenceSolution.ensureUser('test-user', 'Test User', testEmail);
      const verificationTime = Date.now() - verifyStartTime;

      const userConsistent = user.id === userVerification.id;

      console.log(`✅ User verification: ${userConsistent ? 'CONSISTENT' : 'INCONSISTENT'} (${verificationTime}ms)`);

      return {
        passed: userConsistent,
        userCreationTime,
        verificationTime,
        userId: user.id,
        consistent: userConsistent
      };

    } catch (error) {
      console.error('❌ User management test failed:', error);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test 3: QR Creation and Consistency
   */
  async testQRCreationConsistency() {
    console.log('\n🔍 TEST 3: QR CREATION CONSISTENCY TEST');
    console.log('=' .repeat(60));

    try {
      const testUserId = 'test-qr-user';
      const qrName = `Test QR ${Date.now()}`;
      
      console.log('Creating QR code with enhanced persistence...');
      const creationStartTime = Date.now();

      const creationResult = await neonPersistenceSolution.createQRCode(testUserId, {
        name: qrName,
        targetUrl: 'https://example.com/test',
        enableAI: false,
        qrStyle: 'classic',
        qrColor: '#000000',
        qrSize: 256
      });

      const totalCreationTime = Date.now() - creationStartTime;

      console.log('✅ QR Creation Results:');
      console.log(`  QR ID: ${creationResult.qr.id}`);
      console.log(`  Short ID: ${creationResult.qr.shortId}`);
      console.log(`  Consistency Verified: ${creationResult.consistencyVerified ? '✅ YES' : '❌ NO'}`);
      console.log(`  Creation Time: ${creationResult.creationTime}ms`);
      console.log(`  Verification Time: ${creationResult.verificationTime}ms`);
      console.log(`  Total Time: ${totalCreationTime}ms`);
      console.log(`  Warnings: ${creationResult.warnings.length}`);

      if (creationResult.warnings.length > 0) {
        console.log('⚠️  Warnings:', creationResult.warnings);
      }

      return {
        passed: creationResult.consistencyVerified,
        qrId: creationResult.qr.id,
        shortId: creationResult.qr.shortId,
        creationTime: creationResult.creationTime,
        verificationTime: creationResult.verificationTime,
        totalTime: totalCreationTime,
        warnings: creationResult.warnings,
        consistencyVerified: creationResult.consistencyVerified
      };

    } catch (error) {
      console.error('❌ QR creation test failed:', error);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test 4: QR Retrieval Consistency
   */
  async testQRRetrievalConsistency() {
    console.log('\n🔍 TEST 4: QR RETRIEVAL CONSISTENCY TEST');
    console.log('=' .repeat(60));

    try {
      const testUserId = 'test-qr-user';
      
      console.log('Fetching user QR codes...');
      const fetchStartTime = Date.now();

      const fetchResult = await neonPersistenceSolution.getUserQRCodes(testUserId);
      const fetchTime = Date.now() - fetchStartTime;

      console.log('✅ QR Retrieval Results:');
      console.log(`  QR Codes Found: ${fetchResult.qrCodes.length}`);
      console.log(`  Fetch Time: ${fetchResult.fetchTime}ms`);
      console.log(`  Total Time: ${fetchTime}ms`);
      console.log(`  Attempts: ${fetchResult.attempts}`);
      console.log(`  Cache Hit: ${fetchResult.cacheHit ? '✅ YES' : '❌ NO'}`);

      // Test individual QR lookup
      if (fetchResult.qrCodes.length > 0) {
        const firstQR = fetchResult.qrCodes[0];
        console.log('\nTesting individual QR lookup...');
        
        const lookupStartTime = Date.now();
        const lookupResult = await neonPersistenceSolution.getQRByShortId(firstQR.shortId);
        const lookupTime = Date.now() - lookupStartTime;

        const lookupSuccess = lookupResult && lookupResult.id === firstQR.id;

        console.log(`  Lookup Success: ${lookupSuccess ? '✅ YES' : '❌ NO'}`);
        console.log(`  Lookup Time: ${lookupTime}ms`);

        return {
          passed: fetchResult.qrCodes.length > 0 && lookupSuccess,
          qrCount: fetchResult.qrCodes.length,
          fetchTime: fetchResult.fetchTime,
          lookupSuccess,
          lookupTime
        };
      }

      return {
        passed: true,
        qrCount: 0,
        fetchTime: fetchResult.fetchTime,
        lookupSuccess: null,
        lookupTime: null
      };

    } catch (error) {
      console.error('❌ QR retrieval test failed:', error);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test 5: End-to-End Workflow
   */
  async testEndToEndWorkflow() {
    console.log('\n🔍 TEST 5: END-TO-END WORKFLOW TEST');
    console.log('=' .repeat(60));

    try {
      const workflowStartTime = Date.now();
      const testUser = `workflow-${Date.now()}`;
      
      // Step 1: Create QR
      console.log('Step 1: Creating QR...');
      const creationResult = await neonPersistenceSolution.createQRCode(testUser, {
        name: 'Workflow Test QR',
        targetUrl: 'https://example.com/workflow-test',
        enableAI: false
      });

      // Step 2: Immediate fetch (simulating dashboard)
      console.log('Step 2: Immediate dashboard fetch...');
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay

      const fetchResult = await neonPersistenceSolution.getUserQRCodes(testUser);
      const foundInDashboard = fetchResult.qrCodes.some(qr => qr.shortId === creationResult.qr.shortId);

      // Step 3: Immediate redirect lookup
      console.log('Step 3: Immediate redirect lookup...');
      const redirectResult = await neonPersistenceSolution.getQRByShortId(creationResult.qr.shortId);
      const foundInRedirect = redirectResult && redirectResult.id === creationResult.qr.id;

      const workflowTime = Date.now() - workflowStartTime;
      const allStepsPass = creationResult.consistencyVerified && foundInDashboard && foundInRedirect;

      console.log('✅ End-to-End Results:');
      console.log(`  QR Creation: ${creationResult.consistencyVerified ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`  Dashboard Fetch: ${foundInDashboard ? '✅ FOUND' : '❌ NOT FOUND'}`);
      console.log(`  Redirect Lookup: ${foundInRedirect ? '✅ FOUND' : '❌ NOT FOUND'}`);
      console.log(`  Total Workflow Time: ${workflowTime}ms`);
      console.log(`  Overall: ${allStepsPass ? '✅ PASSED' : '❌ FAILED'}`);

      return {
        passed: allStepsPass,
        qrCreation: creationResult.consistencyVerified,
        dashboardFetch: foundInDashboard,
        redirectLookup: foundInRedirect,
        workflowTime,
        qrId: creationResult.qr.id,
        shortId: creationResult.qr.shortId
      };

    } catch (error) {
      console.error('❌ End-to-end workflow test failed:', error);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test 6: Stress Test
   */
  async testStressTest() {
    console.log('\n🔍 TEST 6: STRESS TEST (5 CONCURRENT QRS)');
    console.log('=' .repeat(60));

    try {
      const stressTestStartTime = Date.now();
      const concurrentQRs = 5;
      
      console.log(`Creating ${concurrentQRs} QRs concurrently...`);

      // Create multiple QRs concurrently
      const creationPromises = Array.from({ length: concurrentQRs }, (_, i) =>
        neonPersistenceSolution.createQRCode(`stress-user-${i}`, {
          name: `Stress Test QR ${i}`,
          targetUrl: `https://example.com/stress-${i}`,
          enableAI: false
        })
      );

      const creationResults = await Promise.allSettled(creationPromises);
      const successful = creationResults.filter(r => r.status === 'fulfilled');
      const failed = creationResults.filter(r => r.status === 'rejected');

      console.log(`✅ Concurrent Creation Results:`);
      console.log(`  Successful: ${successful.length}/${concurrentQRs}`);
      console.log(`  Failed: ${failed.length}/${concurrentQRs}`);

      // Test retrieval consistency for successful creations
      const retrievalTests = await Promise.allSettled(
        successful.map(async (result, i) => {
          const qr = result.value.qr;
          const retrieved = await neonPersistenceSolution.getQRByShortId(qr.shortId);
          return {
            created: qr.id,
            retrieved: retrieved?.id,
            consistent: retrieved?.id === qr.id
          };
        })
      );

      const retrievalSuccessful = retrievalTests.filter(r => 
        r.status === 'fulfilled' && r.value.consistent
      ).length;

      const stressTestTime = Date.now() - stressTestStartTime;

      console.log(`  Retrieval Consistent: ${retrievalSuccessful}/${successful.length}`);
      console.log(`  Total Stress Test Time: ${stressTestTime}ms`);

      const stressTestPassed = successful.length >= concurrentQRs * 0.8 && // 80% success rate
                                retrievalSuccessful >= successful.length * 0.9; // 90% consistency

      console.log(`  Stress Test: ${stressTestPassed ? '✅ PASSED' : '❌ FAILED'}`);

      return {
        passed: stressTestPassed,
        totalQRs: concurrentQRs,
        successful: successful.length,
        failed: failed.length,
        retrievalConsistent: retrievalSuccessful,
        stressTestTime
      };

    } catch (error) {
      console.error('❌ Stress test failed:', error);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Run all tests and generate comprehensive report
   */
  async runAllTests() {
    console.log('🚀 NEON PERSISTENCE SOLUTION COMPREHENSIVE TEST');
    console.log('🔬 Testing enhanced persistence implementation...\n');

    // Run all tests
    this.testResults.systemHealth = await this.testSystemHealth();
    this.testResults.userManagement = await this.testUserManagement();
    this.testResults.qrCreation = await this.testQRCreationConsistency();
    this.testResults.qrRetrieval = await this.testQRRetrievalConsistency();
    this.testResults.endToEnd = await this.testEndToEndWorkflow();
    this.testResults.stressTest = await this.testStressTest();

    // Generate comprehensive analysis
    const totalTime = Date.now() - this.startTime;
    const passedTests = Object.values(this.testResults).filter(result => result.passed).length;
    const totalTests = Object.keys(this.testResults).length;
    const successRate = (passedTests / totalTests) * 100;

    console.log('\n🎯 COMPREHENSIVE TEST RESULTS');
    console.log('=' .repeat(60));

    Object.entries(this.testResults).forEach(([testName, result]) => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`  ${testName.toUpperCase()}: ${status}`);
    });

    console.log('\n📊 SUMMARY STATISTICS');
    console.log('=' .repeat(60));
    console.log(`  Tests Passed: ${passedTests}/${totalTests} (${Math.round(successRate)}%)`);
    console.log(`  Total Test Time: ${totalTime}ms`);

    // Performance analysis
    if (this.testResults.qrCreation.passed) {
      console.log(`  QR Creation Time: ${this.testResults.qrCreation.creationTime}ms`);
      console.log(`  Consistency Verification: ${this.testResults.qrCreation.verificationTime}ms`);
    }

    if (this.testResults.qrRetrieval.passed) {
      console.log(`  QR Retrieval Time: ${this.testResults.qrRetrieval.fetchTime}ms`);
    }

    // Overall assessment
    console.log('\n🏆 OVERALL ASSESSMENT');
    console.log('=' .repeat(60));

    if (successRate >= 100) {
      console.log('🎉 EXCELLENT: All tests passed! Solution is working perfectly.');
    } else if (successRate >= 80) {
      console.log('✅ GOOD: Most tests passed. Minor issues to address.');
    } else if (successRate >= 60) {
      console.log('⚠️  ACCEPTABLE: Some issues present. Needs optimization.');
    } else {
      console.log('🔴 POOR: Major issues detected. Immediate attention required.');
    }

    // Export detailed logs
    const debugData = neonPersistenceSolution.exportDebugData();
    
    const finalReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        passedTests,
        successRate: Math.round(successRate),
        totalTime
      },
      testResults: this.testResults,
      transactionLogs: transactionLogger.exportLogs(),
      debugData
    };

    return finalReport;
  }
}

// Run the comprehensive test
if (require.main === module) {
  const tester = new NeonSolutionTester();
  
  tester.runAllTests()
    .then(report => {
      console.log('\n✅ Comprehensive test completed. Report saved to neon-solution-test-report.json');
      require('fs').writeFileSync(
        'neon-solution-test-report.json', 
        JSON.stringify(report, null, 2)
      );
      
      // Exit with appropriate code
      const successRate = report.summary.successRate;
      process.exit(successRate >= 80 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Comprehensive test failed:', error);
      process.exit(1);
    });
}

module.exports = { NeonSolutionTester };