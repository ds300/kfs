import {
  Parent,
  Child,
  UseIncremental,
  Derivable,
  DiffOf
} from "./types"
import { addChild, removeChild } from "./helpers"

export class UseContext {
  capturing = false
  parents: Parent<any>[] = []
  epochs: number[] = []
  startCapture() {
    this.capturing = true
    this.parents = []
    this.epochs = []
  }
  stopCapture(child: Child) {
    this.capturing = false
    // todo: manage parent subscriptions
    for (const parent of this.parents) {
      addChild(parent, child)
    }
    for (const parent of child.parents) {
      if (this.parents.indexOf(parent) < 0) {
        removeChild(parent, child)
      }
    }
    child.parents = this.parents
    child.parentEpochs = this.epochs
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
        return [{ type: "reset", value: this.use(derivable) }] as any
      },
    },
  )
}
