#!/usr/bin/env node

/**
 * NEON POSTGRESQL PERSISTENCE DEBUGGING TOOL
 * 
 * This script performs comprehensive debugging of QR persistence issues
 * specifically for Neon PostgreSQL serverless architecture.
 */

const { PrismaClient } = require('@prisma/client');

// Create multiple Prisma instances to test connection isolation
const createPrismaInstance = (name) => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
      { level: 'info', emit: 'stdout' }
    ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

const prisma1 = createPrismaInstance('PRIMARY');
const prisma2 = createPrismaInstance('SECONDARY');

// Transaction debugging state
let transactionLogs = [];
let connectionLogs = [];

// Enhanced logging for all Prisma instances
[prisma1, prisma2].forEach((client, index) => {
  client.$on('query', (e) => {
    const logEntry = {
      instance: index === 0 ? 'PRIMARY' : 'SECONDARY',
      timestamp: new Date().toISOString(),
      query: e.query,
      params: e.params,
      duration: e.duration,
      target: e.target
    };
    transactionLogs.push(logEntry);
    
    if (e.duration > 100) {
      console.log(`🐌 [${logEntry.instance}] Slow Query (${e.duration}ms):`, e.query.substring(0, 100));
    }
  });
});

/**
 * TEST 1: Connection Pool Isolation Analysis
 */
async function testConnectionIsolation() {
  console.log('\n🔍 TEST 1: CONNECTION POOL ISOLATION ANALYSIS');
  console.log('=' .repeat(60));
  
  try {
    // Get connection info from both instances
    const [conn1, conn2] = await Promise.all([
      prisma1.$queryRaw`SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        pg_backend_pid() as backend_pid,
        application_name,
        client_addr
      FROM pg_stat_activity WHERE pid = pg_backend_pid()`,
      
      prisma2.$queryRaw`SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        pg_backend_pid() as backend_pid,
        application_name,
        client_addr
      FROM pg_stat_activity WHERE pid = pg_backend_pid()`
    ]);
    
    console.log('PRIMARY Instance Connection:', conn1[0]);
    console.log('SECONDARY Instance Connection:', conn2[0]);
    
    const samePid = conn1[0].backend_pid === conn2[0].backend_pid;
    console.log('🔗 Same Backend PID:', samePid ? '⚠️  YES (SHARED CONNECTION)' : '✅ NO (ISOLATED)');
    
    return {
      isolationPassed: !samePid,
      conn1: conn1[0],
      conn2: conn2[0]
    };
    
  } catch (error) {
    console.error('❌ Connection isolation test failed:', error);
    return { isolationPassed: false, error: error.message };
  }
}

/**
 * TEST 2: Transaction Consistency Analysis
 */
