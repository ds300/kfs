import { Child, Parent, Derivable, Use } from "./types"

import { UseContext } from "./UseContext"

import { haveParentsChanged } from "./helpers"

import { Reactor } from "./Reactor"

export class Derivation<T> implements Child, Parent<T>, Derivable<T> {
  epoch = 0
  dirty = true
  children: Child[] = []
  diffChildren: Child[] = []
  parents: Parent<any>[] = []
  parentEpochs: number[] = []
  state: T = (null as unknown) as T
  constructor(public derive: (use: Use) => T) {
    this.derive = derive
  }
  ctx = new UseContext()

  __getValue(): T {
    this.ctx.startCapture()
    const result = this.derive(this.ctx.use)
    if (result instanceof Promise) {
      this.state = (result.then(r => {
        this.ctx.stopCapture(this)
        this.dirty = false
        if (this.epoch === 0 || this.state !== r) {
          this.epoch++
          this.state = r
        }
        return r
      }) as unknown) as T
      return this.state
    }

    this.dirty = false
    if (this.epoch === 0 || this.state !== result) {
      this.epoch++
      this.state = result
    }
    this.ctx.stopCapture(this)
    return result
  }

  __unsafe_get_value() {
    if (!this.dirty) {
      return this.state
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
      return this.state
    }
    return this.__getValue()
  }
  __unsafe_get_diff() {
    return null as any
  }

  traverseReactors(cb: (r: Reactor) => void) {
    this.dirty = true
    for (const child of this.children) {
      child.traverseReactors(cb)
    }
  }
}
