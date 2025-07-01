/**
 * Runtime timezone configuration system
 * This bypasses Vite's build-time environment variable caching
 */

// Build-time fallback (from Vite environment variable)
const BUILD_TIME_TIMEZONE = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';

// Runtime timezone override storage
const TIMEZONE_STORAGE_KEY = 'bookstudio_facility_timezone';

/**
 * Get the current facility timezone
 * Priority: 1. Runtime override, 2. Build-time environment variable
 */
export function getFacilityTimezone(): string {
  // Check for runtime override first
  const runtimeOverride = localStorage.getItem(TIMEZONE_STORAGE_KEY);
  if (runtimeOverride) {
    console.log('Using runtime timezone override:', runtimeOverride);
    return runtimeOverride;
  }
  
  // Fall back to build-time environment variable
  console.log('Using build-time timezone:', BUILD_TIME_TIMEZONE);
  return BUILD_TIME_TIMEZONE;
}

/**
 * Set runtime timezone override
 */
export function setFacilityTimezone(timezone: string): void {
  localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone);
  console.log('Set runtime timezone override:', timezone);
  
  // Trigger a page reload to apply changes
  window.location.reload();
}

/**
 * Clear runtime timezone override
 */
export function clearFacilityTimezone(): void {
  localStorage.removeItem(TIMEZONE_STORAGE_KEY);
  console.log('Cleared runtime timezone override, using build-time value');
  
  // Trigger a page reload to apply changes
  window.location.reload();
}

/**
 * Check if a runtime override is active
 */
export function hasTimezoneOverride(): boolean {
  return localStorage.getItem(TIMEZONE_STORAGE_KEY) !== null;
}