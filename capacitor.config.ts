import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kevinparksinc.firmament',
  appName: 'The Firmament',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#03020A',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#03020A',
    },
    Camera: {
      permissions: ['photos', 'camera'],
    },
    Share: {
      label: 'Share Reading',
    },
  },
};

export default config;
