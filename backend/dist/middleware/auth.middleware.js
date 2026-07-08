"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'fsrms_super_jwt_secret_key_2026';
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer <token>
        jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: 'Forbidden: Invalid or expired access token' });
            }
            req.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                name: decoded.name
            };
            next();
        });
    }
    else {
        res.status(401).json({ message: 'Unauthorized: Access token missing' });
    }
};
exports.authenticateJWT = authenticateJWT;
const requireRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
