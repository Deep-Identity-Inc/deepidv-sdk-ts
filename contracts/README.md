# OpenAPI parity contract

`openapi-parity.json` is the authoritative inventory for mapping the DeepIDV OpenAPI surface to `@deepidv/server`.

## Baseline

- Repository: `Deep-Identity-Inc/deepidv-open-api`
- Reference: `origin/dev`
- OpenAPI file: `infrastructure/ec2/open-api/openapi.yaml`
- Pinned commit: recorded in `openapi-parity.json`

The manifest uses the uppercase HTTP method plus normalized path as its stable key because the OpenAPI contract does not yet define `operationId` values.

## Scope decisions

- The four `/v1/oauth-clients*` operations are `excluded-oauth`. OAuth client management remains owned by the MCP server.
- `GET /v1/auth/verify` remains in scope because it verifies API-key authentication.
- `POST /v1/idv` is `deprecated`; `client.sessions.create()` uses `POST /v1/sessions`.
- The SDK implementation baseline is Node.js 20+, matching the root package engine and CI matrix. Public documentation must be reconciled before release.
- Implementation is delivered through stacked PRs. The complete SDK surface is published in one coordinated release.

## Statuses

| Status             | Meaning                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `supported`        | The SDK method, tests, and documentation already exist.                   |
| `implement`        | The operation is approved for implementation in the parity stack.         |
| `excluded-oauth`   | The operation remains with the MCP server.                                |
| `deprecated`       | The API route remains available but is not a new recommended SDK surface. |
| `internal-admin`   | The operation is intentionally unsuitable for the general SDK.            |
| `blocked-contract` | The OpenAPI contract must be corrected or completed before SDK work.      |

Every operation must be present. Exclusions and blockers require a reason and owner.

## Validate the manifest

Validate its structure and classification metadata:

```bash
pnpm check:openapi-parity
```

Compare it with an OpenAPI file and verify the pinned commit:

```bash
pnpm check:openapi-parity -- \
  --openapi ../deepidv-open-api/infrastructure/ec2/open-api/openapi.yaml \
  --source-commit <full-origin-dev-sha>
```

The checkout used by `--openapi` must contain the same contract as the supplied SHA. The checker reports unclassified OpenAPI operations and stale manifest entries.

Run the parity-tool unit tests with:

```bash
pnpm test:openapi-parity
```

## Updating the baseline

1. Fetch `origin/dev` in `deepidv-open-api`.
2. Review the OpenAPI diff from the currently pinned commit.
3. Update the manifest commit and operation records.
4. Classify every added operation and remove or explain every stale operation.
5. Run the parity tests and compare against the refreshed OpenAPI file.
6. Commit the manifest changes in the same PR as the SDK work they describe.
