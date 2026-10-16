/** TestMu AI's hosted Chrome and Edge as a `BrowserProvider` for the web engine. */

import type { BrowserLease, BrowserProvider, BrowserRequest } from '@e2e-dev/web';
import { ConfigurationError, rejectUnknownKeys } from 'e2e/engine';
import { testmuCredentials } from './credentials.ts';

/** The browsers the web engine can attach to over CDP: Chromium ones. */
export type TestmuBrowserName = 'Chrome' | 'MicrosoftEdge';

export interface TestmuBrowsersOptions {
  /** `Chrome` when absent. */
  readonly browserName?: TestmuBrowserName | undefined;
  /**
   * `LT:Options` capabilities: `browserVersion`, `platform`, `geoLocation`,
   * `timezone`, `video`, `tunnel`, and the rest TestMu AI takes. `build`
   * defaults to the run id, `project` to `e2e`, and `idleTimeout` to 600
   * seconds. `user`, `accessKey`, and `name` are not accepted: the provider
   * sets them, from `LT_USERNAME`, `LT_ACCESS_KEY`, and the run.
   */
  readonly capabilities?: Readonly<Record<string, unknown>> | undefined;
}

const OPTION_KEYS: readonly string[] = Object.keys({
  browserName: true,
  capabilities: true,
} satisfies Record<keyof TestmuBrowsersOptions, true>);

const BROWSERS: readonly string[] = ['Chrome', 'MicrosoftEdge'] satisfies TestmuBrowserName[];
const RESERVED_CAPABILITIES = ['user', 'accessKey', 'name'];

const CDP_ENDPOINT = 'wss://cdp.lambdatest.com/puppeteer';

/** The dashboard project sessions are grouped under when `capabilities` sets none, as `testmu()`'s default. */
const DEFAULT_PROJECT = 'e2e';
// The hub ends a CDP session after 300 s without client traffic, shorter than a slow test's gaps.
const DEFAULT_IDLE_TIMEOUT_SECONDS = 600;

/**
 * TestMu AI browsers for `web({ browser: testmuBrowsers() })`: one session
 * per worker slot. A TestMu AI session is its websocket: connecting to the
 * CDP URL starts it and closing the connection ends it, so `acquire` only
 * builds the URL and `release` has nothing to call. `LT_USERNAME` and
 * `LT_ACCESS_KEY` come from the run's environment and never appear in a log
 * line.
 */
export function testmuBrowsers(options: TestmuBrowsersOptions = {}): BrowserProvider {
  rejectUnknownKeys('testmuBrowsers()', options, OPTION_KEYS);
  // Only an absent value takes the default: `null` from a JavaScript config is refused like any other.
  const browserName = options.browserName === undefined ? 'Chrome' : options.browserName;
  if (!BROWSERS.includes(browserName)) {
    throw new ConfigurationError('INVALID_CONFIG', `testmuBrowsers: \`browserName\` must be one of ${BROWSERS.join(', ')}, got ${JSON.stringify(browserName)}`);
  }
  const capabilities = options.capabilities === undefined ? {} : options.capabilities;
  if (typeof capabilities !== 'object' || capabilities === null || Array.isArray(capabilities)) {
    throw new ConfigurationError('INVALID_CONFIG', 'testmuBrowsers: `capabilities` must be an object of `LT:Options` fields');
  }
  const reserved = RESERVED_CAPABILITIES.filter((key) => key in capabilities);
  if (reserved.length > 0) {
    throw new ConfigurationError(
      'INVALID_CONFIG',
      `testmuBrowsers: \`capabilities\` cannot set ${reserved.map((key) => `\`${key}\``).join(', ')}; the provider names each session, and reads LT_USERNAME and LT_ACCESS_KEY from the environment`,
    );
  }
  return {
    name: 'testmu-browsers',
    async acquire(request: BrowserRequest): Promise<BrowserLease> {
      const { username, accessKey } = testmuCredentials(request.env);
      const name = sessionName(request);
      const ltOptions: Record<string, unknown> = {
        project: DEFAULT_PROJECT,
        build: request.runId,
        idleTimeout: DEFAULT_IDLE_TIMEOUT_SECONDS,
        ...capabilities,
        name,
        user: username,
        accessKey,
      };
      request.log(`TestMu AI session "${name}" in build "${String(ltOptions['build'])}"`);
      return {
        id: `${request.targetName}:slot-${request.slot + 1}`,
        cdpEndpoint: `${CDP_ENDPOINT}?capabilities=${encodeURIComponent(JSON.stringify({ browserName, 'LT:Options': ltOptions }))}`,
      };
    },
    async release(): Promise<void> {
      // Closing the CDP connection, which the engine does, ends the TestMu AI session.
    },
  };
}

/**
 * The format of `testmu()`'s session names, so a run's device and browser
 * sessions read alike on the dashboard. A copy rather than an import: sharing
 * it would make every web install pull in agent-device.
 */
function sessionName({ runId, targetName, slot }: BrowserRequest): string {
  return `e2e-${runId}-${targetName}-${slot + 1}`;
}
