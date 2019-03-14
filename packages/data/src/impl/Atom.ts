import { Parent, Derivable, Child, DiffOf, Diffable } from "./types"

import { Reactor } from "./Reactor"
import { DiffBuffer } from "./DiffBuffer"

function isDiffable(x: any): x is Diffable<any> {
  return typeof x === "object" && x !== null && typeof x.diff === "function"
}

const diff = <T>(prev: T, next: T): DiffOf<T> => {
  if (isDiffable(next)) {
    return next.diff(prev) as any
  } else {
    return [
      {
        type: "reset",
        value: next,
      } as any,
    ]
  }
}

export class Atom<T> implements Parent<T>, Derivable<T> {
  constructor(initialState: T) {
    this.state = initialState
  }
  protected state: T
  dirty = false
  epoch = 0
  diffs = new DiffBuffer<T>(8)
  children: Child[] = []
  diffChildren: Child[] = []
  __unsafe_get_value() {
    return this.state
  }
  __unsafe_get_diff(sinceEpoch: number) {
    if (sinceEpoch === this.epoch) {
      return []
    }
    return (
      this.diffs.diffSince(sinceEpoch) ||
      ([{ type: "reset", value: this.state }] as any)
    )
  }
  async set(value: T): Promise<T> {
    if (value === this.state) {
      return value
    }
    this.epoch++
    if (this.diffChildren.length > 0) {
      this.diffs.add({
        diff: diff(this.state, value),
        fromEpoch: this.epoch - 1,
        toEpoch: this.epoch,
      })
    } else {
      this.diffs.add(null)
    }
    const reactors: Reactor[] = []
    this.state = value
    for (const child of this.children) {
      child.traverseReactors(r => {
        if (!reactors.includes(r)) {
          reactors.push(r)
        }
      })
    }
    // TODO: handle timeouts
    await Promise.all(reactors.map(r => r.react()))
    return value
  }
  update(updater: (value: T) => T): Promise<T> {
    return this.set(updater(this.state))
  }
}
