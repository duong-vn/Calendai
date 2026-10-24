import { registerRootComponent } from 'expo';

// Polyfill structuredClone for Hermes engine on React Native
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = function <T>(value: T): T {
    if (value === undefined) return undefined as unknown as T;
    return JSON.parse(JSON.stringify(value)) as T;
  };
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
