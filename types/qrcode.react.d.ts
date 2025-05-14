declare module 'qrcode.react' {
    import React from 'react';
  
    interface QRCodeProps {
      value: string;
      size?: number;
      level?: 'L' | 'M' | 'Q' | 'H';
      includeMargin?: boolean;
      bgColor?: string;
      fgColor?: string;
    }
  
    const QRCode: React.ComponentType<QRCodeProps>;
  
    export default QRCode;
  }