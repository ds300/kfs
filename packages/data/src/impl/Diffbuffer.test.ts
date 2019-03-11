import { DiffBuffer } from "./DiffBuffer"
import { Diffable } from "./types"

interface Map<K, V> {
  diff(
    other: this,
  ): Array<{ type: "add"; key: K; value: V } | { type: "remove"; key: K }>
}

describe(DiffBuffer, () => {
  it("buffers diffs", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    buf.add([{ type: "reset", value: null as any }], 1)
    buf.add([{ type: "add", key: "", value: 0 }], 2)
    buf.add([{ type: "remove", key: "" }], 3)
    expect(buf.diffSince(2)).toEqual([{ type: "remove", key: "" }])
    expect(buf.diffSince(1)).toEqual([
      { type: "add", key: "", value: 0 },
      { type: "remove", key: "" },
    ])
    expect(buf.diffSince(0)).toEqual([
      { type: "reset", value: null },
      { type: "add", key: "", value: 0 },
      { type: "remove", key: "" },
    ])
  })
  it("bails out of there's no diff data", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    buf.add([{ type: "reset", value: null as any }], 1)
    buf.add(null, 2)
    buf.add([{ type: "remove", key: "" }], 3)
    expect(buf.diffSince(2)).toEqual([{ type: "remove", key: "" }])
    expect(buf.diffSince(1)).toEqual(null)
    expect(buf.diffSince(0)).toEqual(null)
  })
  it("truncates when there's a reset", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    buf.add([{ type: "reset", value: null as any }], 1)
    buf.add([{ type: "add", key: "", value: 0 }], 2)
    buf.add([{ type: "remove", key: "" }], 3)
    buf.add([{ type: "reset", value: "blah" as any }], 4)
    expect(buf.diffSince(3)).toEqual([{ type: "reset", value: "blah" as any }])
    expect(buf.diffSince(2)).toEqual([{ type: "reset", value: "blah" as any }])
    expect(buf.diffSince(1)).toEqual([{ type: "reset", value: "blah" as any }])
    buf.add([{ type: "remove", key: "" }], 5)
    expect(buf.diffSince(4)).toEqual([{ type: "remove", key: "" }])
    expect(buf.diffSince(3)).toEqual([
      { type: "reset", value: "blah" as any },
      { type: "remove", key: "" },
    ])
    expect(buf.diffSince(2)).toEqual([
      { type: "reset", value: "blah" as any },
      { type: "remove", key: "" },
    ])
  })
  it("complains when you mix up the epochs", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    expect(() => buf.add(null, 0)).toThrow()
    expect(() => buf.add(null, 2)).toThrow()
    buf.add(null, 1)
    expect(() => buf.add(null, 0)).toThrow()
    expect(() => buf.add(null, 1)).toThrow()
    buf.add(null, 2)
  })
  it("returns null if the epoch is too old", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    expect(buf.diffSince(0)).toBe(null)
    buf.add([{ type: "reset", value: null as any }], 1)
    expect(buf.diffSince(0)).toBeTruthy()
    buf.add([{ type: "reset", value: null as any }], 2)
    expect(buf.diffSince(0)).toBeTruthy()
    buf.add([{ type: "reset", value: null as any }], 3)
    expect(buf.diffSince(0)).toBeTruthy()
    buf.add([{ type: "reset", value: null as any }], 4)
    expect(buf.diffSince(0)).toBe(null)
    expect(buf.diffSince(1)).toBeTruthy()
  })
})
