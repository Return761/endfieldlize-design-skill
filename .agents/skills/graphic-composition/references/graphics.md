# Graphics tooling

For exact Rahoo output use `RahooSpec` with the pinned release. Run `node tools/design.mjs rahoo-sync`, inspect a generator with `rahoo-inspect`, then pass its spec to `generate` or `preview`. The [native rendering guide](../../../../docs/rahoo-native.md) documents source settings, uploads and animation export.

From the checkout root run `node tools/design.mjs catalog` or `node tools/design.mjs catalog scaleCircle` to list options with validation rules and origin. Run `node tools/design.mjs generate examples/sinewave/dial.json .design/dial.svg` to create deterministic SVG. Run `node tools/design.mjs preview examples/sinewave/dial.json .design/dial.png` for a PNG when a Chromium browser is available. Use `preset input.json copy.json` to save normalized settings. See [CLI and extension guide](../../../../README.md).

Use the [CompositionSpec schema](../../../../schemas/CompositionSpec.schema.json) to record layout, layers, typography and responsive constraints. External geometry can be authored as original JavaScript generator modules and selected explicitly via `--plugin`.
