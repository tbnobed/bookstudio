import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

async function createIcons() {
  try {
    // Create a 180x180 canvas for the apple touch icon
    const touchIconCanvas = createCanvas(180, 180);
    const touchCtx = touchIconCanvas.getContext('2d');
    
    // Background - Blue gradient rectangle
    touchCtx.fillStyle = '#0c4a6e';
    touchCtx.fillRect(0, 0, 180, 180);
    
    // Camera lens circle
    touchCtx.fillStyle = '#0ea5e9';
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 55, 0, Math.PI * 2);
    touchCtx.fill();
    
    // White border around lens
    touchCtx.strokeStyle = 'white';
    touchCtx.lineWidth = 4;
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 55, 0, Math.PI * 2);
    touchCtx.stroke();
    
    // Inner lens darker blue
    touchCtx.fillStyle = '#172554';
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 35, 0, Math.PI * 2);
    touchCtx.fill();
    
    // Record light (red circle in top right)
    touchCtx.fillStyle = '#ef4444';
    touchCtx.beginPath();
    touchCtx.arc(135, 45, 15, 0, Math.PI * 2);
    touchCtx.fill();
    
    // Center pupil
    touchCtx.fillStyle = '#0c4a6e';
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 10, 0, Math.PI * 2);
    touchCtx.fill();
    
    // "BS" text in center
    touchCtx.fillStyle = 'white';
    touchCtx.font = 'bold 40px Arial';
    touchCtx.textAlign = 'center';
    touchCtx.textBaseline = 'middle';
    touchCtx.fillText('BS', 90, 90);
    
    // Save apple-touch-icon.png
    const touchIconBuffer = touchIconCanvas.toBuffer('image/png');
    fs.writeFileSync('public/apple-touch-icon.png', touchIconBuffer);
    
    // Create favicon.png (48x48)
    const faviconCanvas = createCanvas(48, 48);
    const faviconCtx = faviconCanvas.getContext('2d');
    
    // Background circle
    faviconCtx.fillStyle = '#0c4a6e';
    faviconCtx.beginPath();
    faviconCtx.arc(24, 24, 22, 0, Math.PI * 2);
    faviconCtx.fill();
    
    // Camera lens
    faviconCtx.fillStyle = '#0ea5e9';
    faviconCtx.beginPath();
    faviconCtx.arc(24, 24, 14, 0, Math.PI * 2);
    faviconCtx.fill();
    
    // White border around lens
    faviconCtx.strokeStyle = 'white';
    faviconCtx.lineWidth = 1.5;
    faviconCtx.beginPath();
    faviconCtx.arc(24, 24, 14, 0, Math.PI * 2);
    faviconCtx.stroke();
    
    // Inner lens
    faviconCtx.fillStyle = '#172554';
    faviconCtx.beginPath();
    faviconCtx.arc(24, 24, 8, 0, Math.PI * 2);
    faviconCtx.fill();
    
    // Record light (red circle in top right)
    faviconCtx.fillStyle = '#ef4444';
    faviconCtx.beginPath();
    faviconCtx.arc(36, 12, 4, 0, Math.PI * 2);
    faviconCtx.fill();
    
    // "B" text in center
    faviconCtx.fillStyle = 'white';
    faviconCtx.font = 'bold 14px Arial';
    faviconCtx.textAlign = 'center';
    faviconCtx.textBaseline = 'middle';
    faviconCtx.fillText('B', 24, 24);
    
    // Save favicon.png
    const faviconBuffer = faviconCanvas.toBuffer('image/png');
    fs.writeFileSync('public/favicon.png', faviconBuffer);
    
    // Create favicon-32x32.png
    const favicon32Canvas = createCanvas(32, 32);
    const favicon32Ctx = favicon32Canvas.getContext('2d');
    favicon32Ctx.drawImage(faviconCanvas, 0, 0, 48, 48, 0, 0, 32, 32);
    const favicon32Buffer = favicon32Canvas.toBuffer('image/png');
    fs.writeFileSync('public/favicon-32x32.png', favicon32Buffer);
    
    console.log('Successfully created icon PNG files!');
  } catch (error) {
    console.error('Error creating PNG icons:', error);
  }
}

createIcons();