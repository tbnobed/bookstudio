const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function createFavicon() {
  try {
    // Create a 180x180 canvas for the favicon
    const canvas = createCanvas(180, 180);
    const ctx = canvas.getContext('2d');
    
    // Background Circle
    ctx.fillStyle = '#0c4a6e';
    ctx.beginPath();
    ctx.arc(90, 90, 85, 0, Math.PI * 2);
    ctx.fill();
    
    // Camera Lens/Studio Element
    const gradient = ctx.createRadialGradient(90, 90, 0, 90, 90, 55);
    gradient.addColorStop(0, '#0284c7');
    gradient.addColorStop(1, '#0c4a6e');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(90, 90, 55, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(90, 90, 55, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#172554';
    ctx.beginPath();
    ctx.arc(90, 90, 30, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(90, 90, 30, 0, Math.PI * 2);
    ctx.stroke();
    
    // Record Indicator
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(135, 45, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Letter B for BookStud.io
    ctx.fillStyle = 'white';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', 90, 90);
    
    // Save the image as png
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('./public/favicon.png', buffer);
    
    // Create a smaller 32x32 version for favicon.ico
    const smallCanvas = createCanvas(32, 32);
    const smallCtx = smallCanvas.getContext('2d');
    smallCtx.drawImage(canvas, 0, 0, 32, 32);
    const smallBuffer = smallCanvas.toBuffer('image/png');
    fs.writeFileSync('./public/favicon-32x32.png', smallBuffer);
    
    // Create apple-touch-icon
    const touchCanvas = createCanvas(180, 180);
    const touchCtx = touchCanvas.getContext('2d');
    
    // Background with gradient
    touchCtx.fillStyle = '#0c4a6e';
    touchCtx.fillRect(0, 0, 180, 180);
    
    // Studio Camera Element
    const touchGradient = touchCtx.createRadialGradient(90, 90, 0, 90, 90, 55);
    touchGradient.addColorStop(0, '#0ea5e9');
    touchGradient.addColorStop(1, '#075985');
    
    touchCtx.fillStyle = touchGradient;
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 55, 0, Math.PI * 2);
    touchCtx.fill();
    
    touchCtx.strokeStyle = 'white';
    touchCtx.lineWidth = 4;
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 55, 0, Math.PI * 2);
    touchCtx.stroke();
    
    touchCtx.fillStyle = '#172554';
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 35, 0, Math.PI * 2);
    touchCtx.fill();
    
    touchCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    touchCtx.lineWidth = 2;
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 35, 0, Math.PI * 2);
    touchCtx.stroke();
    
    touchCtx.fillStyle = '#0c4a6e';
    touchCtx.beginPath();
    touchCtx.arc(90, 90, 10, 0, Math.PI * 2);
    touchCtx.fill();
    
    // Record Light
    touchCtx.fillStyle = '#ef4444';
    touchCtx.beginPath();
    touchCtx.arc(135, 45, 15, 0, Math.PI * 2);
    touchCtx.fill();
    
    touchCtx.fillStyle = '#ff6464';
    touchCtx.beginPath();
    touchCtx.arc(135, 45, 10, 0, Math.PI * 2);
    touchCtx.fill();
    
    // Text: BookStud.io
    touchCtx.fillStyle = 'white';
    touchCtx.font = 'bold 30px Arial';
    touchCtx.textAlign = 'center';
    touchCtx.textBaseline = 'middle';
    touchCtx.fillText('BS', 90, 90);
    
    // Save the apple touch icon
    const touchBuffer = touchCanvas.toBuffer('image/png');
    fs.writeFileSync('./public/apple-touch-icon.png', touchBuffer);
    
    console.log('Successfully created favicon.png, favicon-32x32.png, and apple-touch-icon.png');
  } catch (error) {
    console.error('Error creating PNG files:', error);
  }
}

createFavicon();