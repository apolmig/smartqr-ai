#!/usr/bin/env node

// Database Health Check Script
// Implements the recommended queries from the Neon SQL admin agent

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

async function runHealthCheck() {
  console.log('🔍 Running Database Health Check...\n');
  
  try {
    // 1. Verify current state
    console.log('1. Database Overview:');
    const [userCount] = await prisma.$queryRaw`SELECT COUNT(*) as total_users FROM users`;
    const [qrCount] = await prisma.$queryRaw`SELECT COUNT(*) as total_qrs FROM qr_codes`;
    console.log(`   - Total Users: ${userCount.total_users}`);
    console.log(`   - Total QR Codes: ${qrCount.total_qrs}\n`);

    // 2. Search for specific QR
    console.log('2. Searching for Recent QRs:');
    const recentQRs = await prisma.qRCode.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, shortId: true, name: true, targetUrl: true, createdAt: true }
    });
    console.log('   Recent QR Codes:');
    recentQRs.forEach(qr => {
      console.log(`   - ${qr.shortId}: "${qr.name}" -> ${qr.targetUrl} (${qr.createdAt})`);
    });

    // 3. Verify anonymous user
    console.log('\n3. Anonymous User Check:');
    const anonymousUser = await prisma.user.findUnique({
      where: { email: 'anonymous@demo.local' },
      include: { qrCodes: true }
    });
    if (anonymousUser) {
      console.log(`   ✅ Anonymous user exists: ${anonymousUser.id}`);
      console.log(`   - QR Codes: ${anonymousUser.qrCodes.length}`);
    } else {
      console.log('   ❌ Anonymous user NOT found');
      
      // Create anonymous user
      console.log('   🔧 Creating anonymous user...');
      const newUser = await prisma.user.create({
        data: {
          email: 'anonymous@demo.local',
          name: 'Anonymous User',
          plan: 'FREE'
        }
      });
      console.log(`   ✅ Created anonymous user: ${newUser.id}`);
    }

    // 4. Check referential integrity
    console.log('\n4. Referential Integrity Check:');
    const orphanedQRs = await prisma.$queryRaw`
      SELECT qr.*, u.email 
      FROM qr_codes qr 
      LEFT JOIN users u ON qr."userId" = u.id 
      WHERE u.id IS NULL
    `;
    console.log(`   - Orphaned QR Codes: ${orphanedQRs.length}`);

    // 5. Show active connections
    console.log('\n5. Database Connections:');
    try {
      const connections = await prisma.$queryRaw`
        SELECT count(*) as active_connections, state 
        FROM pg_stat_activity 
        WHERE datname = current_database() 
        GROUP BY state
      `;
      console.log('   Connection States:');
      connections.forEach(conn => {
        console.log(`   - ${conn.state}: ${conn.active_connections} connections`);
      });
    } catch (error) {
      console.log('   ⚠️  Could not fetch connection info (limited permissions)');
    }

    // 6. Test Create & Read Consistency
    console.log('\n6. Testing Create & Read Consistency:');
    const testShortId = `test-${Date.now()}`;
    
    // Create test QR
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      create: { email: 'test@example.com', name: 'Test User', plan: 'FREE' },
      update: {}
    });
    
    const testQR = await prisma.qRCode.create({
      data: {
        name: 'Consistency Test QR',
        shortId: testShortId,
        targetUrl: 'https://example.com',
        userId: testUser.id
      }
    });
    console.log(`   ✅ Created test QR: ${testQR.shortId}`);

    // Immediate read
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay as recommended
    const foundQR = await prisma.qRCode.findUnique({
      where: { shortId: testShortId }
    });
    
    if (foundQR) {
      console.log(`   ✅ Test QR found immediately: ${foundQR.id}`);
    } else {
      console.log(`   ❌ Test QR NOT found immediately - CONSISTENCY ISSUE`);
    }

    // Clean up test data
    await prisma.qRCode.delete({ where: { id: testQR.id } });
    console.log(`   🧹 Cleaned up test QR`);

    console.log('\n🎉 Health check completed successfully!');

  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runHealthCheck();
}

module.exports = { runHealthCheck };