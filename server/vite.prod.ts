/**
 * Production-ready replacement for vite.ts
 * This file provides a minimal implementation for production environments.
 */

import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// In production mode, we only need to serve static files
export async function configureVite(app: Express, serverRoot: string, clientRoot: string): Promise<void> {
  console.log('Configuring static file serving for production environment');
  
  // Serve all static assets from the client/dist directory
  const staticDir = path.resolve(clientRoot, 'dist');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
  }
  
  // Fallback to index.html for SPA routing
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Skip WebSocket routes
    if (req.path.startsWith('/ws')) {
      return next();
    }
    
    // Skip uploads folder
    if (req.path.startsWith('/uploads/')) {
      return next();
    }
    
    // Serve index.html for all other routes (SPA client-side routing)
    const indexHtml = path.resolve(staticDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      next(new Error('index.html not found'));
    }
  });
}

// Production static file serving
export function serveStatic(app: Express): void {
  log('Setting up static file serving for production');
  
  // In standard build mode with Vite, files are in the 'dist' directory
  const staticDir = path.resolve(process.cwd(), 'dist');
  
  // Also serve files from the public directory
  const publicDir = path.resolve(process.cwd(), 'public');
  
  // Also serve files from uploads directory
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  
  log(`Static files directory: ${staticDir}`, 'vite');
  log(`Public directory: ${publicDir}`, 'vite');
  log(`Uploads directory: ${uploadsDir}`, 'vite');
  
  // Serve static files from all directories
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
  } else {
    log('Warning: Static directory not found: ' + staticDir, 'vite');
  }
  
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }
  
  if (fs.existsSync(uploadsDir)) {
    app.use('/uploads', express.static(uploadsDir));
  }
  
  // Fallback to index.html for SPA client-side routing
  app.use('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Skip WebSocket routes 
    if (req.path.startsWith('/ws')) {
      return next();
    }
    
    // Skip uploads folder
    if (req.path.startsWith('/uploads/')) {
      return next();
    }
    
    const indexHtml = path.resolve(staticDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      log('Warning: index.html not found at: ' + indexHtml, 'vite');
      next(new Error('Production index.html not found'));
    }
  });
}

// No-op functions for production
export function closeVite(): void {
  // No-op in production
}

export function setupViteErrorMiddleware(app: Express): void {
  // No-op in production
}

export function attachViteWebSocketServer(httpServer: Server): void {
  // No-op in production
}

// Add setupVite function to match interface in index.ts
export async function setupVite(app: Express, server: Server): Promise<void> {
  // In production, this redirects to serveStatic
  serveStatic(app);
}