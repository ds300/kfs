import { Parent, Child, UseIncremental, Derivable, DiffOf } from "./types"
import { addChild, removeChild, addDiffChild } from "./helpers"

export class UseContext {
  child: Child
  constructor(child: Child) {
    this.child = child
  }
  capturing = false
  parents: Parent<any>[] = []
  epochs: number[] = []
  diffParents: Parent<any>[] = []
  diffEpochs: number[] = []
  startCapture() {
    this.capturing = true
    this.parents = []
    this.epochs = []
    this.diffParents = []
    this.diffEpochs = []
  }
  stopCapture() {
    this.capturing = false
    for (const parent of this.parents) {
      addChild(parent, this.child)
    }
    for (const parent of this.child.parents) {
      if (this.parents.indexOf(parent) < 0) {
        removeChild(parent, this.child)
      }
    }
    this.child.parents = this.parents
    this.child.parentEpochs = this.epochs

    for (const parent of this.diffParents) {
      addDiffChild(parent, this.child)
    }
    for (const parent of this.child.diffParents) {
      if (this.diffParents.indexOf(parent) < 0) {
        removeChild(parent, this.child)
      }
    }
    this.child.diffParents = this.diffParents
    this.child.diffParentEpochs = this.diffEpochs
  }
  use: UseIncremental = Object.assign(
    <T>(derivable: Derivable<T>) => {
      const parent = (derivable as unknown) as Parent<T>
      if (!this.capturing) {
        // TODO: use epoch numbers for capturing too
        throw new Error("`use` called out of scope.")
      }
      if (this.parents.indexOf(parent) < 0) {
        this.parents.push(parent)
        this.epochs.push(0)
      }
      const result = derivable.__unsafe_get_value()
      if (result instanceof Promise) {
        return (result.then(r => {
          this.epochs[this.parents.indexOf(parent)] = parent.epoch
          return r
        }) as unknown) as T
      }
      this.epochs[this.parents.indexOf(parent)] = parent.epoch
      return result
    },
    {
      diff: <T>(derivable: Derivable<T>): DiffOf<T> => {
        const parent = (derivable as unknown) as Parent<T>
        if (!this.capturing) {
          // TODO: use epoch numbers for capturing too
          throw new Error("`use` called out of scope.")
        }
        let parentIndex = this.diffParents.indexOf(parent)
        if (parentIndex < 0) {
          this.diffParents.push(parent)
          this.diffEpochs.push(-1)
          parentIndex = this.diffParents.length - 1
        }

        const previousEpoch = this.child.diffParentEpochs[
          this.child.diffParents.indexOf(parent)
        ]
        const result = derivable.__unsafe_get_diff(
          typeof previousEpoch === "number" ? previousEpoch : -1,
        )
        if (result instanceof Promise) {
          return (result.then(r => {
            if (parentIndex !== this.diffParents.indexOf(parent)) {
              throw new Error(
                "invariant violation: parentIndex should still be valid here",
              )
            }
            this.diffEpochs[parentIndex] = parent.epoch
            if (!Array.isArray(r)) {
              throw new Error("invariant violation: diffs must be arrays")
            }
            return r
          }) as unknown) as DiffOf<T>
        }
        this.diffEpochs[parentIndex] = parent.epoch
        if (!Array.isArray(result)) {
          throw new Error("invariant violation: diffs must be arrays")
        }
        return result as DiffOf<T>
      },
    },
  )
}
