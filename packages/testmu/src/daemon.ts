import { execFile, fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DriverGrant, DriverRequest } from './driver.ts';

const exec = promisify(execFile);

const PLUGIN = '@agent-device/testmu';

interface Installation {
  directory: string;
  version: string;
  bin?: Record<string, string>;
}

/** Resolve a dependency's package directory from its entry, without importing it. */
function installation(name: string): Installation {
  let directory = path.dirname(fileURLToPath(import.meta.resolve(name)));
  while (true) {
    const file = path.join(directory, 'package.json');
    let manifest: unknown;
    try {
      manifest = JSON.parse(readFileSync(file, 'utf8'));
    } catch { /* The entry may be several directories below its package. */ }
    if (isRecord(manifest) && manifest['name'] === name) {
      const version = manifest['version'];
      if (typeof version !== 'string') throw new Error(`Cannot find the installed ${name} package: ${file} declares no version`);
      const bin = isRecord(manifest['bin']) ? Object.fromEntries(Object.entries(manifest['bin']).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : undefined;
      return { directory, version, ...(bin === undefined ? {} : { bin }) };
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Cannot find the installed ${name} package`);
    directory = parent;
  }
}

export function assertDriverVersion(expected: string): void {
  const actual = installation('agent-device').version;
  if (actual !== expected) throw new Error(`@e2e-dev/testmu uses agent-device ${actual}, but @e2e-dev/mobile uses ${expected}. Install matching versions.`);
}

/**
 * Registers the installed `@agent-device/testmu` in a private agent-device
 * home, the layout `agent-device plugins add` writes, without fetching it
 * from the registry again.
 */
export async function installPlugin(home: string): Promise<void> {
  const plugin = installation(PLUGIN);
  const id = randomUUID();
  const scope = path.join(home, 'plugins', id, 'node_modules', '@agent-device');
  await mkdir(scope, { recursive: true, mode: 0o700 });
  await symlink(plugin.directory, path.join(scope, 'testmu'), 'junction');
  await writeFile(path.join(home, 'config.json'), `${JSON.stringify({ plugins: { [PLUGIN]: { installation: id, version: plugin.version } } })}\n`, { mode: 0o600 });
}

/** Not cancellable: an interrupted allocation can still grant a lease, which the caller then releases. */
export async function startDriver(request: DriverRequest, env: NodeJS.ProcessEnv): Promise<DriverGrant> {
  const entry = new URL(import.meta.url.endsWith('.ts') ? './driver.ts' : './driver.js', import.meta.url);
  return new Promise((resolve, reject) => {
    const child = fork(entry, [], { env, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    let answered = false;
    child.once('error', reject);
    child.once('message', (reply: { grant?: DriverGrant; error?: string }) => {
      answered = true;
      if (reply.grant) resolve(reply.grant);
      else reject(new Error(reply.error ?? 'TestMu AI driver returned no lease'));
    });
    child.once('exit', () => {
      if (!answered) reject(new Error('TestMu AI driver exited before allocation finished'));
    });
    child.send(request);
  });
}

/** Stopping the daemon releases its leases, which ends their TestMu AI sessions. */
export async function stopDriver(stateDir: string, env: NodeJS.ProcessEnv, signal: AbortSignal): Promise<void> {
  const cli = installation('agent-device');
  const { stdout } = await exec(process.execPath, [path.join(cli.directory, cli.bin!['agent-device']!), 'daemon', 'stop', '--state-dir', stateDir, '--clean', '--json'], { env, signal });
  const output: unknown = JSON.parse(stdout);
  const data = isRecord(output) ? output['data'] : undefined;
  const releases = isRecord(data) ? data['providerReleases'] : undefined;
  const pending = isRecord(releases) && Array.isArray(releases['pending']) ? releases['pending'] : [];
  if (pending.length > 0) throw new Error(`agent-device stopped without ending ${pending.length} TestMu AI session(s)`);
}

/** A plain JSON object, not an array or `null`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
