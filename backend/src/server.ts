import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { setIoInstance } from './controllers/api.controller';

import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security & Performance Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows cross-origin asset loading for static PDFs/photos
  contentSecurityPolicy: false // Keeps SPA inline assets rendering smoothly
}));
app.use(compression()); // Compress all HTTP payloads (GZIP/Brotli)

// Auth Rate Limiting (50 login attempts per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth/login', authLimiter);
app.use('/api/portal/login', authLimiter);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all client connections for development
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Pass IO instance to controllers
setIoInstance(io);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file hosting for upload receipts, photos, and generated reports
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
app.use(express.static(PUBLIC_DIR));

// Bind Router API
app.use('/api', apiRouter);

// Basic check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Global Express Central Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected server error occurred. Please try again.' 
      : err.message || 'Internal Server Error'
  });
});

// Socket.IO Event Handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);

  socket.on('join_job', (jobId) => {
    socket.join(jobId);
    console.log(`👤 Client joined job room: ${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected from Socket.IO: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 FSRMS Server running on port ${PORT}`);
  console.log(`📂 Public assets path: ${PUBLIC_DIR}`);

  // Import and trigger manager approvals scheduler checks
  import('./services/scheduler').then(({ runManagerApprovalCheck }) => {
    // Run once on startup (with 10-second delay so server boots cleanly)
    setTimeout(() => {
      runManagerApprovalCheck();
    }, 10000);

    // Schedule to run every 24 hours (86400000 ms)
    setInterval(() => {
      runManagerApprovalCheck();
    }, 24 * 60 * 60 * 1000);
  }).catch((err) => {
    console.error('❌ Failed to initialize approvals cron scheduler:', err);
  });
});
