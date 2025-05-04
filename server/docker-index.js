import express from 'express';
import { createServer } from 'http';
import session from 'express-session';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import connectPg from 'connect-pg-simple';
import * as schema from '../shared/schema.js';
import { WebSocketServer } from 'ws';
import { registerRoutes } from './routes.js';
import { setupAuth } from './auth.js';
import ws from 'ws';

// Check environment variables
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable not set');
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET environment variable not set');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const app = express();

// Configure PostgreSQL connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Set up session store with PostgreSQL
const PostgresSessionStore = connectPg(session);
const sessionStore = new PostgresSessionStore({
  pool,
  createTableIfMissing: true
});

// Configure session middleware
const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }
});

app.use(sessionMiddleware);
app.use(express.json());

// Set up authentication
setupAuth(app);

// Register API routes
const httpServer = await registerRoutes(app);

// Set up WebSocket server for real-time updates
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (socket) => {
  console.log('WebSocket client connected');
  
  socket.on('message', (message) => {
    console.log('Received message from client:', message.toString());
  });
  
  socket.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate(type, data) {
  wss.clients.forEach((client) => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify({ type, data }));
    }
  });
}

// Serve static files in production
app.use(express.static('./dist/client'));

// Serve any unknown routes to the SPA frontend
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: './dist/client' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`BookStud.io server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});