import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moxx.playmania',
  appName: 'Playmania',
  webDir: 'dist',
  backgroundColor: '#1b1035',
  ios: {
    contentInset: 'never',
  },
};

export default config;
