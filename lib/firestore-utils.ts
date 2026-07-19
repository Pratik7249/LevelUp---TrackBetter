/**
 * Firestore rejects ordinary `undefined` values. This helper removes them from
 * plain objects while preserving Date, Timestamp, FieldValue and class values.
 * Undefined array entries become null so array positions remain stable.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => item === undefined ? null : stripUndefinedDeep(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, stripUndefinedDeep(child)])
    ) as T;
  }

  return value;
}

export function monthSnapshotKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
