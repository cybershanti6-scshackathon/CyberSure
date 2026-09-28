/* Loads the real `src/lib/api.ts` for scripts/browser-flow.mjs, so the browser
 * flow exercises the module the Convert button actually calls. */
import * as api from '@/lib/api';

export const {
  API_BASE_URL,
  API_TIMEOUT_MS,
  ApiError,
  conversionStateHint,
  conversionStateLabel,
  CONVERSION_STATE,
  convertConfiguration,
  detectPlatform,
  getDevices,
  getHealth,
  getReport,
  uploadConfiguration,
  validateConfiguration,
} = api;
