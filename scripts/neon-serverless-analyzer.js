#!/usr/bin/env node

/**
 * NEON SERVERLESS ARCHITECTURE ANALYZER
 * 
 * This script analyzes Neon-specific serverless issues that can cause
 * persistence problems in PostgreSQL connections.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class NeonServerlessAnalyzer {
  constructor() {
    this.testResults = {};
    this.connectionTests = [];
    this.performanceMetrics = [];
  }

  /**
   * Parse Neon connection string to extract configuration
   */
  parseNeonConnectionString(connectionString) {
    try {
      const url = new URL(connectionString);
      const params = new URLSearchParams(url.search);
      
      return {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.substring(1),
        username: url.username,
        sslMode: params.get('sslmode') || 'prefer',
        pgBouncer: params.get('pgbouncer') === 'true',
        connectionLimit: parseInt(params.get('connection_limit') || '10'),
        poolTimeout: parseInt(params.get('pool_timeout') || '10'),
        connectTimeout: parseInt(params.get('connect_timeout') || '10'),
        statementTimeout: params.get('statement_timeout'),
        idleInTransactionTimeout: params.get('idle_in_transaction_session_timeout'),
        applicationName: params.get('application_name'),
        isNeonHost: url.hostname.includes('neon.tech') || url.hostname.includes('neon.'),
        region: this.extractRegionFromHost(url.hostname)
      };
    } catch (error) {
      return { error: error.message, isNeonHost: false };
    }
  }

  extractRegionFromHost(hostname) {
    const regionMatch = hostname.match(/([a-z]+-[a-z]+-\d+)/);
    return regionMatch ? regionMatch[1] : 'unknown';
  }

  /**
   * Test 1: Neon Connection Configuration Analysis
   */
  async testNeonConfiguration() {
    console.log('\n🔍 TEST 1: NEON CONFIGURATION ANALYSIS');
    console.log('=' .repeat(60));

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return { error: 'DATABASE_URL not found' };
    }

    const config = this.parseNeonConnectionString(connectionString);
    console.log('📊 Connection Configuration:', JSON.stringify(config, null, 2));

    const issues = [];
    const recommendations = [];

    // Check if it's actually Neon
    if (!config.isNeonHost) {
      issues.push('⚠️  Not using Neon hosting (hostname analysis)');
    }

    // Check PgBouncer configuration
    if (!config.pgBouncer) {
      issues.push('🔴 PgBouncer not enabled - critical for serverless');
      recommendations.push('Add pgbouncer=true to connection string');
    }

    // Check connection limits
    if (config.connectionLimit > 10) {
      issues.push(`⚠️  High connection limit (${config.connectionLimit}) may cause issues in serverless`);
      recommendations.push('Reduce connection_limit to 5 for serverless functions');
    }

    // Check timeouts
    if (!config.statementTimeout) {
      issues.push('⚠️  No statement timeout configured');
      recommendations.push('Add statement_timeout=30s for better error handling');
    }

    if (!config.idleInTransactionTimeout) {
      issues.push('⚠️  No idle transaction timeout configured');
      recommendations.push('Add idle_in_transaction_session_timeout=10s');
    }

    // Check application name
    if (!config.applicationName) {
      issues.push('⚠️  No application name for monitoring');
      recommendations.push('Add application_name for better observability');
    }

    return {
      config,
      issues,
      recommendations,
      isNeonOptimized: issues.length === 0
    };
  }

  /**
   * Test 2: Connection Pool Behavior Analysis
   */
  async testConnectionPoolBehavior() {
    console.log('\n🔍 TEST 2: CONNECTION POOL BEHAVIOR ANALYSIS');
    console.log('=' .repeat(60));

    const clients = [];
    const connectionInfos = [];

    try {
      // Create multiple Prisma clients to test pool behavior
      console.log('Creating multiple database connections...');
      
      for (let i = 0; i < 5; i++) {
        const client = new PrismaClient({
          log: ['warn', 'error'],
        });
        clients.push(client);

        // Get connection info for each client
        const [connectionInfo] = await client.$queryRaw`
          SELECT 
            pg_backend_pid() as backend_pid,
            application_name,
            client_addr,
            backend_start,
            state,
            current_timestamp as query_time
          FROM pg_stat_activity 
          WHERE pid = pg_backend_pid()
        `;

        connectionInfos.push({
          clientIndex: i,
          ...connectionInfo
        });

        console.log(`Client ${i}: Backend PID ${connectionInfo.backend_pid}`);
      }

      // Analyze connection patterns
      const uniquePids = new Set(connectionInfos.map(info => info.backend_pid));
      const connectionSharing = uniquePids.size < clients.length;

      console.log(`\n📊 Connection Analysis:`);
      console.log(`Total clients: ${clients.length}`);
      console.log(`Unique backend PIDs: ${uniquePids.size}`);
      console.log(`Connection sharing: ${connectionSharing ? 'YES' : 'NO'}`);

      // Test concurrent queries
      console.log('\nTesting concurrent query behavior...');
      const startTime = Date.now();

      const concurrentResults = await Promise.all(
        clients.map(async (client, index) => {
          const queryStart = Date.now();
          const result = await client.$queryRaw`SELECT ${index} as client_id, pg_backend_pid() as pid, now() as query_time`;
          const queryDuration = Date.now() - queryStart;
          return { clientIndex: index, result: result[0], duration: queryDuration };
        })
      );

      const totalTime = Date.now() - startTime;

      console.log('\n📊 Concurrent Query Results:');
      concurrentResults.forEach(({ clientIndex, result, duration }) => {
        console.log(`Client ${clientIndex}: PID ${result.pid}, Duration: ${duration}ms`);
      });

      console.log(`Total concurrent execution time: ${totalTime}ms`);

      return {
        connectionSharing,
        uniqueConnections: uniquePids.size,
        totalClients: clients.length,
        concurrentQueryTime: totalTime,
        connectionInfos,
        concurrentResults,
        poolEfficient: !connectionSharing && totalTime < 1000
      };

    } finally {
      // Cleanup
      await Promise.all(clients.map(client => client.$disconnect()));
    }
  }

  /**
   * Test 3: Cold Start Performance Analysis
   */
  async testColdStartPerformance() {
    console.log('\n🔍 TEST 3: COLD START PERFORMANCE ANALYSIS');
    console.log('=' .repeat(60));

    const iterations = 5;
    const coldStarts = [];

    for (let i = 0; i < iterations; i++) {
      console.log(`Cold start test ${i + 1}/${iterations}...`);
      
      const overallStart = Date.now();
      
      // Create fresh client (simulates cold start)
      const client = new PrismaClient();
      const clientCreateTime = Date.now() - overallStart;

      // First connection
      const connectStart = Date.now();
      const [connectResult] = await client.$queryRaw`SELECT 1 as health, now() as connect_time`;
      const connectTime = Date.now() - connectStart;

      // First real query
      const queryStart = Date.now();
      const userCount = await client.user.count();
      const queryTime = Date.now() - queryStart;

      // Second query (should be faster)
      const secondQueryStart = Date.now();
      const qrCount = await client.qRCode.count();
      const secondQueryTime = Date.now() - secondQueryStart;

      const totalTime = Date.now() - overallStart;

      const metrics = {
        iteration: i + 1,
        clientCreateTime,
        connectTime,
        firstQueryTime: queryTime,
        secondQueryTime,
        totalTime,
        userCount,
        qrCount
      };

      coldStarts.push(metrics);

      console.log(`  Client creation: ${clientCreateTime}ms`);
      console.log(`  First connection: ${connectTime}ms`);
      console.log(`  First query: ${queryTime}ms`);
      console.log(`  Second query: ${secondQueryTime}ms`);
      console.log(`  Total time: ${totalTime}ms\n`);

      await client.$disconnect();

      // Wait between iterations to ensure cold start
      if (i < iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Calculate averages
    const avgClientCreate = coldStarts.reduce((sum, m) => sum + m.clientCreateTime, 0) / iterations;
    const avgConnect = coldStarts.reduce((sum, m) => sum + m.connectTime, 0) / iterations;
    const avgFirstQuery = coldStarts.reduce((sum, m) => sum + m.firstQueryTime, 0) / iterations;
    const avgSecondQuery = coldStarts.reduce((sum, m) => sum + m.secondQueryTime, 0) / iterations;
    const avgTotal = coldStarts.reduce((sum, m) => sum + m.totalTime, 0) / iterations;

    console.log('📊 Cold Start Averages:');
    console.log(`  Client Creation: ${Math.round(avgClientCreate)}ms`);
    console.log(`  Connection: ${Math.round(avgConnect)}ms`);
    console.log(`  First Query: ${Math.round(avgFirstQuery)}ms`);
    console.log(`  Second Query: ${Math.round(avgSecondQuery)}ms`);
    console.log(`  Total: ${Math.round(avgTotal)}ms`);

    const performanceIssues = [];
    if (avgTotal > 3000) performanceIssues.push('High average cold start time (>3s)');
    if (avgConnect > 1000) performanceIssues.push('Slow connection establishment (>1s)');
    if (avgFirstQuery > 500) performanceIssues.push('Slow first query execution (>500ms)');

    return {
      iterations,
      coldStarts,
      averages: {
        clientCreate: Math.round(avgClientCreate),
        connect: Math.round(avgConnect),
        firstQuery: Math.round(avgFirstQuery),
        secondQuery: Math.round(avgSecondQuery),
        total: Math.round(avgTotal)
      },
      performanceIssues,
      acceptable: avgTotal < 2000 && avgConnect < 800
    };
  }

  /**
   * Test 4: Serverless Function Simulation
   */
  async testServerlessFunctionSimulation() {
    console.log('\n🔍 TEST 4: SERVERLESS FUNCTION SIMULATION');
    console.log('=' .repeat(60));

    // Simulate the exact pattern used in Netlify Functions
    const simulations = [];

    for (let i = 0; i < 3; i++) {
      console.log(`Function simulation ${i + 1}/3...`);
      
      const functionStart = Date.now();

      // Simulate function handler pattern
      const result = await this.simulateQRCreationFunction(`test-user-${i}`, {
        name: `Test QR ${i}`,
        targetUrl: `https://example.com/test-${i}`
      });

      const functionTime = Date.now() - functionStart;
      
      console.log(`  Function execution: ${functionTime}ms`);
      console.log(`  QR Creation: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  Consistency: ${result.consistencyPassed ? 'PASSED' : 'FAILED'}`);

      simulations.push({
        iteration: i + 1,
        functionTime,
        success: result.success,
        consistencyPassed: result.consistencyPassed,
        details: result
      });

      // Cleanup
      if (result.qrId) {
        try {
          const cleanupClient = new PrismaClient();
          await cleanupClient.qRCode.delete({ where: { id: result.qrId } });
          await cleanupClient.$disconnect();
        } catch (e) {
          console.warn('Cleanup failed:', e.message);
        }
      }

      // Wait between simulations
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successRate = (simulations.filter(s => s.success).length / simulations.length) * 100;
    const consistencyRate = (simulations.filter(s => s.consistencyPassed).length / simulations.length) * 100;
    const avgFunctionTime = simulations.reduce((sum, s) => sum + s.functionTime, 0) / simulations.length;

    console.log('\n📊 Serverless Simulation Results:');
    console.log(`  Success Rate: ${successRate}%`);
    console.log(`  Consistency Rate: ${consistencyRate}%`);
    console.log(`  Average Function Time: ${Math.round(avgFunctionTime)}ms`);

    return {
      simulations,
      successRate,
      consistencyRate,
      avgFunctionTime: Math.round(avgFunctionTime),
      acceptable: successRate >= 100 && consistencyRate >= 100
    };
  }

  /**
   * Simulate the exact QR creation function pattern
   */
  async simulateQRCreationFunction(userId, qrData) {
    const client = new PrismaClient({
      log: ['warn', 'error'],
    });

    try {
      // Step 1: Ensure user (as in production)
      const user = await client.user.upsert({
        where: { email: `${userId}@demo.local` },
        create: {
          email: `${userId}@demo.local`,
          name: `User ${userId}`,
          plan: 'FREE'
        },
        update: {}
      });

      // Step 2: Create QR code
      const shortId = this.generateTestShortId();
      const qrCode = await client.qRCode.create({
        data: {
          name: qrData.name,
          shortId,
          targetUrl: qrData.targetUrl,
          enableAI: false,
          qrStyle: 'classic',
          qrColor: '#000000',
          qrSize: 256,
          userId: user.id,
        },
        include: {
          scans: true,
        },
      });

      // Step 3: Immediate verification (as done in production)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const verification = await client.qRCode.findUnique({
        where: { shortId }
      });

      // Step 4: Fetch user QRs (as done in dashboard)
      const userQRs = await client.qRCode.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      const consistencyPassed = verification && userQRs.some(qr => qr.shortId === shortId);

      return {
        success: true,
        qrId: qrCode.id,
        shortId,
        userId: user.id,
        consistencyPassed,
        verification: !!verification,
        userQRCount: userQRs.length,
        foundInUserQRs: userQRs.some(qr => qr.shortId === shortId)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        consistencyPassed: false
      };
    } finally {
      await client.$disconnect();
    }
  }

  generateTestShortId() {
    return 'TEST_' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Test 5: Memory and Resource Usage
   */
  async testResourceUsage() {
    console.log('\n🔍 TEST 5: MEMORY AND RESOURCE USAGE');
    console.log('=' .repeat(60));

    const initialMemory = process.memoryUsage();
    console.log('Initial memory usage:', this.formatMemoryUsage(initialMemory));

    const clients = [];
    const memorySnapshots = [];

    try {
      // Create clients and monitor memory
      for (let i = 0; i < 10; i++) {
        const client = new PrismaClient();
        clients.push(client);

        // Execute a query to establish connection
        await client.$queryRaw`SELECT 1`;

        const memory = process.memoryUsage();
        memorySnapshots.push({
          clientCount: i + 1,
          memory: memory,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
          rss: memory.rss
        });

        console.log(`Client ${i + 1}: Heap ${this.formatBytes(memory.heapUsed)}, RSS ${this.formatBytes(memory.rss)}`);
      }

      // Test memory after operations
      console.log('\nPerforming database operations...');
      
      await Promise.all(clients.map(async (client, index) => {
        await client.user.findMany({ take: 1 });
        await client.qRCode.findMany({ take: 1 });
      }));

      const finalMemory = process.memoryUsage();
      console.log('\nFinal memory usage:', this.formatMemoryUsage(finalMemory));

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerClient = memoryIncrease / clients.length;

      console.log(`Memory increase: ${this.formatBytes(memoryIncrease)}`);
      console.log(`Memory per client: ${this.formatBytes(memoryPerClient)}`);

      return {
        initialMemory,
        finalMemory,
        memoryIncrease,
        memoryPerClient,
        memorySnapshots,
        acceptable: memoryPerClient < 10 * 1024 * 1024 // < 10MB per client
      };

    } finally {
      // Cleanup
      await Promise.all(clients.map(client => client.$disconnect()));
    }
  }

  formatMemoryUsage(memory) {
    return {
      rss: this.formatBytes(memory.rss),
      heapTotal: this.formatBytes(memory.heapTotal),
      heapUsed: this.formatBytes(memory.heapUsed),
      external: this.formatBytes(memory.external)
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Run all tests and generate comprehensive report
   */
  async runAllTests() {
    console.log('🚀 NEON SERVERLESS ARCHITECTURE ANALYZER');
    console.log('🔬 Analyzing serverless-specific issues...\n');

    const results = {
      timestamp: new Date().toISOString(),
      neonConfiguration: await this.testNeonConfiguration(),
      connectionPoolBehavior: await this.testConnectionPoolBehavior(),
      coldStartPerformance: await this.testColdStartPerformance(),
      serverlessSimulation: await this.testServerlessFunctionSimulation(),
      resourceUsage: await this.testResourceUsage()
    };

    // Generate comprehensive analysis
    console.log('\n🎯 NEON SERVERLESS ANALYSIS SUMMARY');
    console.log('=' .repeat(60));

    const issues = [];
    const recommendations = [];

    // Analyze configuration
    if (results.neonConfiguration.issues?.length > 0) {
      issues.push(...results.neonConfiguration.issues);
      recommendations.push(...results.neonConfiguration.recommendations);
    }

    // Analyze connection pooling
    if (!results.connectionPoolBehavior.poolEfficient) {
      issues.push('🔴 Inefficient connection pooling detected');
      recommendations.push('Optimize connection pooling configuration');
    }

    // Analyze cold start performance
    if (!results.coldStartPerformance.acceptable) {
      issues.push('🔴 Poor cold start performance');
      recommendations.push('Implement connection warming or persistent connections');
    }

    // Analyze serverless simulation
    if (!results.serverlessSimulation.acceptable) {
      issues.push('🔴 Serverless function simulation failures');
      recommendations.push('Review transaction handling and consistency checks');
    }

    // Analyze resource usage
    if (!results.resourceUsage.acceptable) {
      issues.push('🔴 High memory usage per client');
      recommendations.push('Implement connection reuse and client pooling');
    }

    console.log('\n🔍 IDENTIFIED ISSUES:');
    if (issues.length === 0) {
      console.log('✅ No critical serverless issues detected');
    } else {
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\n💡 RECOMMENDATIONS:');
    if (recommendations.length === 0) {
      console.log('✅ Configuration appears optimal for serverless');
    } else {
      recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    // Overall health score
    const healthChecks = [
      results.neonConfiguration.isNeonOptimized,
      results.connectionPoolBehavior.poolEfficient,
      results.coldStartPerformance.acceptable,
      results.serverlessSimulation.acceptable,
      results.resourceUsage.acceptable
    ];

    const healthScore = (healthChecks.filter(Boolean).length / healthChecks.length) * 100;

    console.log('\n📊 OVERALL SERVERLESS HEALTH SCORE');
    console.log('=' .repeat(60));
    console.log(`Health Score: ${Math.round(healthScore)}% (${healthChecks.filter(Boolean).length}/${healthChecks.length} checks passed)`);

    if (healthScore >= 80) {
      console.log('✅ Good serverless configuration');
    } else if (healthScore >= 60) {
      console.log('⚠️  Acceptable but needs optimization');
    } else {
      console.log('🔴 Poor serverless configuration - immediate attention required');
    }

    results.analysis = {
      issues,
      recommendations,
      healthScore: Math.round(healthScore),
      healthChecks: {
        configuration: results.neonConfiguration.isNeonOptimized,
        connectionPool: results.connectionPoolBehavior.poolEfficient,
        coldStart: results.coldStartPerformance.acceptable,
        serverlessSimulation: results.serverlessSimulation.acceptable,
        resourceUsage: results.resourceUsage.acceptable
      }
    };

    return results;
  }
}

// Run the analyzer
if (require.main === module) {
  const analyzer = new NeonServerlessAnalyzer();
  
  analyzer.runAllTests()
    .then(results => {
      console.log('\n✅ Analysis completed. Results saved to neon-serverless-analysis.json');
      require('fs').writeFileSync(
        'neon-serverless-analysis.json', 
        JSON.stringify(results, null, 2)
      );
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { NeonServerlessAnalyzer };