import { createAgentDeviceClient } from 'agent-device';
import type { DeviceProvider } from '@e2e-dev/mobile';

type Scope = { tenant: string; runId: string; leaseId: string; leaseBackend: 'ios-instance' | 'android-instance'; leaseProvider: 'testmu' };

/**
 * Leases TestMu AI virtual or real devices through agent-device's `testmu`
 * provider, from a daemon started for the run. The daemon reads
 * `LT_USERNAME` and `LT_ACCESS_KEY` from its environment.
 */
export function testmuDevices(options: {
  device: string;
  osVersion: string;
  app: string;
  stateDir: string;
  deviceType?: 'virtual' | 'real';
  build?: string;
}): DeviceProvider {
  const scopes = new Map<string, Scope>();
  return {
    name: 'testmu',
    async acquire(request) {
      const stateDir = `${options.stateDir}/${request.runId}`;
      const client = createAgentDeviceClient({ stateDir, session: `lease-${request.slot}` });
      const leaseBackend = request.platform === 'ios' ? ('ios-instance' as const) : ('android-instance' as const);
      const selectors = {
        platform: request.platform,
        target: 'mobile' as const,
        device: options.device,
        providerOsVersion: options.osVersion,
        providerApp: options.app,
        providerDeviceType: options.deviceType ?? 'virtual',
        providerProject: 'e2e',
        providerBuild: options.build ?? request.runId,
      };
      const lease = await client.leases.allocate({ tenant: 'testmu', runId: request.runId, leaseBackend, leaseProvider: 'testmu', ...selectors });
      request.log(`leased ${lease.leaseId}`);
      const scope: Scope = { tenant: lease.tenantId, runId: lease.runId, leaseId: lease.leaseId, leaseBackend, leaseProvider: 'testmu' };
      scopes.set(lease.leaseId, scope);
      // The hosted session starts on the worker's first command, which reads the selectors from its client config.
      return { id: lease.leaseId, client: { stateDir, ...scope, ...selectors } };
    },
    async release(lease) {
      const scope = scopes.get(lease.id);
      if (scope === undefined) return;
      const client = createAgentDeviceClient({ stateDir: `${options.stateDir}/${scope.runId}`, session: 'release' });
      await client.leases.release(scope);
    },
  };
}
