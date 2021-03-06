import { Child, Parent, Use, DiffOf, diff, MaybePromise } from "./types"

import { UseContext } from "./UseContext"

import { haveParentsChanged, equals } from "./helpers"

import { Reactor } from "./Reactor"
import { DiffBuffer } from "./DiffBuffer"

export class Derivation<T> implements Child, Parent<T> {
  epoch = 0
  dirty = true
  children: Child[] = []
  diffChildren: Child[] = []
  parents: Parent<any>[] = []
  parentEpochs: number[] = []
  diffParents: Parent<any>[] = []
  diffParentEpochs: number[] = []
  diffs: DiffBuffer<T> = new DiffBuffer(8)
  state: T = (null as unknown) as T
  constructor(public derive: (use: Use) => MaybePromise<T>) {
    this.derive = derive
  }
  ctx = new UseContext(this)
  isAsync: boolean | null = null

  __handleNextValue(nextValue: T): T {
    this.ctx.stopCapture()
    this.dirty = false
    if (this.epoch === 0 || !equals(this.state, nextValue)) {
      this.epoch++
      if (this.diffChildren.length > 0) {
        this.diffs.add({
          diff: diff(this.state, nextValue),
          fromEpoch: this.epoch - 1,
          toEpoch: this.epoch,
        })
      } else {
        this.diffs.add(null)
      }
      this.state = nextValue
    }
    return nextValue
  }
  __getValue(): MaybePromise<T> {
    this.ctx.startCapture()
    const result = this.derive(this.ctx.use)
    if (result instanceof Promise) {
      if (this.isAsync === false) {
        throw new Error(
          "invariant violation: derive functions must consistently return a promise or consistently return an immediate value",
        )
      }
      this.isAsync = true
      return result.then((r: T) => this.__handleNextValue(r))
    } else {
      if (this.isAsync === true) {
        throw new Error(
          "invariant violation: derive functions must consistently return a promise or consistently return an immediate value",
        )
      }
      this.isAsync = false
    }

    return this.__handleNextValue(result)
  }

  __unsafe_get_value(): MaybePromise<T> {
    if (!this.dirty) {
      return this.isAsync ? Promise.resolve(this.state) : this.state
    }
    if (this.epoch === 0) {
      return this.__getValue()
    }
    const parentsHaveChanged = haveParentsChanged(this)
    if (parentsHaveChanged instanceof Promise) {
      return (parentsHaveChanged.then(haveChanged => {
        if (!haveChanged) {
          this.dirty = false
          return this.state
        }
        return this.__getValue()
      }) as unknown) as T
    }
    if (!parentsHaveChanged) {
      this.dirty = false
      return this.isAsync ? Promise.resolve(this.state) : this.state
    }
    return this.__getValue()
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

  __unsafe_get_diff(sinceEpoch: number) {
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
