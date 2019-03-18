import { Child, Use, Parent, UseIncremental } from "./types"

import { UseContext } from "./UseContext"

import { haveParentsChanged, removeChild } from "./helpers"

export class Reactor implements Child {
  constructor(
    protected reactFn: (use: UseIncremental) => void | Promise<void>,
  ) {
    this.reactFn = reactFn
  }
  ctx = new UseContext(this)
  stopping = false
  parents: Parent<any>[] = []
  parentEpochs: number[] = []
  diffParents: Parent<any>[] = []
  diffParentEpochs: number[] = []
  async react() {
    let parentsHaveChanged = haveParentsChanged(this)
    if (parentsHaveChanged instanceof Promise) {
      parentsHaveChanged = await parentsHaveChanged
    }
    if (this.parents.length && !parentsHaveChanged) {
      return
    }
    this.ctx.startCapture()
    const result = this.reactFn(this.ctx.use)
    if (result) {
      await result
    }
    this.ctx.stopCapture()
    if (this.stopping) {
      this._stop()
    }
  }
  traverseReactors(cb: (r: Reactor) => void) {
    cb(this)
  }
  _stop() {
    for (const parent of this.parents) {
      removeChild(parent, this)
    }
    this.parents = []
  }
  stop() {
    if (this.ctx.capturing) {
      this.stopping = true
    } else {
      this._stop()
    }
    return this
  }
  start() {
    if (this.ctx.capturing) {
      this.stopping = false
    } else {
      this.react()
    }
    return this
  }
}
