#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  compareOperations,
  parseOpenApiOperations,
  readManifest,
  summarizeOperations,
  validateManifest,
} from './lib/openapi-parity.mjs';

function parseArguments(argv) {
  const options = {
    manifest: 'contracts/openapi-parity.json',
    openapi: null,
    sourceCommit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === '--') {
      continue;
    } else if (argument === '--manifest' && value) {
      options.manifest = value;
      index += 1;
    } else if (argument === '--openapi' && value) {
      options.openapi = value;
      index += 1;
    } else if (argument === '--source-commit' && value) {
      options.sourceCommit = value;
      index += 1;
    } else if (argument === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/check-openapi-parity.mjs [options]

Options:
  --manifest <path>       Parity manifest (default: contracts/openapi-parity.json)
  --openapi <path>        Compare the manifest with an OpenAPI YAML file
  --source-commit <sha>   Verify the manifest is pinned to this OpenAPI commit
  --help                  Show this help
`);
}

function printSummary(manifest) {
  const summary = summarizeOperations(manifest.operations);
  console.log(`OpenAPI source: ${manifest.source.ref}@${manifest.source.commit}`);
  console.log(`Operations: ${summary.total}`);
  console.log(`By status: ${JSON.stringify(summary.byStatus)}`);
  console.log(`By domain: ${JSON.stringify(summary.byDomain)}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const manifestPath = resolve(options.manifest);
  const manifest = await readManifest(manifestPath);
  const errors = validateManifest(manifest);

  if (options.sourceCommit && manifest.source.commit !== options.sourceCommit) {
    errors.push(
      `Manifest commit ${manifest.source.commit} does not match ${options.sourceCommit}.`,
    );
  }

  if (options.openapi) {
    const openApiSource = await readFile(resolve(options.openapi), 'utf8');
    const openApiOperations = parseOpenApiOperations(openApiSource);
    const comparison = compareOperations(manifest.operations, openApiOperations);

    if (comparison.unclassified.length > 0) {
      errors.push(`Unclassified OpenAPI operations:\n- ${comparison.unclassified.join('\n- ')}`);
    }
    if (comparison.stale.length > 0) {
      errors.push(`Stale manifest operations:\n- ${comparison.stale.join('\n- ')}`);
    }
  }

  printSummary(manifest);

  if (errors.length > 0) {
    console.error(`\nParity validation failed:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(options.openapi ? 'Manifest matches the OpenAPI contract.' : 'Manifest is valid.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
