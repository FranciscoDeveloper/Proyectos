import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'cl.dairi.app',
  appName: 'Dairi',
  webDir:  'dist/supplier-management/browser',
  server: {
    // Para desarrollo con hot-reload, descomenta y ajusta la IP local:
    // url: 'http://192.168.1.X:4200',
    // cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath:  'dairi.keystore',
      keystoreAlias: 'dairi',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration:            2000,
      launchAutoHide:                true,
      backgroundColor:               '#0ea5e9',
      androidSplashResourceName:     'splash',
      showSpinner:                   false,
    },
    StatusBar: {
      style:           'LIGHT',
      backgroundColor: '#0ea5e9',
    },
  },
};

export default config;
