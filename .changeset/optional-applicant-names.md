---
'@deepidv/server': minor
---

`sessions.create()` no longer requires `firstName` and `lastName` (DIDV-961). Send both or neither: when both are omitted the applicant's name is read from their ID document, the name-matches-ID check is skipped, and the workflow must include an ID verification step. Retrieved sessions created this way carry `namesProvided: false`, and the user's `firstName`/`lastName` are `null` until the ID is read.
