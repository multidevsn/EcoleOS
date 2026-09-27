declare const process: { env: Record<string, string | undefined> }

declare class Buffer extends Uint8Array {
  static from(input: unknown, encoding?: string): Buffer
  static concat(list: readonly Uint8Array[]): Buffer
  toString(encoding?: string): string
}

declare module 'node:crypto' {
  export function randomUUID(): string
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: 'hex'): string }
    digest(encoding: 'hex'): string
  }
  export function createHmac(algorithm: string, key: string): {
    update(data: string): { digest(encoding: 'hex'): string }
    digest(encoding: 'hex'): string
  }
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean
}
