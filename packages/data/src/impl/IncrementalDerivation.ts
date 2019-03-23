import {
  Child,
  Parent,
  Use,
  UseIncremental,
  DiffOf,
  diff,
  MaybePromise,
} from "./types"

import { UseContext, RESET } from "./UseContext"

import { haveParentsChanged, equals, transformMaybePromise } from "./helpers"

import { Reactor } from "./Reactor"
import { DiffBuffer } from "./DiffBuffer"
import { removeChild } from "./markAndSweep"

export class IncrementalDerivation<T> implements Child, Parent<T> {
  epoch = 0
  lastReificationEpoch = 0
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
  isAsync: boolean | null = null

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

    return transformMaybePromise(diff, d => this.__getValue(d))
  }

  __handleNextFreshValue(nextValue: T): T {
    this.ctx.stopCapture()
    this.dirty = false
    if (this.epoch === 0 || !equals(this.state, nextValue)) {
      this.epoch++
      this.diffs.add({
        diff:
          this.epoch === 1
            ? ([{ type: "reset", value: nextValue }] as DiffOf<T>)
            : diff(this.state, nextValue),
        fromEpoch: this.lastReificationEpoch,
        toEpoch: this.epoch,
      })
      this.state = nextValue
    }
    this.lastReificationEpoch = this.epoch
    return nextValue
  }

  __getFreshValue(): MaybePromise<T> {
    this.ctx.startCapture()
    const result = this.derive(this.ctx.use)
    if (result instanceof Promise) {
      if (this.isAsync === false) {
        throw new Error(
          "invariant violation: derive functions must consistently return a promise or consistently return an immediate value",
        )
      }
      this.isAsync = true
    } else {
      if (this.isAsync === true) {
        throw new Error(
          "invariant violation: derive functions must consistently return a promise or consistently return an immediate value",
        )
      }
      this.isAsync = false
    }

    return transformMaybePromise(result, r => this.__handleNextFreshValue(r))
  }

  __reset(): MaybePromise<DiffOf<T>> {
    for (const parent of this.diffParents) {
      removeChild(parent, this)
    }
    this.diffParents = []
    this.diffParentEpochs = []
    this.diffs = new DiffBuffer(8)
    const nextValue = this.__getFreshValue()
    return transformMaybePromise(nextValue, () =>
      this.__getDiff(this.epoch - 1),
    )
  }

  // assumes we're up to date
  __getDiff(sinceEpoch: number): MaybePromise<DiffOf<T>> {
    if (sinceEpoch === this.epoch) {
      return []
    }
    const diff = this.diffs.diffSince(sinceEpoch)
    if (diff) {
      return diff
    }
    const state = this.__getFreshValue()
    return transformMaybePromise(
      state,
      () => [{ type: "reset", value: this.state }] as any,
    )
  }

  __incrementalDiff(): MaybePromise<void> {
    this.ctx.startCapture()
    const result = this.incrementalDerive(this.ctx.use)
    if (result instanceof Promise) {
      if (this.isAsync === false) {
        throw new Error(
          "invariant violation: derive functions must consistently return a promise or consistently return an immediate value",
        )
      }
      this.isAsync = true
    } else {
      if (this.isAsync === true) {
        throw new Error(
          "invariant violation: derive functions must consistently return a promise or consistently return an immediate value",
        )
      }
      this.isAsync = false
    }

    return transformMaybePromise(result, diff => {
      this.ctx.stopCapture()
      if (diff === (RESET as any)) {
        return transformMaybePromise(this.__reset(), () => void 0)
      }
      if (!Array.isArray(diff)) {
        throw new Error("diff must be array")
      }
    })
  }

  __unsafe_get_diff(sinceEpoch: number): MaybePromise<DiffOf<T>> {
    if (!this.dirty) {
      return this.__getDiff(sinceEpoch)
    }
    const parentsHaveChanged = haveParentsChanged(this)

    return transformMaybePromise(parentsHaveChanged, changed => {
      if (!changed) {
        this.dirty = false
        return this.__getDiff(sinceEpoch)
      }

      return transformMaybePromise(this.__incrementalDiff(), () => {
        this.dirty = false
        return this.__getDiff(sinceEpoch)
      })
    })
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
