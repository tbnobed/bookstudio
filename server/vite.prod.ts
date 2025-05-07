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

export async function setupVite(_app: Express, _server: Server) {
  // No-op in production build
  console.log("Vite setup skipped in production mode");
}

export function serveStatic(app: Express) {
  // In Docker container, the static files are in dist/public
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    // Fallback to the standard location
    const fallbackPath = path.resolve(process.cwd(), "public");
    if (!fs.existsSync(fallbackPath)) {
      throw new Error(
        `Could not find static files at ${distPath} or ${fallbackPath}. Make sure the build process completed correctly.`,
      );
    }
    log(`Using fallback static path: ${fallbackPath}`);
    app.use(express.static(fallbackPath));
    
    // fall through to index.html if the file doesn't exist
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(fallbackPath, "index.html"));
    });
    return;
  }

  log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}