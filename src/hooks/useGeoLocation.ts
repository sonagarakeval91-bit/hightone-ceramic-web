import { useState, useEffect, useCallback } from 'react';
import {
  requestPreciseLocation,
  VisitorGeo,
  getLiveGeoFromCookie
} from '../services/analyticsService';

export type GeolocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface UseGeoLocationReturn {
  coordinates: Coordinates | null;
  permissionState: GeolocationPermissionState;
  isLoading: boolean;
  error: string | null;
  locationDetails: VisitorGeo | null;
  requestLocation: () => Promise<Coordinates | null>;
}

export interface UseGeoLocationOptions {
  autoRequest?: boolean;
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Custom hook to request and manage user device geolocation.
 * - Handles browser permission states ('prompt', 'granted', 'denied', 'unsupported')
 * - Listens for dynamic permission changes via Permissions API
 * - Returns accurate coordinates and reverse-geocoded location for site analytics
 */
export function useGeoLocation(options: UseGeoLocationOptions = {}): UseGeoLocationReturn {
  const {
    autoRequest = false,
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 60000
  } = options;

  const [coordinates, setCoordinates] = useState<Coordinates | null>(() => {
    const cached = getLiveGeoFromCookie();
    if (cached && typeof cached.latitude === 'number' && typeof cached.longitude === 'number') {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude
      };
    }
    return null;
  });

  const [locationDetails, setLocationDetails] = useState<VisitorGeo | null>(() => {
    return getLiveGeoFromCookie();
  });

  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return 'unsupported';
    }
    return 'prompt';
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monitor permission state changes if supported by the browser
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      if (typeof window !== 'undefined' && !navigator.geolocation) {
        setPermissionState('unsupported');
      }
      return;
    }

    let isMounted = true;

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (!isMounted) return;
        setPermissionState(status.state as GeolocationPermissionState);

        const handleChange = () => {
          if (!isMounted) return;
          setPermissionState(status.state as GeolocationPermissionState);
          if (status.state === 'granted') {
            // Automatically fetch coordinates once granted
            fetchCoordinates();
          }
        };

        status.addEventListener('change', handleChange);
        return () => status.removeEventListener('change', handleChange);
      })
      .catch(() => {
        // Fallback for browsers that don't support geolocation in permissions.query
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchCoordinates = useCallback(async (): Promise<Coordinates | null> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setPermissionState('unsupported');
      setError('Geolocation is not supported by your browser.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          setCoordinates(coords);
          setPermissionState('granted');
          setIsLoading(false);

          // Reverse-geocode and sync with site analytics and cookies
          try {
            const geo = await requestPreciseLocation(true);
            if (geo) {
              setLocationDetails(geo);
            }
          } catch {
            // quiet fallback
          }

          resolve(coords);
        },
        (err) => {
          setIsLoading(false);
          let message = 'Unable to retrieve your location.';
          if (err.code === err.PERMISSION_DENIED) {
            setPermissionState('denied');
            message = 'Location permission was denied. Please allow location in your browser settings for accurate local dealer delivery & freight.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = 'Location information is currently unavailable.';
          } else if (err.code === err.TIMEOUT) {
            message = 'The request to get user location timed out.';
          }
          setError(message);
          resolve(null);
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge
        }
      );
    });
  }, [enableHighAccuracy, timeout, maximumAge]);

  const requestLocation = useCallback(async (): Promise<Coordinates | null> => {
    return await fetchCoordinates();
  }, [fetchCoordinates]);

  // Handle autoRequest option if specified
  useEffect(() => {
    if (autoRequest && permissionState !== 'denied' && !coordinates) {
      fetchCoordinates();
    }
  }, [autoRequest, permissionState, coordinates, fetchCoordinates]);

  return {
    coordinates,
    permissionState,
    isLoading,
    error,
    locationDetails,
    requestLocation
  };
}
