import { readFile } from 'node:fs/promises';

export const ALLOWED_STATUSES = new Set([
  'supported',
  'implement',
  'excluded-oauth',
  'deprecated',
  'internal-admin',
  'blocked-contract',
]);

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const MCP_MANAGED_OPERATION_ROUTES = new Set([
  'GET /v1/oauth-clients',
  'POST /v1/oauth-clients',
  'POST /v1/oauth-clients/{clientId}/rotate-secret',
  'POST /v1/oauth-clients/{clientId}/revoke',
]);

export function operationKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

export function parseOpenApiOperations(source) {
  const operations = [];
  let currentPath = null;

  for (const line of source.split(/\r?\n/u)) {
    const pathMatch = /^  (\/[^:]+):\s*$/u.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    if (/^\S/u.test(line)) {
      currentPath = null;
      continue;
    }

    if (!currentPath) continue;

    const methodMatch = /^    ([a-z]+):\s*$/u.exec(line);
    if (!methodMatch) continue;

    const method = methodMatch[1].toUpperCase();
    if (!HTTP_METHODS.has(method)) continue;

    operations.push({ method, path: currentPath });
  }

  return operations;
}

export async function readManifest(path) {
  const source = await readFile(path, 'utf8');
  return JSON.parse(source);
}

export function validateManifest(manifest) {
  const errors = [];
  const seen = new Set();

  if (manifest?.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.');
  }

  if (!manifest?.source || typeof manifest.source !== 'object') {
    errors.push('source metadata is required.');
  } else {
    if (manifest.source.repository !== 'Deep-Identity-Inc/deepidv-open-api') {
      errors.push('source.repository must be Deep-Identity-Inc/deepidv-open-api.');
    }
    if (manifest.source.ref !== 'origin/dev') {
      errors.push('source.ref must be origin/dev.');
    }
    if (!/^[0-9a-f]{40}$/u.test(manifest.source.commit ?? '')) {
      errors.push('source.commit must be a full 40-character Git SHA.');
    }
    if (manifest.source.specPath !== 'infrastructure/ec2/open-api/openapi.yaml') {
      errors.push('source.specPath must be infrastructure/ec2/open-api/openapi.yaml.');
    }
  }

  if (!Array.isArray(manifest?.operations) || manifest.operations.length === 0) {
    errors.push('operations must be a non-empty array.');
    return errors;
  }

  for (const [index, operation] of manifest.operations.entries()) {
    const label = `operations[${index}]`;
    const method = operation?.method?.toUpperCase();
    const path = operation?.path;

    if (!HTTP_METHODS.has(method)) {
      errors.push(`${label}.method is invalid.`);
    }
    if (typeof path !== 'string' || !path.startsWith('/')) {
      errors.push(`${label}.path must start with "/".`);
    }

    if (method && path) {
      const key = operationKey(method, path);
      if (seen.has(key)) errors.push(`Duplicate operation: ${key}.`);
      seen.add(key);
    }

    if (!ALLOWED_STATUSES.has(operation?.status)) {
      errors.push(`${label}.status is invalid.`);
      continue;
    }

    if (operation.status === 'supported' || operation.status === 'implement') {
      if (!operation.sdkNamespace || !operation.sdkMethod) {
        errors.push(`${label} requires sdkNamespace and sdkMethod.`);
      }
    } else {
      if (!operation.reason) errors.push(`${label} requires a reason.`);
      if (!operation.owner) errors.push(`${label} requires an owner.`);
    }

    if (operation.status === 'supported') {
      if (!Array.isArray(operation.tests) || operation.tests.length === 0) {
        errors.push(`${label} is supported but has no tests.`);
      }
      if (!Array.isArray(operation.documentation) || operation.documentation.length === 0) {
        errors.push(`${label} is supported but has no documentation.`);
      }
    }
  }

  const operationByKey = new Map(
    manifest.operations.map((operation) => [
      operationKey(operation.method, operation.path),
      operation,
    ]),
  );

  for (const key of MCP_MANAGED_OPERATION_ROUTES) {
    const operation = operationByKey.get(key);
    if (!operation) {
      errors.push(`Missing required OAuth exclusion: ${key}.`);
    } else if (operation.status !== 'excluded-oauth') {
      errors.push(`${key} must remain excluded-oauth.`);
    }
  }

  for (const operation of manifest.operations) {
    const key = operationKey(operation.method, operation.path);
    if (operation.status === 'excluded-oauth' && !MCP_MANAGED_OPERATION_ROUTES.has(key)) {
      errors.push(`${key} is not an approved OAuth exclusion.`);
    }
  }

  const authVerify = operationByKey.get('GET /v1/auth/verify');
  if (authVerify?.status === 'excluded-oauth') {
    errors.push('GET /v1/auth/verify is API-key verification and must remain in SDK scope.');
  }

  const deprecatedIdv = operationByKey.get('POST /v1/idv');
  if (deprecatedIdv && deprecatedIdv.status !== 'deprecated') {
    errors.push('POST /v1/idv must remain classified as deprecated.');
  }

  return errors;
}

export function compareOperations(manifestOperations, openApiOperations) {
  const manifestOperationRoutes = new Set(
    manifestOperations.map(({ method, path }) => operationKey(method, path)),
  );
  const contractOperationRoutes = new Set(
    openApiOperations.map(({ method, path }) => operationKey(method, path)),
  );

  return {
    unclassified: [...contractOperationRoutes]
      .filter((key) => !manifestOperationRoutes.has(key))
      .sort(),
    stale: [...manifestOperationRoutes].filter((key) => !contractOperationRoutes.has(key)).sort(),
  };
}

export function summarizeOperations(operations) {
  const byStatus = {};
  const byDomain = {};

  for (const operation of operations) {
    byStatus[operation.status] = (byStatus[operation.status] ?? 0) + 1;
    const domain = operation.path.split('/')[2] ?? 'unknown';
    byDomain[domain] = (byDomain[domain] ?? 0) + 1;
  }

  return {
    total: operations.length,
    byStatus: Object.fromEntries(Object.entries(byStatus).sort()),
    byDomain: Object.fromEntries(Object.entries(byDomain).sort()),
  };
}
