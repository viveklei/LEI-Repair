import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { setIoInstance } from './controllers/api.controller';

dotenv.config();

const app = express();
const server = http.createServer(app);

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
});
