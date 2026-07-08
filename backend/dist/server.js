"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = __importDefault(require("./routes/api"));
const api_controller_1 = require("./controllers/api.controller");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Configure Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Allow all client connections for development
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});
// Pass IO instance to controllers
(0, api_controller_1.setIoInstance)(io);
// Middleware
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static file hosting for upload receipts, photos, and generated reports
const PUBLIC_DIR = path_1.default.join(__dirname, '..', 'public');
app.use('/uploads', express_1.default.static(path_1.default.join(PUBLIC_DIR, 'uploads')));
app.use(express_1.default.static(PUBLIC_DIR));
// Bind Router API
app.use('/api', api_1.default);
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
