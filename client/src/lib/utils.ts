import { NodeType } from '../types';

/**
 * Generate a hash code from a string
 * This is a simple implementation that should be good enough for our purposes
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

/**
 * Generate a stable ID for a node based on its content and type
 * This helps prevent duplicate nodes with the same content
 */
export function generateStableNodeId(type: NodeType, content: string): string {
  // Create a hash from the content
  const contentHash = hashString(content);
  
  // Create a timestamp, but only use the date part for stability across sessions
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  return `${type}-${dateStr}-${contentHash}`;
}

/**
 * Generate a random position within a sphere
 */
export function generateRandomPosition(radius: number = 10): { x: number; y: number; z: number } {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.cbrt(Math.random());
  
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi)
  };
}

/**
 * Check if the user's device is a mobile device
 */
export function isMobile(): boolean {
  return window.innerWidth <= 768 || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Format a timestamp into a readable string (e.g., "2 minutes ago")
 */
export function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 10) return `${seconds}s ago`;
  return 'just now';
}