import {
  Child,
  Parent,
  Use,
  UseIncremental,
  DiffOf,
  diff,
  MaybePromise,
} from "./types"

import { UseContext } from "./UseContext"

import { haveParentsChanged, equals } from "./helpers"

import { Reactor } from "./Reactor"
import { DiffBuffer } from "./DiffBuffer"

export class IncrementalDerivation<T> implements Child, Parent<T> {
  epoch = 0
  lastReificationEpoch = -1
  dirty = true
  children: Child[] = []
  diffChildren: Child[] = []
  parents: Parent<any>[] = []
  parentEpochs: number[] = []
  diffParents: Parent<any>[] = []
  diffParentEpochs: number[] = []
  diffs: DiffBuffer<T> = new DiffBuffer(8)
  state: T = (null as unknown) as T
  constructor(
    public derive: (use: Use) => MaybePromise<T>,
    public incrementalDerive: (use: UseIncremental) => MaybePromise<DiffOf<T>>,
  ) {
    this.incrementalDerive = incrementalDerive
    this.derive = derive
  }
  ctx = new UseContext(this)
  isAsync = false

  // assumes we're up-to-date on the diff front
  __getValue(diff: DiffOf<T>): T {
    for (const patch of diff as any) {
      if (patch.type === "reset") {
        this.state = patch.value
      } else {
        if (!this.state || typeof (this.state as any).patch !== "function") {
          throw new Error(
            "Incremental datatypes must support the `patch` operation",
          )
        }
        this.state = (this.state as any).patch(patch)
      }
    }

    this.lastReificationEpoch = this.epoch
    return this.state
  }

  __unsafe_get_value(): MaybePromise<T> {
    if (!this.dirty && this.lastReificationEpoch === this.epoch) {
      return this.isAsync ? Promise.resolve(this.state) : this.state
    }
    const diff = this.__unsafe_get_diff(this.lastReificationEpoch)
    if (diff instanceof Promise) {
      return diff.then(d => this.__getValue(d))
    }

    return this.__getValue(diff)
  }

  __reset(): MaybePromise<DiffOf<T>> {
    this.
  }

  // assumes we're up to date
  __getDiff(sinceEpoch: number): MaybePromise<DiffOf<T>> {
    if (sinceEpoch === this.epoch) {
      return []
    }
    return (
      this.diffs.diffSince(sinceEpoch) ||
      ([{ type: "reset", value: this.state }] as any)
    )
  }

  __unsafe_get_diff(sinceEpoch: number): MaybePromise<DiffOf<T>> {
    if (this.dirty) {
      const result = this.__unsafe_get_value()
      if (result instanceof Promise) {
        return result.then(() => this.__getDiff(sinceEpoch))
      }
    }
    return this.__getDiff(sinceEpoch)
  }

  traverseReactors(cb: (r: Reactor) => void) {
    this.dirty = true
    for (const child of this.children) {
      child.traverseReactors(cb)
    }
    for (const child of this.diffChildren) {
      child.traverseReactors(cb)
    }
  }
}
