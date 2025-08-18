import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

export interface QRCodeData {
  id: string;
  shortId: string;
  name: string;
  targetUrl: string;
  qrCodeDataUrl: string;
  isActive: boolean;
  enableAI: boolean;
  totalScans: number;
  createdAt: Date;
}

export interface QRGenerateOptions {
  size?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export class QRGenerator {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://smartqr.ai') {
    this.baseUrl = baseUrl;
  }

  async generateQRCode(
    name: string,
    targetUrl: string,
    options: QRGenerateOptions = {}
  ): Promise<QRCodeData> {
    const id = uuidv4();
    const shortId = this.generateShortId();
    const redirectUrl = `${this.baseUrl}/r/${shortId}`;

    const qrOptions = {
      width: options.size || 256,
      margin: options.margin || 2,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: 'M' as const,
    };

    const qrCodeDataUrl = await QRCode.toDataURL(redirectUrl, qrOptions);

    return {
      id,
      shortId,
      name,
      targetUrl,
      qrCodeDataUrl,
      isActive: true,
      enableAI: false,
      totalScans: 0,
      createdAt: new Date(),
    };
  }

  private generateShortId(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  formatUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }
}

export const qrGenerator = new QRGenerator();