async function testTransactionConsistency() {
  console.log('\n🔍 TEST 2: TRANSACTION CONSISTENCY ANALYSIS');
  console.log('=' .repeat(60));
  
  const testShortId = `TEST_${Date.now()}`;
  
  try {
    // Phase 1: Create QR in transaction and check immediately
    console.log('Phase 1: Creating QR in transaction...');
    
    const createResult = await prisma1.$transaction(async (tx) => {
      // Ensure test user exists
      const testUser = await tx.user.upsert({
        where: { email: 'test@neon-debug.local' },
        create: {
          email: 'test@neon-debug.local',
          name: 'Test User for Debugging',
          plan: 'FREE'
        },
        update: {}
      });
      
      console.log('✅ Test user ensured:', testUser.id);
      
      // Create QR code
      const qrCode = await tx.qRCode.create({
        data: {
          name: 'Neon Debug Test QR',
          shortId: testShortId,
          targetUrl: 'https://example.com/debug',
          userId: testUser.id,
          enableAI: false,
          qrStyle: 'classic',
          qrColor: '#000000',
          qrSize: 256
        }
      });
      
      console.log('✅ QR created in transaction:', qrCode.id);
      
      // CRITICAL: Check if QR exists within same transaction
      const immediateCheck = await tx.qRCode.findUnique({
        where: { shortId: testShortId }
      });
      
      console.log('🔍 Immediate check within transaction:', immediateCheck ? '✅ FOUND' : '❌ NOT FOUND');
      
      return { qrCode, immediateCheck, userId: testUser.id };
    });
    
    console.log('✅ Transaction completed successfully');
    
    // Phase 2: Check from different connection immediately after transaction
    console.log('\nPhase 2: Checking from different connection...');
    
    const delays = [0, 50, 100, 200, 500, 1000];
    const results = {};
    
    for (const delay of delays) {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const found = await prisma2.qRCode.findUnique({
        where: { shortId: testShortId }
      });
      
      results[`delay_${delay}ms`] = found ? 'FOUND' : 'NOT_FOUND';
      console.log(`⏱️  After ${delay}ms delay: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      
      if (found) break; // Stop testing once found
    }
    
    // Phase 3: Verify with direct SQL
    console.log('\nPhase 3: Direct SQL verification...');
    
    const directSql = await prisma1.$queryRaw`
      SELECT id, short_id, name, created_at, user_id
      FROM qr_codes 
      WHERE short_id = ${testShortId}
    `;
    
    console.log('🔍 Direct SQL result:', directSql);
    
    // Cleanup
    await prisma1.qRCode.deleteMany({
      where: { shortId: testShortId }
    });
    
    return {
      createResult,
      consistencyResults: results,
      directSqlResult: directSql,
      passed: results.delay_0ms === 'FOUND' || results.delay_50ms === 'FOUND'
    };
    
  } catch (error) {
    console.error('❌ Transaction consistency test failed:', error);
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 3: Neon-Specific Configuration Analysis
 */
async function testNeonConfiguration() {
  console.log('\n🔍 TEST 3: NEON-SPECIFIC CONFIGURATION ANALYSIS');
  console.log('=' .repeat(60));
  
  try {
    // Check PostgreSQL version and Neon-specific settings
    const [version, settings, poolSettings] = await Promise.all([
      prisma1.$queryRaw`SELECT version()`,
      
      prisma1.$queryRaw`
        SELECT name, setting, context, short_desc
        FROM pg_settings 
        WHERE name IN (
          'default_transaction_isolation',
          'transaction_isolation',
          'synchronous_commit',
          'fsync',
          'wal_level',
          'max_connections',
          'shared_preload_libraries'
        )
        ORDER BY name
      `,
      
      prisma1.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity
      `
    ]);
    
    console.log('📊 PostgreSQL Version:', version[0].version);
    console.log('\n📊 Critical Settings:');
    settings.forEach(setting => {
      console.log(`  ${setting.name}: ${setting.setting} (${setting.context})`);
    });
    
    console.log('\n📊 Connection Pool Status:', poolSettings[0]);
    
    // Check for any locks or blocking queries
    const locks = await prisma1.$queryRaw`
      SELECT 
        blocked_locks.pid AS blocked_pid,
        blocked_activity.usename AS blocked_user,
        blocking_locks.pid AS blocking_pid,
        blocking_activity.usename AS blocking_user,
        blocked_activity.query AS blocked_statement,
        blocking_activity.query AS current_statement_in_blocking_process
      FROM pg_catalog.pg_locks blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks blocking_locks 
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
    `;
    
    console.log('\n🔒 Active Locks:', locks.length > 0 ? locks : 'None');
    
    return {
      version: version[0].version,
      settings: settings.reduce((acc, s) => ({ ...acc, [s.name]: s.setting }), {}),
      connections: poolSettings[0],
      locks: locks.length,
      neonDetected: version[0].version.includes('Neon') || version[0].version.includes('neon')
    };
    
  } catch (error) {
    console.error('❌ Neon configuration test failed:', error);
    return { error: error.message };
  }
}

/**
 * TEST 4: Database State Analysis
 */
