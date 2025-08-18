// Seed data for testing AI features
import { db } from './db';
import { qrGenerator } from './qr';

export async function seedTestData() {
  // Create a test QR code
  const qrData = await qrGenerator.generateQRCode(
    'Demo Restaurant Menu',
    'https://example.com/menu'
  );

  const qrCode = await db.createQRCode({
    id: qrData.id,
    shortId: qrData.shortId,
    name: qrData.name,
    targetUrl: qrData.targetUrl,
    userId: 'demo-user',
    isActive: true,
    enableAI: true,
    totalScans: 0,
  });

  // Create some sample routing rules
  await db.createRoutingRule({
    id: 'rule-1',
    qrCodeId: qrCode.id,
    name: 'Mobile Users',
    condition: 'mobile',
    targetUrl: 'https://example.com/menu-mobile',
    priority: 10,
    isActive: true,
  });

  await db.createRoutingRule({
    id: 'rule-2',
    qrCodeId: qrCode.id,
    name: 'Business Hours',
    condition: 'business_hours',
    targetUrl: 'https://example.com/menu-business',
    priority: 5,
    isActive: true,
  });

  await db.createRoutingRule({
    id: 'rule-3',
    qrCodeId: qrCode.id,
    name: 'Weekend Special',
    condition: 'weekend',
    targetUrl: 'https://example.com/menu-weekend',
    priority: 7,
    isActive: true,
  });

  // Create some sample scan data
  const devices = ['mobile', 'desktop', 'tablet', 'mobile', 'mobile', 'desktop'];
  const oses = ['iOS', 'Windows', 'Android', 'iOS', 'Android', 'macOS'];
  const browsers = ['Safari', 'Chrome', 'Chrome', 'Safari', 'Chrome', 'Safari'];

  for (let i = 0; i < 25; i++) {
    const randomDevice = devices[Math.floor(Math.random() * devices.length)];
    const randomOS = oses[Math.floor(Math.random() * oses.length)];
    const randomBrowser = browsers[Math.floor(Math.random() * browsers.length)];
    
    // Spread scans across different times
    const hoursAgo = Math.floor(Math.random() * 168); // Last week
    const scanTime = new Date();
    scanTime.setHours(scanTime.getHours() - hoursAgo);

    await db.createScan({
      qrCodeId: qrCode.id,
      userAgent: `Test User Agent - ${randomBrowser}`,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
      device: randomDevice,
      os: randomOS,
      browser: randomBrowser,
    });

    // Update scan count
    await db.incrementScans(qrCode.id);
  }

  console.log('✅ Test data seeded successfully!');
  console.log(`📊 Created QR code: ${qrCode.name} (${qrCode.shortId})`);
  console.log(`🔗 Redirect URL: http://localhost:3000/r/${qrCode.shortId}`);
  console.log(`📈 Analytics URL: http://localhost:3000/dashboard/${qrCode.id}`);
}