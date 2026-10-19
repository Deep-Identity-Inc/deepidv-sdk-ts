---
'@deepidv/server': minor
---

`sessions.create()` no longer requires `firstName` or `lastName` (DIDV-961). Each is optional on its own: sending one name (a mononym) creates a normal session. When both are omitted the applicant's name is read from their ID document, the name-matches-ID check is skipped, and the workflow must include an ID verification step. Retrieved sessions created without names carry `namesProvided: false`, and the user's `firstName`/`lastName` are typed as possibly `null` or absent until a name is known.
