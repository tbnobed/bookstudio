/**
 * Runtime timezone configuration system
 * This bypasses Vite's build-time environment variable caching
 */

// Build-time fallback (from Vite environment variable)
const BUILD_TIME_TIMEZONE = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';

// Runtime timezone override storage
const TIMEZONE_STORAGE_KEY = 'bookstudio_facility_timezone';

// Cache for database timezone
let databaseTimezoneCache: string | null = null;
let databaseTimezoneLoaded = false;

/**
 * Fetch timezone from database
 */
async function fetchDatabaseTimezone(): Promise<string | null> {
  try {
    const response = await fetch('/api/system/timezone');
    if (response.ok) {
      const data = await response.json();
      return data.timezone;
    }
  } catch (error) {
    console.warn('Failed to fetch timezone from database:', error);
  }
  return null;
}

/**
 * Get the current facility timezone (async version)
 * Priority: 1. Database setting, 2. Runtime override, 3. Build-time environment variable
 */
export async function getFacilityTimezoneAsync(): Promise<string> {
  // Check database first (with caching)
  if (!databaseTimezoneLoaded) {
    databaseTimezoneCache = await fetchDatabaseTimezone();
    databaseTimezoneLoaded = true;
  }
  
  if (databaseTimezoneCache) {
    console.log('Using database timezone:', databaseTimezoneCache);
    return databaseTimezoneCache;
  }
  
  // Check for runtime override
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
 * Get the current facility timezone (synchronous version for compatibility)
 * Priority: 1. Runtime override, 2. Build-time environment variable
 * Note: This doesn't check database - use getFacilityTimezoneAsync() for full priority
 */
export function getFacilityTimezone(): string {
  // If we have a cached database timezone, use it
  if (databaseTimezoneCache) {
    console.log('Using cached database timezone:', databaseTimezoneCache);
    return databaseTimezoneCache;
  }
  
  // Check for runtime override
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
 * Set runtime timezone override (async version for database)
 */
export async function setFacilityTimezoneAsync(timezone: string): Promise<void> {
  try {
    // Save to database
    const response = await fetch('/api/system/timezone', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ timezone }),
    });

    if (response.ok) {
      // Update cache
      databaseTimezoneCache = timezone;
      databaseTimezoneLoaded = true;
      console.log('Set database timezone:', timezone);
    } else {
      throw new Error('Failed to save timezone to database');
    }
  } catch (error) {
    console.warn('Failed to save timezone to database, using localStorage fallback:', error);
    // Fallback to localStorage
    localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone);
  }
  
  // Trigger a page reload to apply changes
  window.location.reload();
}

/**
 * Set runtime timezone override (legacy sync version)
 */
export function setFacilityTimezone(timezone: string): void {
  // Use async version but don't wait for it
  setFacilityTimezoneAsync(timezone).catch(error => {
    console.warn('Error in async timezone save:', error);
  });
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