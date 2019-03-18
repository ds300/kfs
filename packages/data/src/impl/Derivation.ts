import {
  Child,
  Parent,
  Derivable,
  Use,
  UseIncremental,
  DiffOf,
  diff,
  UnpackPromise,
} from "./types"

import { UseContext } from "./UseContext"

import { haveParentsChanged } from "./helpers"

import { Reactor } from "./Reactor"
import { DiffBuffer } from "./DiffBuffer"

export class Derivation<T> implements Child, Parent<T>, Derivable<T> {
  epoch = 0
  dirty = true
  children: Child[] = []
  diffChildren: Child[] = []
  parents: Parent<any>[] = []
  parentEpochs: number[] = []
  diffParents: Parent<any>[] = []
  diffParentEpochs: number[] = []
  diffs: DiffBuffer<UnpackPromise<T>> = new DiffBuffer(8)
  state: UnpackPromise<T> = (null as unknown) as UnpackPromise<T>
  constructor(public derive: (use: Use) => T) {
    this.derive = derive
  }
  ctx = new UseContext(this)
  isAsync = false

  __getValue(): T {
    this.ctx.startCapture()
    const result = this.derive(this.ctx.use)
    if (result instanceof Promise) {
      return (result.then((r: UnpackPromise<T>) => {
        this.ctx.stopCapture()
        this.dirty = false
        if (this.epoch === 0 || this.state !== r) {
          this.epoch++
          if (this.diffChildren.length > 0) {
            this.diffs.add({
              diff: diff(this.state, r),
              fromEpoch: this.epoch - 1,
              toEpoch: this.epoch,
            })
          } else {
            this.diffs.add(null)
          }
          this.isAsync = true
          this.state = r
        }
        return r
      }) as unknown) as T
    }

    this.dirty = false
    if (this.epoch === 0 || this.state !== result) {
      this.epoch++
      if (this.diffChildren.length > 0) {
        this.diffs.add({
          diff: diff(this.state, result as UnpackPromise<T>),
          fromEpoch: this.epoch - 1,
          toEpoch: this.epoch,
        })
      } else {
        this.diffs.add(null)
      }
      this.isAsync = false
      this.state = result as UnpackPromise<T>
    }
    this.ctx.stopCapture()
    return result
  }
  /**
   * what's the problem?
   * - a derivation already has an epoch for reified values, but if it is
   *   being diff-derefed then what should happen to that epoch?
   * What's the epoch for?
   * - it helps to keep track of whether the value has changed
   * So if you're diff-derefing a derivalbe and the diff is non-empty,
   * it should increment, right?
   * - right
   * So what's the problem?
   * - the problem is that maybe it already changed because the derivation was
   *   derefed
   * hmm so then it wouldn't know if it has already calculated a diff or not
   * - yah. and also the other way around. Maybe the derivable got diff-derefed
   *   and then someone wanted to know the main value.
   * hrm. so there's two different ways of calculating the same thing
   * - yep
   * and they are mutually exclusive
   *
   *
   *
   */

  __unsafe_get_value() {
    if (!this.dirty) {
      return (this.isAsync ? Promise.resolve(this.state) : this.state) as T
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
      return (this.isAsync ? Promise.resolve(this.state) : this.state) as T
    }
    return this.__getValue()
  }

  // assumes we're up to date
  __getDiff(sinceEpoch: number): DiffOf<UnpackPromise<T>> {
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
