// Simple in-memory database for MVP
// Will be replaced with Prisma once configured

export interface QRCode {
  id: string;
  shortId: string;
  name: string;
  targetUrl: string;
  totalScans: number;
  isActive: boolean;
  enableAI: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  routingRules?: RoutingRule[];
}

export interface RoutingRule {
  id: string;
  qrCodeId: string;
  name: string;
  condition: string;
  targetUrl: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Scan {
  id: string;
  qrCodeId: string;
  userAgent?: string;
  ipAddress?: string;
  device?: string;
  os?: string;
  browser?: string;
  scannedAt: Date;
}

// In-memory storage
const qrCodes: Map<string, QRCode> = new Map();
const qrCodesByShortId: Map<string, QRCode> = new Map();
const qrCodesByUserId: Map<string, QRCode[]> = new Map();
const scans: Map<string, Scan[]> = new Map();
const routingRules: Map<string, RoutingRule[]> = new Map();

export class MemoryDB {
  // QR Code operations
  async createQRCode(data: Omit<QRCode, 'createdAt' | 'updatedAt'>): Promise<QRCode> {
    const qrCode: QRCode = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    qrCodes.set(qrCode.id, qrCode);
    qrCodesByShortId.set(qrCode.shortId, qrCode);
    
    const userQRs = qrCodesByUserId.get(qrCode.userId) || [];
    userQRs.push(qrCode);
    qrCodesByUserId.set(qrCode.userId, userQRs);
    
    return qrCode;
  }

  async findQRCodeByShortId(shortId: string): Promise<QRCode | null> {
    return qrCodesByShortId.get(shortId) || null;
  }

  async findQRCodesByUserId(userId: string): Promise<QRCode[]> {
    return qrCodesByUserId.get(userId) || [];
  }

  async updateQRCode(id: string, data: Partial<QRCode>): Promise<QRCode | null> {
    const qrCode = qrCodes.get(id);
    if (!qrCode) return null;

    const updated = { ...qrCode, ...data, updatedAt: new Date() };
    qrCodes.set(id, updated);
    qrCodesByShortId.set(updated.shortId, updated);
    
    return updated;
  }

  async incrementScans(id: string): Promise<void> {
    const qrCode = qrCodes.get(id);
    if (qrCode) {
      qrCode.totalScans += 1;
      qrCode.updatedAt = new Date();
    }
  }

  // Scan operations
  async createScan(data: Omit<Scan, 'id' | 'scannedAt'>): Promise<Scan> {
    const scan: Scan = {
      ...data,
      id: crypto.randomUUID(),
      scannedAt: new Date(),
    };

    const qrScans = scans.get(data.qrCodeId) || [];
    qrScans.push(scan);
    scans.set(data.qrCodeId, qrScans);

    return scan;
  }

  async getScansByQRCodeId(qrCodeId: string): Promise<Scan[]> {
    return scans.get(qrCodeId) || [];
  }

  async getScanCount(qrCodeId: string): Promise<number> {
    const qrScans = scans.get(qrCodeId) || [];
    return qrScans.length;
  }

  // Routing Rules operations
  async createRoutingRule(data: Omit<RoutingRule, 'createdAt'>): Promise<RoutingRule> {
    const rule: RoutingRule = {
      ...data,
      createdAt: new Date(),
    };

    const qrRules = routingRules.get(data.qrCodeId) || [];
    qrRules.push(rule);
    routingRules.set(data.qrCodeId, qrRules);

    return rule;
  }

  async getRoutingRules(qrCodeId: string): Promise<RoutingRule[]> {
    return routingRules.get(qrCodeId) || [];
  }

  async updateRoutingRule(ruleId: string, qrCodeId: string, data: Partial<RoutingRule>): Promise<RoutingRule | null> {
    const qrRules = routingRules.get(qrCodeId) || [];
    const ruleIndex = qrRules.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex === -1) return null;

    qrRules[ruleIndex] = { ...qrRules[ruleIndex], ...data };
    routingRules.set(qrCodeId, qrRules);

    return qrRules[ruleIndex];
  }

  async deleteRoutingRule(ruleId: string, qrCodeId: string): Promise<boolean> {
    const qrRules = routingRules.get(qrCodeId) || [];
    const filteredRules = qrRules.filter(rule => rule.id !== ruleId);
    
    if (filteredRules.length === qrRules.length) return false;
    
    routingRules.set(qrCodeId, filteredRules);
    return true;
  }

  // Analytics operations
  async getAnalytics(qrCodeId: string): Promise<{
    totalScans: number;
    deviceBreakdown: Record<string, number>;
    timePatterns: Record<string, number>;
    recentScans: Scan[];
  }> {
    const qrScans = scans.get(qrCodeId) || [];
    
    const deviceBreakdown: Record<string, number> = {};
    const timePatterns: Record<string, number> = {};
    
    qrScans.forEach(scan => {
      // Device breakdown
      const device = scan.device || 'unknown';
      deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
      
      // Time patterns
      const hour = scan.scannedAt.getHours();
      const isBusinessHours = hour >= 9 && hour <= 17;
      const timeKey = isBusinessHours ? 'business_hours' : 'after_hours';
      timePatterns[timeKey] = (timePatterns[timeKey] || 0) + 1;
    });

    return {
      totalScans: qrScans.length,
      deviceBreakdown,
      timePatterns,
      recentScans: qrScans.slice(-10).reverse() // Last 10 scans
    };
  }
}

export const db = new MemoryDB();