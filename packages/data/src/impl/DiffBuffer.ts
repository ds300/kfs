import { DiffOf } from "./types"

export class DiffBuffer<T> {
  lastEpoch: number = 0
 
  diffs: (DiffOf<T> | null)[]
  constructor(size: number) {
    this.diffs = new Array(size)
  }

  add(diff: DiffOf<T> | null, epoch: number) {
    if (epoch !== this.lastEpoch + 1) {
      throw new Error("must submit a diff for every epoch")
    }
    this.lastEpoch = epoch
    this.diffs[epoch % this.diffs.length] = diff
  }

  diffSince(epoch: number): DiffOf<T> | null {
    if (this.lastEpoch - epoch > this.diffs.length) {
      return null
    }
    let result: DiffOf<T> = []

    for (let i = epoch + 1; i <= this.lastEpoch; i++) {
      const diff = this.diffs[i % this.diffs.length]
      if (!diff) {
        return null
      }
      result.push(...diff)
    }

    if (result.length === 0) {
      return null
    }

    let i = result.length
    while (i--) {
      if ((result[i] as any).type === "reset") {
        return result.slice(i)
      }
    }

    return result
  }
}
