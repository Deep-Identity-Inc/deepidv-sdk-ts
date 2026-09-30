---
'@deepidv/server': major
---

Align the existing SDK surface with the pinned OpenAPI contract. Session responses now normalize the documented snake-case wire format, session listing uses cursor pagination and the supported filters, status updates use the correct route and payload, title checks return async-job handles, async-job IDs require UUIDs, and the non-functional screening list surface has been removed.