async function testDatabaseState() {
  console.log('\n🔍 TEST 4: DATABASE STATE ANALYSIS');
  console.log('=' .repeat(60));
  
  try {
    // Get current database state
    const [userCount, qrCount, recentQRs, anonymousUser] = await Promise.all([
      prisma1.user.count(),
      prisma1.qRCode.count(),
      prisma1.qRCode.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      }),
      prisma1.user.findFirst({
        where: {
          OR: [
            { email: 'anonymous@demo.local' },
            { id: 'anonymous' }
          ]
        },
        include: {
          qrCodes: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ]);
    
    console.log('📊 Database Statistics:');
    console.log(`  Total Users: ${userCount}`);
    console.log(`  Total QR Codes: ${qrCount}`);
    
    console.log('\n📊 Recent QR Codes:');
    recentQRs.forEach(qr => {
      console.log(`  ${qr.shortId} - ${qr.name} (${qr.user.email}) - ${qr.createdAt}`);
    });
    
    console.log('\n📊 Anonymous User Analysis:');
    if (anonymousUser) {
      console.log(`  User ID: ${anonymousUser.id}`);
      console.log(`  Email: ${anonymousUser.email}`);
      console.log(`  QR Codes: ${anonymousUser.qrCodes.length}`);
      anonymousUser.qrCodes.forEach(qr => {
        console.log(`    ${qr.shortId} - ${qr.name} - ${qr.createdAt}`);
      });
    } else {
      console.log('  ❌ Anonymous user not found');
    }
    
    return {
      userCount,
      qrCount,
      recentQRs: recentQRs.length,
      anonymousUser: anonymousUser ? {
        id: anonymousUser.id,
        email: anonymousUser.email,
        qrCount: anonymousUser.qrCodes.length
      } : null
    };
    
  } catch (error) {
    console.error('❌ Database state test failed:', error);
    return { error: error.message };
  }
}

/**
 * TEST 5: Simulate Production QR Creation Flow
 */
async function testProductionFlow() {
  console.log('\n🔍 TEST 5: PRODUCTION QR CREATION FLOW SIMULATION');
  console.log('=' .repeat(60));
  
  const testShortId = `PROD_${Date.now()}`;
  
  try {
    console.log('🚀 Simulating production QR creation...');
    
    // Step 1: Ensure anonymous user (as done in production)
    const userResult = await prisma1.user.upsert({
      where: { email: 'anonymous@demo.local' },
      create: {
        email: 'anonymous@demo.local',
        name: 'User anonymous',
        plan: 'FREE'
      },
      update: {}
    });
    
    console.log('✅ Step 1 - User ensured:', userResult.id);
    
    // Step 2: Create QR code (exact production logic)
    const qrResult = await prisma1.qRCode.create({
      data: {
        name: 'Production Test QR',
        shortId: testShortId,
        targetUrl: 'https://example.com/production-test',
        enableAI: false,
        qrStyle: 'classic',
        qrColor: '#000000',
        qrSize: 256,
        qrOptions: null,
        userId: userResult.id,
      },
      include: {
        scans: true,
      },
    });
    
    console.log('✅ Step 2 - QR created:', qrResult.id);
    
    // Step 3: Immediate verification (read-after-write consistency)
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay as in production
    
    const verification = await prisma1.qRCode.findUnique({
      where: { shortId: testShortId }
    });
    
    console.log('✅ Step 3 - Verification:', verification ? 'FOUND' : 'NOT FOUND');
    
    // Step 4: Fetch user QRs (as done in dashboard)
    const userQRs = await prisma2.qRCode.findMany({
      where: { userId: userResult.id },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log('✅ Step 4 - User QRs fetched:', userQRs.length);
    
    // Step 5: Redirect test (as done in redirect function)
    const redirectQR = await prisma2.qRCode.findUnique({
      where: { shortId: testShortId },
      include: {
        variants: {
          where: { isActive: true },
        },
      },
    });
    
    console.log('✅ Step 5 - Redirect lookup:', redirectQR ? 'FOUND' : 'NOT FOUND');
    
    // Cleanup
    await prisma1.qRCode.deleteMany({
      where: { shortId: testShortId }
    });
    
    const allStepsPassed = verification && userQRs.length > 0 && redirectQR;
    
    return {
      passed: allStepsPassed,
      steps: {
        userEnsured: !!userResult,
        qrCreated: !!qrResult,
        verification: !!verification,
        userQRsFetched: userQRs.length > 0,
        redirectFound: !!redirectQR
      },
      details: {
        userId: userResult.id,
        qrId: qrResult.id,
        shortId: testShortId
      }
    };
    
  } catch (error) {
    console.error('❌ Production flow test failed:', error);
    return { passed: false, error: error.message };
  }
}

/**
 * Main debugging function
 */
async function runNeonPersistenceDebug() {
  console.log('🔬 NEON POSTGRESQL PERSISTENCE DEBUGGING TOOL');
  console.log('🚀 Starting comprehensive analysis...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    tests: {}
  };
  
  try {
    // Run all tests
    results.tests.connectionIsolation = await testConnectionIsolation();
    results.tests.transactionConsistency = await testTransactionConsistency();
    results.tests.neonConfiguration = await testNeonConfiguration();
    results.tests.databaseState = await testDatabaseState();
    results.tests.productionFlow = await testProductionFlow();
    
    // Analysis and recommendations
    console.log('\n🎯 ANALYSIS & RECOMMENDATIONS');
    console.log('=' .repeat(60));
    
    const issues = [];
    const recommendations = [];
    
    // Analyze connection isolation
    if (!results.tests.connectionIsolation.isolationPassed) {
      issues.push('🔴 Connection sharing detected between Prisma instances');
      recommendations.push('Configure separate connection pools for different functions');
    }
    
    // Analyze transaction consistency
    if (!results.tests.transactionConsistency.passed) {
      issues.push('🔴 Transaction consistency failure detected');
      recommendations.push('Implement stronger read-after-write consistency checks');
    }
    
    // Analyze Neon configuration
    const config = results.tests.neonConfiguration.settings;
    if (config?.default_transaction_isolation !== 'read committed') {
      issues.push('🔴 Non-standard transaction isolation level');
      recommendations.push('Verify transaction isolation level settings');
    }
    
    // Analyze production flow
    if (!results.tests.productionFlow.passed) {
      issues.push('🔴 Production flow simulation failed');
      recommendations.push('Review QR creation and fetching logic');
    }
    
    console.log('\n🔍 IDENTIFIED ISSUES:');
    if (issues.length === 0) {
      console.log('✅ No critical issues detected');
    } else {
      issues.forEach(issue => console.log(`  ${issue}`));
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (recommendations.length === 0) {
      console.log('✅ No specific recommendations');
    } else {
      recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    // Summary
    console.log('\n📋 DEBUGGING SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Connection Isolation: ${results.tests.connectionIsolation.isolationPassed ? '✅' : '❌'}`);
    console.log(`Transaction Consistency: ${results.tests.transactionConsistency.passed ? '✅' : '❌'}`);
    console.log(`Neon Configuration: ${results.tests.neonConfiguration.neonDetected ? '✅' : '❓'}`);
    console.log(`Database State: ${results.tests.databaseState.userCount > 0 ? '✅' : '❌'}`);
    console.log(`Production Flow: ${results.tests.productionFlow.passed ? '✅' : '❌'}`);
    
    // Transaction logs summary
    console.log('\n📜 TRANSACTION LOGS SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Queries: ${transactionLogs.length}`);
    
    const byInstance = transactionLogs.reduce((acc, log) => {
      acc[log.instance] = (acc[log.instance] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(byInstance).forEach(([instance, count]) => {
      console.log(`${instance} Instance: ${count} queries`);
    });
    
    const slowQueries = transactionLogs.filter(log => log.duration > 100);
    if (slowQueries.length > 0) {
      console.log(`\n🐌 Slow Queries (>100ms): ${slowQueries.length}`);
      slowQueries.forEach(log => {
        console.log(`  [${log.instance}] ${log.duration}ms: ${log.query.substring(0, 80)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debugging process failed:', error);
    results.error = error.message;
  } finally {
    // Cleanup connections
    await prisma1.$disconnect();
    await prisma2.$disconnect();
  }
  
  return results;
}

// Run the debugging tool
if (require.main === module) {
  runNeonPersistenceDebug()
    .then(results => {
      console.log('\n✅ Debugging completed. Results saved to neon-debug-results.json');
      require('fs').writeFileSync(
        'neon-debug-results.json', 
        JSON.stringify(results, null, 2)
      );
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runNeonPersistenceDebug };