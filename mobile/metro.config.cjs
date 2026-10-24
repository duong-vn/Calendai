const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// SDK 52 Metro otherwise ignores AI SDK v4's package export subpaths (ai/react).
config.resolver.unstable_enablePackageExports = true;
module.exports = config;
