# Single Player integration source

The Single Player reducer and procedural arena reference the upstream Naruto-Dattebayo prototype at [BrownBOBAsushi/Naruto-Dattebayo](https://github.com/BrownBOBAsushi/Naruto-Dattebayo), pinned to commit `c2d701e403325088ca67bafab4ea5fba7b652dbd`.

The integration adapts the upstream `applyDamage` and generation-guard idea into `src/battle-core.js`, and extracts the procedural arena drawing primitives into `src/battle-presentation.js`. RPS choice, secret-ending phases, and upstream runtime identity were not imported. The arena remains explicitly labelled temporary greybox art; no upstream sprite files are redistributed by this integration.
