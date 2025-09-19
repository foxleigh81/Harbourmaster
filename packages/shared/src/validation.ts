/**
 * Shared validation utilities
 */

// More permissive validation for Docker container IDs and names
export const CONTAINER_ID_HEX = /^[a-f0-9]{12,64}$/i;
export const CONTAINER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

export function isValidContainerIdentifier(id: string): boolean {
  return CONTAINER_ID_HEX.test(id) || CONTAINER_NAME.test(id);
}

export function isValidPort(port: number): boolean {
  return port > 0 && port <= 65535;
}