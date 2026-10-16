# @e2e-dev/testmu-browsers

[TestMu AI](https://www.lambdatest.com) (formerly LambdaTest) hosted browsers for
[`e2e`](https://www.npmjs.com/package/e2e): `web({ browser: testmuBrowsers() })`
runs a web target in TestMu AI's hosted Chrome or Edge, one session per worker slot.

## Install

```bash
npm install --save-dev @e2e-dev/testmu-browsers
```

## Usage

```ts title="e2e.config.ts"
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { testmuBrowsers } from '@e2e-dev/testmu-browsers';

export default {
  targets: [{ engine: web({ browser: testmuBrowsers(), viewport: null }), app: { url: 'https://staging.example.com' } }],
  workers: 4,
} satisfies E2EConfig;
```

Set `LT_USERNAME` and `LT_ACCESS_KEY` in the run environment, from
**Account Settings → Password & Security → Username and Access Key**
([accounts.lambdatest.com/security/username-accesskey](https://accounts.lambdatest.com/security/username-accesskey)).
`browserName` is `Chrome` (default) or `MicrosoftEdge`. `capabilities` takes
`LT:Options` fields such as `browserVersion`, `platform`, `geoLocation`, and
`video`; `build` defaults to the run id and `project` to `e2e`.

Full documentation lives at [e2e.tester.army/docs/integrations/testmu-browsers](https://e2e.tester.army/docs/integrations/testmu-browsers).

## License

Apache-2.0
