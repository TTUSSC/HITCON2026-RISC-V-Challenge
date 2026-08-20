export { assemble, BASE_ADDRESS } from "./assemble";
export type {
  AssembleResult,
  AssembleSuccess,
  AssembleFailure,
  AssembleError,
} from "./assemble";
export { buildElf } from "./elf";

import { assemble } from "./assemble";
import { buildElf } from "./elf";

export function formatAssembleErrors(
  errors: Array<{ line: number; message: string }>,
): string {
  return errors.map((e) => `line ${e.line}: ${e.message}`).join("\n");
}

/** Assembles source text straight to ELF bytes, or throws a human-readable
 * error message (one line per assembler error) on failure. Callers that need
 * to surface errors to the UI without a thrown exception should call
 * `assemble()` directly instead. */
export function assembleToElf(source: string): Uint8Array {
  const result = assemble(source);
  if (!result.ok) {
    throw new Error(formatAssembleErrors(result.errors));
  }
  return buildElf(result.bytes, result.baseAddress, result.entry);
}
