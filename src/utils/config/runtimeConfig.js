import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG } from './defaultConfig';

export const RUNTIME_CONFIG_KEY = '@vissionassistant_runtime_config';

export async function loadRuntimeConfig() {
  try {
    const saved = await AsyncStorage.getItem(RUNTIME_CONFIG_KEY);

    if (!saved) {
      return DEFAULT_CONFIG;
    }

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      debug: {
        ...DEFAULT_CONFIG.debug,
        ...(parsed.debug || {}),
      },
      vision: {
        ...DEFAULT_CONFIG.vision,
        ...(parsed.vision || {}),
      },
      frameQuality: {
        ...DEFAULT_CONFIG.frameQuality,
        ...(parsed.frameQuality || {}),
      },
      yolo: {
        ...DEFAULT_CONFIG.yolo,
        ...(parsed.yolo || {}),
      },
      search: {
        ...DEFAULT_CONFIG.search,
        ...(parsed.search || {}),
      },
      generalScan: {
        ...DEFAULT_CONFIG.generalScan,
        ...(parsed.generalScan || {}),
      },
      currency: {
        ...DEFAULT_CONFIG.currency,
        ...(parsed.currency || {}),
      },
      obstacle: {
        ...DEFAULT_CONFIG.obstacle,
        ...(parsed.obstacle || {}),
      },
      spatial: {
        ...DEFAULT_CONFIG.spatial,
        ...(parsed.spatial || {}),
      },
      motion: {
        ...DEFAULT_CONFIG.motion,
        ...(parsed.motion || {}),
      },
      voice: {
        ...DEFAULT_CONFIG.voice,
        ...(parsed.voice || {}),
      },
      intent: {
        ...DEFAULT_CONFIG.intent,
        ...(parsed.intent || {}),
      },
      feedback: {
        ...DEFAULT_CONFIG.feedback,
        ...(parsed.feedback || {}),
      },
    };
  } catch (error) {
    console.warn('[RuntimeConfig] Load failed:', error);

    return DEFAULT_CONFIG;
  }
}

export async function saveRuntimeConfig(config) {
  try {
    await AsyncStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('[RuntimeConfig] Save failed:', error);
  }
}

export async function resetRuntimeConfig() {
  try {
    await AsyncStorage.removeItem(RUNTIME_CONFIG_KEY);
  } catch (error) {
    console.warn('[RuntimeConfig] Reset failed:', error);
  }
}
