import { createContext, useContext, useEffect, useState } from 'react';

import { DEFAULT_CONFIG } from '../utils/config/defaultConfig';
import {
  loadRuntimeConfig,
  saveRuntimeConfig,
  resetRuntimeConfig,
} from '../utils/config/runtimeConfig';

/**
 * @typedef {typeof DEFAULT_CONFIG} RuntimeConfig
 *
 * @typedef {Object} RuntimeConfigContextValue
 * @property {RuntimeConfig} config
 * @property {boolean} isLoaded
 * @property {(newConfig: RuntimeConfig) => Promise<void>} updateConfig
 * @property {(section: keyof RuntimeConfig, values: Object) => Promise<void>} updateSection
 * @property {() => Promise<void>} resetConfig
 */

/** @type {import('react').Context<RuntimeConfigContextValue | null>} */
const RuntimeConfigContext = createContext(null);

export function RuntimeConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const savedConfig = await loadRuntimeConfig();

      setConfig(savedConfig);
      setIsLoaded(true);
    }

    load();
  }, []);

  /**
   * @param {RuntimeConfig} newConfig
   */
  const updateConfig = async newConfig => {
    setConfig(newConfig);
    await saveRuntimeConfig(newConfig);
  };

  /**
   * @param {keyof RuntimeConfig} section
   * @param {Object} values
   */
  const updateSection = async (section, values) => {
    const newConfig = {
      ...config,
      [section]: {
        ...config[section],
        ...values,
      },
    };

    setConfig(newConfig);
    await saveRuntimeConfig(newConfig);
  };

  const resetConfig = async () => {
    await resetRuntimeConfig();

    const freshConfig = await loadRuntimeConfig();

    setConfig(freshConfig);
  };

  return (
    <RuntimeConfigContext.Provider
      value={{
        config,
        isLoaded,
        updateConfig,
        updateSection,
        resetConfig,
      }}
    >
      {children}
    </RuntimeConfigContext.Provider>
  );
}

/**
 * @returns {RuntimeConfigContextValue}
 */
export function useRuntimeConfig() {
  const context = useContext(RuntimeConfigContext);

  if (!context) {
    throw new Error(
      'useRuntimeConfig must be used inside RuntimeConfigProvider',
    );
  }

  return context;
}
