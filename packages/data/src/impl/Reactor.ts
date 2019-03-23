import { Child, Use, Parent, UseIncremental } from "./types"

import { UseContext } from "./UseContext"

import { haveParentsChanged } from "./helpers"
import { removeChild } from "./markAndSweep"

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
    // only bail out if havn't started capturing yet
    if (
      (this.parents.length || this.diffParents.length) &&
      !parentsHaveChanged
    ) {
      return
    }
    this.ctx.startCapture()
    const result = this.reactFn(this.ctx.use)
    if (result) {
      await result
    }
    this.ctx.stopCapture()
    if (this.diffParents.length + this.parents.length === 0) {
      console.error("reactor failed to use any derivables. stopping.")
      this._stop()
      return
    }
    if (this.stopping) {
      this._stop()
    }
  }
  traverseReactors(cb: (r: Reactor) => void) {
    cb(this)
  }
  _stop() {
    for (const parent of this.parents) {
      removeChild(parent, this, true)
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
