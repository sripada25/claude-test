// F3-2.4: starts the in-process generation-job worker once when the server
// boots. NEXT_RUNTIME guards against the edge runtime, which also calls
// register() but can't hold a pg Pool or a long-lived setTimeout.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGenerationWorker } = await import("@/lib/services/generation-worker");
    startGenerationWorker();
  }
}
