// Centralized URL helpers for production/development compatibility

// Base API server URL (without /api suffix) - used for files, PDFs, images
export const BASE_SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

// Frontend portal URL - used in WhatsApp/email messages sent to customers
export const PORTAL_BASE_URL = import.meta.env.VITE_PORTAL_URL || window.location.origin;

// Helper to build file/image URLs
// Handles paths that may be stored with old localhost prefix in the database
export const fileUrl = (path: string): string => {
  if (!path) return '';
  // If already a full URL with localhost, strip it and use correct base
  if (path.includes('localhost:5000')) {
    path = path.replace(/https?:\/\/localhost:5000/g, '');
  }
  // Convert static uploads path to authenticated api route
  if (path.startsWith('/uploads/')) {
    path = path.replace('/uploads/', '/api/uploads/');
  } else if (path.startsWith('uploads/')) {
    path = path.replace('uploads/', '/api/uploads/');
  }
  // If already a full URL with correct base, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Relative path — prepend base server URL
  return `${BASE_SERVER_URL}${path}`;
};

// Helper to build customer portal tracking URL
export const portalTrackUrl = (trackId: string) => `${PORTAL_BASE_URL}/portal?trackId=${trackId}`;

