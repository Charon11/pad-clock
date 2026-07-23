import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.charon.tabclock',
  appName: 'Tab Clock',
  webDir: 'public',
  server: {
    url: 'https://tab-clock.web.app',
    cleartext: false
  }
};

export default config;
