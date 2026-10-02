---
'@deepidv/server': major
---

Align the existing SDK surface with the public API. Session responses now normalize the wire format, preserve location and AI-decision state, use cursor pagination and supported filters, and update status through the correct route and payload. Title checks return synchronous results without automatic retries, session creation is not retried, async-job IDs require UUIDs, and the non-functional screening list surface has been removed.
