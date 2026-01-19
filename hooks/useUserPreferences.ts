"use client";

/**
 * User Preferences Hook with LocalStorage Caching
 * 
 * Provides instant loading of user preferences (location, date) from localStorage
 * with background sync to MongoDB for persistence across devices.
 * 
 * Strategy:
 * 1. Read from localStorage IMMEDIATELY (sync, no waiting)
 * 2. Fetch from API in background for cross-device sync
 * 3. Update localStorage when values change
 * 4. Update API when values change (debounced)
 */

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEYS = {
  LAST_LOCATION: "hampton_last_location",
  LAST_DATE: "hampton_last_date",
  USER_ID: "hampton_user_id",
};

interface UserPreferences {
  lastSelectedLocation: string | null;
  lastSelectedDate: string | null;
  userId: string | null;
}

interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  isLoading: boolean;
  setLocation: (locationId: string) => void;
  setDate: (date: string) => void;
}

// Get today's date in YYYY-MM-DD format
const getTodayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Safely read from localStorage (works on both web and mobile via Capacitor)
const readFromStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// Safely write to localStorage
const writeToStorage = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("Failed to write to localStorage:", e);
  }
};

export function useUserPreferences(): UseUserPreferencesReturn {
  // Initialize from localStorage IMMEDIATELY (synchronous)
  const [preferences, setPreferences] = useState<UserPreferences>(() => ({
    lastSelectedLocation: readFromStorage(STORAGE_KEYS.LAST_LOCATION),
    lastSelectedDate: readFromStorage(STORAGE_KEYS.LAST_DATE) || getTodayString(),
    userId: readFromStorage(STORAGE_KEYS.USER_ID),
  }));

  const [isLoading, setIsLoading] = useState(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with server on mount (background, non-blocking)
  useEffect(() => {
    const syncWithServer = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const user = await response.json();
          
          // Update localStorage with server data
          if (user._id) {
            writeToStorage(STORAGE_KEYS.USER_ID, user._id);
          }
          
          // Only update if server has values and localStorage doesn't match
          // This ensures server is source of truth for cross-device sync
          const serverLocation = user.lastSelectedLocation || null;
          const serverDate = user.lastSelectedDate || null;
          
          setPreferences((prev) => {
            const newPrefs = { ...prev, userId: user._id };
            
            // If localStorage had no location but server does, use server's
            if (!prev.lastSelectedLocation && serverLocation) {
              newPrefs.lastSelectedLocation = serverLocation;
              writeToStorage(STORAGE_KEYS.LAST_LOCATION, serverLocation);
            }
            
            // If localStorage had no date but server does, use server's
            if (serverDate && prev.lastSelectedDate === getTodayString()) {
              // Only use server date if our current is just the default today
              const localDate = readFromStorage(STORAGE_KEYS.LAST_DATE);
              if (!localDate) {
                newPrefs.lastSelectedDate = serverDate;
                writeToStorage(STORAGE_KEYS.LAST_DATE, serverDate);
              }
            }
            
            return newPrefs;
          });
        }
      } catch (e) {
        console.warn("Failed to sync preferences with server:", e);
      } finally {
        setIsLoading(false);
      }
    };

    syncWithServer();
  }, []);

  // Debounced API sync function
  const syncToServer = useCallback((location?: string, date?: string) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const body: any = {};
        if (location !== undefined) body.lastSelectedLocation = location;
        if (date !== undefined) body.lastSelectedDate = date;

        await fetch("/api/auth/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        console.warn("Failed to sync preferences to server:", e);
      }
    }, 500); // Debounce 500ms
  }, []);

  const setLocation = useCallback(
    (locationId: string) => {
      // Update localStorage IMMEDIATELY
      writeToStorage(STORAGE_KEYS.LAST_LOCATION, locationId);
      
      // Update state
      setPreferences((prev) => ({
        ...prev,
        lastSelectedLocation: locationId,
      }));

      // Sync to server (debounced)
      syncToServer(locationId, undefined);
    },
    [syncToServer]
  );

  const setDate = useCallback(
    (date: string) => {
      // Update localStorage IMMEDIATELY
      writeToStorage(STORAGE_KEYS.LAST_DATE, date);
      
      // Update state
      setPreferences((prev) => ({
        ...prev,
        lastSelectedDate: date,
      }));

      // Sync to server (debounced)
      syncToServer(undefined, date);
    },
    [syncToServer]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    preferences,
    isLoading,
    setLocation,
    setDate,
  };
}

export default useUserPreferences;
