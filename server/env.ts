/**
 * Server-only environment accessor.
 * Uses the Node/Vercel runtime global without requiring @types/node.
 */
type RuntimeProcess = { env?: Record<string, string | undefined> }

export function env(name: string): string {
  const runtime = globalThis as typeof globalThis & { process?: RuntimeProcess }
  return runtime.process?.env?.[name] ?? ''
}
