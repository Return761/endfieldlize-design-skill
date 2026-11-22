# Evidence rubric

| Evidence class | Record |
| --- | --- |
| automated | Command, environment, fixture, actual result and stable artifact path. A screenshot capture alone establishes that it rendered. |
| reviewer | What you observed, the referenced screenshot or interaction, its user impact, and the proposed revision. |
| unverified | Hypothesis, missing tool or evidence, and the check needed to resolve it. |

Check the shortest common path, backtracking, empty or exceptional content, and complex content. Inspect mobile and desktop widths, long titles, visible focus, reduced motion, and alternate ways to access operations with spatial controls. Prioritize issues that block or mislead users over matters of visual preference.

Use [EvaluationReport](../../../../schemas/EvaluationReport.schema.json). Run `node tools/design.mjs test examples/sinewave/prototype.json .design/test` from the checkout root. A manual run records environment, steps and observed result in the same report and leaves automated checks unchanged.
