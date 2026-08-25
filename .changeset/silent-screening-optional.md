---
'@deepidv/server': minor
---

Made `email` optional on `screening.pepSanctions()` and `screening.adverseMedia()`. When omitted, screening runs on name + date of birth alone and the server synthesizes a placeholder identity email. `screening.titleCheck()` is unaffected — it still requires `email`.
