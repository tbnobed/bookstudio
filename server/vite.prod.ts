/**
 * Production-ready replacement for vite.ts
 * This file provides a minimal implementation for production environments.
 */

import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

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