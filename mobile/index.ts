import { registerRootComponent } from 'expo';
import structuredClone from '@ungap/structured-clone';

// Hermes does not provide structuredClone on Expo SDK 52.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T => structuredClone(value);
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
