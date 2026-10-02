import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { testmuDevices } from './testmu-device-provider.ts';

const stateDir = '.e2e/testmu';
const apk = 'https://prod-mobile-artefacts.lambdatest.com/assets/docs/proverbial_android.apk';

export default {
  targets: [
    {
      name: 'android-emulator',
      engine: mobile({
        platform: 'android',
        device: testmuDevices({ device: 'Galaxy S22 Ultra 5G', osVersion: '14', app: apk, stateDir }),
      }),
      app: { bundleId: 'com.lambdatest.proverbial' },
    },
    {
      name: 'ios-simulator',
      engine: mobile({
        platform: 'ios',
        device: testmuDevices({ device: 'iPhone 16', osVersion: '18.0', app: './build/MyApp.zip', stateDir }),
      }),
      app: { bundleId: 'com.example.app' },
    },
    {
      name: 'android-real',
      engine: mobile({
        platform: 'android',
        device: testmuDevices({ device: 'Pixel 6', osVersion: '14', app: apk, deviceType: 'real', stateDir }),
      }),
      app: { bundleId: 'com.lambdatest.proverbial' },
    },
  ],
  workers: 1,
} satisfies E2EConfig;
