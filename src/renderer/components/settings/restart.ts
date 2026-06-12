/** Poll the kasas connection until it answers again (used after an external restart). */
export async function waitForBackend(timeoutMs = 20_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await window.api.connection.test();
    if (r.ok) return true;
    await new Promise((res) => setTimeout(res, 600));
  }
  return false;
}
