/** Pure learning contracts. No roster, credentials, filesystem or network reads. */
import { createHash } from "node:crypto";
import { types } from "node:util";

export type Id<K extends string> = string & { readonly __kind: K };
export type StudentId = Id<"student">;
export type EditionId = Id<"edition">;
export type UnitId = Id<"unit">;
export type PageId = Id<"page">;
export type ProblemId = Id<"problem">;
export type EntityId = Id<"entity">;
export type RevisionId = Id<"revision">;

/** Use verified opaque source keys, never a display name or array position. */
export function stableId<K extends string>(kind: K, namespace: string, ...keys: string[]): Id<K> {
  [kind, namespace, ...keys].forEach(value => requireText(value, "identity component"));
  if (keys.length === 0) throw new Error("identity needs a verified key");
  return `${kind}_${digest([namespace, ...keys])}` as Id<K>;
}

export type Knowledge<T> =
  | Readonly<{ state: "known"; value: T; evidenceRefs: readonly string[] }>
  | Readonly<{ state: "unknown"; reason: string }>;

export function known<T>(value: T, evidenceRefs: readonly string[]): Knowledge<T> {
  const result = { state: "known" as const, value, evidenceRefs };
  assertKnowledge(result);
  return immutableCopy(result);
}
export function unknown<T = never>(reason: string): Knowledge<T> {
  requireText(reason, "unknown reason");
  return Object.freeze({ state: "unknown", reason });
}
export function assertDate(value: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error("invalid calendar date");
  }
}
export function assertTime(value: string): void {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("invalid local lesson time");
}
export function assertInstant(value: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))) throw new Error("invalid timestamp with timezone");
  assertDate(value.slice(0, 10));
}
export function requireText(value: string, label: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be nonempty`);
}
export function assertRefs(refs: readonly string[]): void {
  if (!Array.isArray(refs) || refs.length === 0) throw new Error("known data needs evidence references");
  refs.forEach(value => requireText(value, "evidence reference"));
  if (new Set(refs).size !== refs.length) throw new Error("duplicate evidence reference");
}
export function assertKnowledge<T>(item: Knowledge<T>, validate?: (value: T) => void): void {
  if (!item || typeof item !== "object") throw new Error("missing knowledge state");
  if (item.state === "unknown") {
    assertExactKeys(item, ["state", "reason"]);
    requireText(item.reason, "unknown reason"); return;
  }
  if (item.state !== "known" || item.value === undefined || item.value === null) throw new Error("invalid knowledge state");
  assertExactKeys(item, ["state", "value", "evidenceRefs"]);
  assertRefs(item.evidenceRefs);
  validate?.(item.value);
}
export function assertExactKeys(value: object, expected: readonly string[]): void {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) throw new Error("unexpected or missing domain fields");
}
function requireEnum(value: string, values: readonly string[]): void {
  if (!values.includes(value)) throw new Error("invalid domain enum");
}

/** Stable JSON avoids property-order-dependent hashes; it is not a signature. */
export function canonicalJson(value: unknown): string {
  const visiting = new Set<object>();
  const encode = (part: unknown): string => {
    if (part === null || typeof part === "boolean" || typeof part === "string") return JSON.stringify(part);
    if (typeof part === "number" && Number.isFinite(part)) return JSON.stringify(part);
    if (typeof part !== "object" || part === null) throw new Error("only finite JSON data is allowed");
    // Reject reflective traps before inspecting descriptors; never call caller methods.
    if (types.isProxy(part)) throw new Error("proxies are not JSON data");
    const array = Array.isArray(part), prototype = Object.getPrototypeOf(part);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      throw new Error("plain JSON objects and arrays required");
    }
    const descriptors = Object.getOwnPropertyDescriptors(part), keys = Reflect.ownKeys(descriptors);
    for (const key of keys) {
      if (typeof key !== "string") throw new Error("symbol fields are not JSON data");
      if (!Object.hasOwn(descriptors[key], "value")) throw new Error("accessors are not JSON data");
      if (!(array && key === "length") && !descriptors[key].enumerable) throw new Error("nonenumerable fields are not JSON data");
    }
    if (visiting.has(part)) throw new Error("cyclic JSON is not allowed");
    visiting.add(part);
    let result: string;
    if (array) {
      const length = descriptors.length.value as number;
      if (keys.length !== length + 1) throw new Error("sparse or decorated arrays are not allowed");
      // Capture dense own indices before recursion; count alone cannot establish density.
      const values: unknown[] = [];
      for (let i = 0; i < length; i++) {
        if (!Object.hasOwn(descriptors, String(i))) throw new Error("sparse or decorated arrays are not allowed");
        values.push(descriptors[String(i)].value);
      }
      const encoded: string[] = [];
      for (let i = 0; i < length; i++) encoded.push(encode(values[i]));
      result = `[${encoded.join(",")}]`;
    } else {
      const encoded: string[] = [];
      for (const key of Object.keys(descriptors).sort()) encoded.push(`${JSON.stringify(key)}:${encode(descriptors[key].value)}`);
      result = `{${encoded.join(",")}}`;
    }
    visiting.delete(part);
    return result;
  };
  return encode(value);
}
export function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
export function immutableCopy<T>(value: T): T {
  const copy = JSON.parse(canonicalJson(value)) as T;
  const freeze = (part: unknown): void => {
    if (part !== null && typeof part === "object") { Object.values(part).forEach(freeze); Object.freeze(part); }
  };
  freeze(copy);
  return copy;
}
