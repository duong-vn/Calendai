import structuredClone from '@ungap/structured-clone';

it('preserves SDK message dates, undefined, maps, sets, and cycles without native structuredClone', () => {
  const original = globalThis.structuredClone;
  try {
    Object.defineProperty(globalThis, 'structuredClone', { configurable: true, writable: true, value: undefined });
    const source: { date: Date; missing: undefined; map: Map<string, number>; set: Set<number>; self?: unknown } = { date: new Date('2027-01-02T00:00:00Z'), missing: undefined, map: new Map([['a', 1]]), set: new Set([2]) };
    source.self = source;
    const result = structuredClone(source, { lossy: false });
    expect(result).not.toBe(source);
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.getTime()).toBe(source.date.getTime());
    expect(Object.hasOwn(result, 'missing')).toBe(true);
    expect(result.map.get('a')).toBe(1);
    expect(result.set.has(2)).toBe(true);
    expect(result.self).toBe(result);
  } finally {
    globalThis.structuredClone = original;
  }
});
