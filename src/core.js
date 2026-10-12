const MARKER_RE = /^[\s\uFEFF]*\[reject:([0-9a-f]+)\] ?(.*)$/s;

export function buildRejectMarker(id, message) {
  return `[reject:${id}] ${message}`;
}

export function parseRejectMarker(s) {
  if (typeof s !== 'string') return null;
  const m = MARKER_RE.exec(s);
  if (!m) return null;
  return { id: m[1], message: m[2] };
}

export class Stitcher {
  #groups = new Map();
  #max = 0;

  constructor(opts = {}) {
    this.#max = Math.max(0, Number.isFinite(opts.maxGroups) ? opts.maxGroups : 0);
  }

  recordRejection(id, error) {
    if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) {
      throw new Error('id must be a 32-char hex string');
    }
    if (error == null || typeof error !== 'object') {
      throw new Error('error must be an Error or object');
    }
    const entry = { id, error };
    if (this.#groups.has(id)) {
      this.#groups.get(id).entries.push(entry);
      return;
    }
    if (this.#max > 0 && this.#groups.size >= this.#max) {
      const firstKey = this.#groups.keys().next().value;
      this.#groups.delete(firstKey);
    }
    this.#groups.set(id, { entries: [entry] });
  }

  correlate(error) {
    if (error == null || typeof error.message !== 'string') return null;
    const parsed = parseRejectMarker(error.message);
    if (!parsed) return null;
    const group = this.#groups.get(parsed.id);
    if (!group) return null;
    return group.entries;
  }

  getGroup(id) {
    const g = this.#groups.get(id);
    return g ? [...g.entries] : null;
  }

  evict(id) {
    const group = this.#groups.get(id);
    if (!group) return null;
    this.#groups.delete(id);
    return [...group.entries];
  }

  clear() {
    this.#groups.clear();
  }
}
