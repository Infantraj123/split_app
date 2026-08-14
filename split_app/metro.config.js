const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Firebase JS SDK ships mismatched ESM/CJS builds under package exports,
    // which makes Metro load firebase/app and firebase/auth as separate
    // instances ("Component auth has not been registered yet").
    unstable_enablePackageExports: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
