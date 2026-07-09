// Centralized URL helpers for production/development compatibility

// Base API server URL (without /api suffix) - used for files, PDFs, images
export const BASE_SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

// Frontend portal URL - used in WhatsApp/email messages sent to customers
export const PORTAL_BASE_URL = import.meta.env.VITE_PORTAL_URL || window.location.origin;

// Helper to build file/image URLs
export const fileUrl = (path: string) => `${BASE_SERVER_URL}${path}`;

// Helper to build customer portal tracking URL
export const portalTrackUrl = (trackId: string) => `${PORTAL_BASE_URL}/portal?trackId=${trackId}`;
