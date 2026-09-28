/* =============================================================================
 * Backend availability
 * -----------------------------------------------------------------------------
 * The converter depends on the FastAPI backend. This hook reports whether it is
 * reachable so the page can show an honest, actionable state instead of an
 * empty screen or a raw network error.
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL, ApiError, getDevices, getHealth, type ApiDevice, type ApiHealth } from '@/lib/api';
import { CONVERTER_PLATFORM_OPTIONS, isConverterPlatform } from '@/data/platforms';
import type { PlatformId } from '@/types';

export type BackendState =
  /** The first health check has not resolved yet. */
  | 'checking'
  /** Reachable, and the platform list came from the API. */
  | 'online'
  /** Reachable earlier but a later call failed. */
  | 'degraded'
  /** Not reachable. */
  | 'offline';

export interface BackendStatus {
  state: BackendState;
  health: ApiHealth | null;
  /** Platforms served by `GET /api/v1/devices`. */
  devices: ApiDevice[];
  /** True when `devices` came from the API rather than the local fallback. */
  devicesFromApi: boolean;
  error: ApiError | null;
  /** Runs a fresh health + devices check. */
  refresh: () => Promise<void>;
}

const PROBE_INTERVAL_MS = 30_000;

/**
 * Polls `GET /api/v1/health` and reads the platform catalogue from
 * `GET /api/v1/devices`.
 *
 * When the backend is down the hook still returns the locally mirrored
 * platform list so the From/To selectors stay usable, and re-probes on an
 * interval so the page recovers as soon as the server comes back.
 */
export function useBackendStatus(): BackendStatus {
  const [state, setState] = useState<BackendState>('checking');
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [devicesFromApi, setDevicesFromApi] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const probe = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const [healthResult, devicesResult] = await Promise.all([
        getHealth(controller.signal),
        getDevices(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setHealth(healthResult);
      setDevices(devicesResult.platforms);
      setDevicesFromApi(true);
      setError(null);
      setState('online');
    } catch (caught) {
      if (controller.signal.aborted) return;
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError('unavailable', 'The conversion service is not responding.');
      setError(apiError);
      setState((current) => (current === 'online' ? 'degraded' : 'offline'));
    }
  }, []);

  useEffect(() => {
    void probe();
    const timer = window.setInterval(() => void probe(), PROBE_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [probe]);

  return { state, health, devices, devicesFromApi, error, refresh: probe };
}

/**
 * From/To selector options, preferring the API catalogue and falling back to the
 * local mirror. Any platform the API reports that the UI does not yet know how
 * to render is still listed, using the backend's own display name.
 */
export function usePlatformOptions(devices: ApiDevice[]): { value: string; label: string }[] {
  if (devices.length === 0) return CONVERTER_PLATFORM_OPTIONS;
  return devices.map((device) => ({
    value: device.id,
    label: device.name,
  }));
}

/** Coerces an arbitrary string from a query string into a converter platform. */
export function asPlatformId(value: string | null | undefined, fallback: PlatformId): PlatformId {
  if (value && isConverterPlatform(value)) return value;
  return fallback;
}

/** The API base URL, shown to the operator when the backend is unreachable. */
export { API_BASE_URL };
