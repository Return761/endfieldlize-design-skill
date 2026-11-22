# Interaction exploration worksheet

- Describe a concrete job as a start state, a decision, an action, and a success state. Name the objects, ownership, multiplicity, and persistent IDs.
- Walk an identical hard example through each candidate. Include an interrupted operation, switching scope, and returning to a previously inspected object.
- For each candidate write down which objects are visible, what selecting one changes, how to reverse an action, and how a keyboard user can reach the same state.
- Compare the number of operations and how much state the user must remember. Count only steps taken in a stated walkthrough. Clearly label predictions before testing.
- Keep a chosen primary model and name each secondary projection. Both should use the same object IDs and selection state.

Use the workspace's [InteractionSpec schema](../../../../schemas/InteractionSpec.schema.json) for a portable handoff and [scenario A](../../../../examples/conversation-atlas/exploration.md) for a worked comparison. The smoke-test reference phrase is `shared object IDs`.
