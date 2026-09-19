/**
 * Serialize per-document checkpoints without allowing an older write to mark
 * newer editor state as durable. IndexedDB puts are atomic; this coordinator
 * adds ordering and revision acknowledgement around them.
 */
export function createDocumentCheckpointCoordinator({ capture, write }) {
  if (typeof capture !== "function" || typeof write !== "function") throw new TypeError("capture and write are required");
  const states = new WeakMap();

  const stateFor = document => {
    let state = states.get(document);
    if (!state) {
      state = { revision: 1, persistedRevision: 0, chain: Promise.resolve() };
      states.set(document, state);
    }
    return state;
  };

  return Object.freeze({
    markChanged(document) {
      const state = stateFor(document);
      state.revision += 1;
      return state.revision;
    },

    revision(document) { return stateFor(document).revision; },
    persistedRevision(document) { return stateFor(document).persistedRevision; },

    checkpoint(document) {
      const state = stateFor(document);
      state.chain = state.chain.catch(() => {}).then(async () => {
        // An edit can arrive during capture or the IndexedDB transaction. Loop
        // until the revision current at acknowledgement has actually landed.
        while (state.persistedRevision < state.revision) {
          const revision = state.revision;
          const value = await capture(document, revision);
          await write(document, value, revision);
          state.persistedRevision = revision;
        }
        return state.persistedRevision;
      });
      return state.chain;
    }
  });
}
