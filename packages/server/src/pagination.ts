import { z } from 'zod';

/** Shared cursor input used by list endpoints that accept `nextToken`. */
export const CursorParamsSchema = z.object({
  nextToken: z.string().min(1).optional(),
});

export type CursorParams = z.infer<typeof CursorParamsSchema>;

/** Serialize the API's camel-case continuation-token convention. */
export function buildCursorQuery(params: CursorParams): string {
  if (params.nextToken === undefined) return '';
  const query = new URLSearchParams({ nextToken: params.nextToken });
  return `?${query.toString()}`;
}
