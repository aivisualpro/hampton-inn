import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hamptoninn.app',
  appName: 'Hampton Inn',
  webDir: 'out',
  server: {
    url: 'https://hampton-inn.vercel.app',
    androidScheme: 'https'
  }
};

export default config;
