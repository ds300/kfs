import { DiffBuffer } from "./DiffBuffer"
import { Diffable } from "./types"
import { transactionState } from "./transactionState"

interface Map<K, V> {
  diff(
    other: this,
  ): Array<{ type: "add"; key: K; value: V } | { type: "remove"; key: K }>
}

describe(DiffBuffer, () => {
  it("buffers diffs", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    buf.add({
      diff: [{ type: "reset", value: null as any }],
      fromEpoch: 0,
      toEpoch: 1,
    })
    buf.add({
      diff: [{ type: "add", key: "", value: 0 }],
      fromEpoch: 1,
      toEpoch: 2,
    })
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 2,
      toEpoch: 3,
    })
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
    buf.add({
      diff: [{ type: "reset", value: null as any }],
      fromEpoch: 0,
      toEpoch: 1,
    })
    buf.add(null)
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 2,
      toEpoch: 3,
    })
    expect(buf.diffSince(2)).toEqual([{ type: "remove", key: "" }])
    expect(buf.diffSince(1)).toEqual(null)
    expect(buf.diffSince(0)).toEqual(null)
  })
  it("truncates when there's a reset", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    buf.add({
      diff: [{ type: "reset", value: null as any }],
      fromEpoch: 0,
      toEpoch: 1,
    })
    buf.add({
      diff: [{ type: "add", key: "", value: 0 }],
      fromEpoch: 1,
      toEpoch: 2,
    })
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 2,
      toEpoch: 3,
    })
    buf.add({
      diff: [{ type: "reset", value: "blah" as any }],
      fromEpoch: 3,
      toEpoch: 4,
    })
    expect(buf.diffSince(3)).toEqual([{ type: "reset", value: "blah" as any }])
    expect(buf.diffSince(2)).toEqual([{ type: "reset", value: "blah" as any }])
    expect(buf.diffSince(1)).toEqual([{ type: "reset", value: "blah" as any }])
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 4,
      toEpoch: 5,
    })
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
    buf.add({
      diff: [{ type: "reset", value: null as any }],
      fromEpoch: 0,
      toEpoch: 1,
    })
    buf.add({
      diff: [{ type: "add", key: "", value: 0 }],
      fromEpoch: 1,
      toEpoch: 2,
    })
    expect(() => {
      buf.add({
        diff: [{ type: "remove", key: "" }],
        fromEpoch: 3,
        toEpoch: 3,
      })
    }).toThrow()
  })
  it("returns null if the epoch is too old", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    expect(buf.diffSince(0)).toBe(null)
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 0,
      toEpoch: 1,
    })
    expect(buf.diffSince(0)).toBeTruthy()
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 1,
      toEpoch: 2,
    })
    expect(buf.diffSince(0)).toBeTruthy()
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 2,
      toEpoch: 3,
    })
    expect(buf.diffSince(0)).toBeTruthy()
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 3,
      toEpoch: 4,
    })
    expect(buf.diffSince(0)).toBe(null)
    expect(buf.diffSince(1)).toBeTruthy()
  })
  it("buffers diffs during transactions", () => {
    const buf = new DiffBuffer<Map<string, number>>(3)
    buf.add({
      diff: [{ type: "reset", value: null as any }],
      fromEpoch: 0,
      toEpoch: 1,
    })
    buf.add({
      diff: [{ type: "add", key: "", value: 0 }],
      fromEpoch: 1,
      toEpoch: 2,
    })
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 2,
      toEpoch: 3,
    })
    transactionState.beginTransaction()
    expect(buf.transactionOverflow).toBeNull()
    // TODO: sanity check that fromEpoch in transaction makes sense
    buf.add({
      diff: [{ type: "remove", key: "" }],
      fromEpoch: 3,
      toEpoch: 4,
    })
    buf.add({
      diff: [{ type: "add", key: "four", value: 4 }],
      fromEpoch: 4,
      toEpoch: 5,
    })
    expect(buf.transactionOverflow!.length).toBe(2)
    buf.add({
      diff: [{ type: "remove", key: "four" }],
      fromEpoch: 5,
      toEpoch: 6,
    })
    expect(buf.transactionOverflow!.length).toBe(3)
    transactionState.endTransaction()
    expect(buf.transactionOverflow).toBeNull()
    expect(buf.diffs[buf.bufferHeadIndex]).toEqual({
      diff: [
        { type: "remove", key: "" },
        { type: "add", key: "four", value: 4 },
        { type: "remove", key: "four" },
      ],
      fromEpoch: 3,
      toEpoch: 6,
    })
    expect(buf.diffSince(3)).toEqual([
      { type: "remove", key: "" },
      { type: "add", key: "four", value: 4 },
      { type: "remove", key: "four" },
    ])
    expect(buf.diffSince(1)).toEqual([
      { type: "add", key: "", value: 0 },
      { type: "remove", key: "" },
      { type: "remove", key: "" },
      { type: "add", key: "four", value: 4 },
      { type: "remove", key: "four" },
    ])
  })
})
