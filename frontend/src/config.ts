// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper function to get full API endpoint
export const getApiUrl = (endpoint: string) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
};
