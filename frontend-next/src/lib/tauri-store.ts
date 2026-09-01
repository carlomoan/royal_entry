// This module is ONLY loaded in Tauri desktop builds.
// Web builds never import this file (webpack ignores it because it's
// never statically referenced from any entry point).

export async function getStore() {
  const { LazyStore } = await import("@tauri-apps/plugin-store");
  return new LazyStore("royalentry.auth.json");
}
