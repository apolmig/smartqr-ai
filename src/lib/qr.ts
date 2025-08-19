import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import QRCodeStyling from 'qr-code-styling';

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
  // Basic options
  size?: number;
  margin?: number;
  
  // Color customization
  color?: {
    dark?: string;
    light?: string;
  };
  
  // Advanced styling options
  style?: {
    // QR pattern style
    dotType?: 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
    cornerSquareType?: 'square' | 'dot' | 'extra-rounded';
    cornerDotType?: 'square' | 'dot';
    
    // Colors
    backgroundColor?: string;
    gradientType?: 'linear' | 'radial';
    gradientDirection?: number; // 0-360 for linear
    gradientColorStops?: Array<{ offset: number; color: string }>;
    
    // Logo/image in center
    logo?: string; // base64 or URL
    logoSize?: number; // 0-1 (percentage of QR size)
    logoMargin?: number;
    logoCornerRadius?: number;
    
    // Pattern colors
    dotsColor?: string;
    cornerSquareColor?: string;
    cornerDotColor?: string;
  };
  
  // Error correction
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  
  // Output format
  format?: 'png' | 'svg' | 'webp';
  quality?: number; // 0-1
}

export class QRGenerator {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use environment variables with fallback
    this.baseUrl = baseUrl || 
                   process.env.NEXT_PUBLIC_BASE_URL || 
                   process.env.URL || 
                   'https://smartqr.es';
  }

  async generateQRCode(
    name: string,
    targetUrl: string,
    options: QRGenerateOptions = {}
  ): Promise<QRCodeData> {
    const id = uuidv4();
    const shortId = this.generateShortId();
    const redirectUrl = `${this.baseUrl}/r/${shortId}`;

    let qrCodeDataUrl: string;

    // Always use advanced styling when options.style is provided
    if (options.style && typeof window !== 'undefined') {
      // Client-side: use qr-code-styling library
      qrCodeDataUrl = await this.generateStyledQR(redirectUrl, options);
    } else if (options.style && typeof window === 'undefined') {
      // Server-side: use enhanced basic QR with style approximations
      qrCodeDataUrl = await this.generateServerStyledQR(redirectUrl, options);
    } else {
      // Basic QR generation
      const qrOptions = {
        width: options.size || 256,
        margin: options.margin || 2,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF',
        },
        errorCorrectionLevel: (options.errorCorrectionLevel || 'M') as 'L' | 'M' | 'Q' | 'H',
      };

      qrCodeDataUrl = await QRCode.toDataURL(redirectUrl, qrOptions);
    }

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

  // Server-side styled QR generation using basic library with enhanced styling
  private async generateServerStyledQR(data: string, options: QRGenerateOptions): Promise<string> {
    // Priority: user custom color > preset color > default
    let dotColor = options.color?.dark || '#000000';
    
    // Apply preset colors if available and no custom color specified
    if (options.style && !options.color?.dark) {
      const presets = this.getPresetStyles();
      const preset = presets[options.style as keyof typeof presets];
      if (preset && preset.dotsColor) {
        dotColor = preset.dotsColor;
      }
    }
    
    // For styled QRs, also check if style options contain color overrides
    if (options.style?.dotsColor) {
      dotColor = options.style.dotsColor;
    }
    
    console.log('Server-side QR generation with color:', dotColor, 'style:', options.style);
    
    // Generate QR with enhanced options
    const qrOptions = {
      width: options.size || 256,
      margin: options.margin || 2,
      color: {
        dark: dotColor,
        light: options.style?.backgroundColor || options.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: (options.errorCorrectionLevel || 'M') as 'L' | 'M' | 'Q' | 'H',
    };

    return await QRCode.toDataURL(data, qrOptions);
  }

  private async generateStyledQR(data: string, options: QRGenerateOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const qrCode = new QRCodeStyling({
          width: options.size || 256,
          height: options.size || 256,
          margin: options.margin || 10,
          data: data,
          
          // QR code styling
          qrOptions: {
            errorCorrectionLevel: options.errorCorrectionLevel || 'M'
          },
          
          // Dots styling
          dotsOptions: {
            color: options.style?.dotsColor || options.color?.dark || '#000000',
            type: options.style?.dotType || 'square'
          },
          
          // Corner squares styling
          cornersSquareOptions: {
            color: options.style?.cornerSquareColor || options.color?.dark || '#000000',
            type: options.style?.cornerSquareType || 'square'
          },
          
          // Corner dots styling
          cornersDotOptions: {
            color: options.style?.cornerDotColor || options.color?.dark || '#000000',
            type: options.style?.cornerDotType || 'square'
          },
          
          // Background
          backgroundOptions: {
            color: options.style?.backgroundColor || options.color?.light || '#ffffff'
          },
          
          // Logo/image in center
          imageOptions: options.style?.logo ? {
            hideBackgroundDots: true,
            imageSize: options.style.logoSize || 0.2,
            margin: options.style.logoMargin || 8,
            crossOrigin: 'anonymous'
          } : undefined,
          
          image: options.style?.logo || undefined
        });

        // Generate canvas and convert to data URL
        const canvas = document.createElement('canvas');
        qrCode.append(canvas);
        
        setTimeout(() => {
          const dataUrl = canvas.toDataURL('image/png', options.quality || 0.9);
          resolve(dataUrl);
        }, 100);
        
      } catch (error) {
        console.error('Error generating styled QR:', error);
        reject(error);
      }
    });
  }

  // Predefined styles for easy use
  getPresetStyles(): Record<string, Partial<QRGenerateOptions['style']>> {
    return {
      classic: {
        dotType: 'square',
        cornerSquareType: 'square',
        cornerDotType: 'square'
      },
      
      rounded: {
        dotType: 'rounded',
        cornerSquareType: 'extra-rounded',
        cornerDotType: 'dot'
      },
      
      dots: {
        dotType: 'dots',
        cornerSquareType: 'dot',
        cornerDotType: 'dot'
      },
      
      classy: {
        dotType: 'classy-rounded',
        cornerSquareType: 'extra-rounded',
        cornerDotType: 'dot'
      },
      
      gradient_blue: {
        dotType: 'rounded',
        cornerSquareType: 'extra-rounded',
        dotsColor: '#3B82F6',
        cornerSquareColor: '#1E40AF',
        cornerDotColor: '#1E40AF',
        backgroundColor: '#EFF6FF'
      },
      
      gradient_purple: {
        dotType: 'classy-rounded',
        cornerSquareType: 'extra-rounded',
        dotsColor: '#8B5CF6',
        cornerSquareColor: '#6D28D9',
        cornerDotColor: '#6D28D9',
        backgroundColor: '#F3E8FF'
      },
      
      smartqr_brand: {
        dotType: 'rounded',
        cornerSquareType: 'extra-rounded',
        cornerDotType: 'dot',
        dotsColor: '#3B82F6',
        cornerSquareColor: '#8B5CF6',
        cornerDotColor: '#8B5CF6',
        backgroundColor: '#ffffff'
      }
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

  // Helper method to convert image to base64 for logo embedding
  async imageToBase64(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx?.drawImage(img, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      };
      
      img.onerror = reject;
      img.src = imageUrl;
    });
  }
}

export const qrGenerator = new QRGenerator();

// Export preset styles for easy access
export const QR_PRESET_STYLES = {
  CLASSIC: 'classic',
  ROUNDED: 'rounded', 
  DOTS: 'dots',
  CLASSY: 'classy',
  GRADIENT_BLUE: 'gradient_blue',
  GRADIENT_PURPLE: 'gradient_purple',
  SMARTQR_BRAND: 'smartqr_brand'
} as const;

export type QRPresetStyle = typeof QR_PRESET_STYLES[keyof typeof QR_PRESET_STYLES];