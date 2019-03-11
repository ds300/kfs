function isChild(x: any): x is Child {
  return x instanceof Reactor
}

function addChild(parent: Parent<any>, child: Child) {
  if (!parent.children.includes(child)) {
    parent.children.push(child)
  }
}

function removeChild(parent: Parent<any>, child: Child) {
  const index = parent.children.indexOf(child)
  if (index >= 0) {
    parent.children.splice(index, 1)
    if (parent.children.length === 0 && isChild(parent)) {
      for (const grandparent of parent.parents) {
        removeChild(grandparent, parent)
      }
    }
  }
}

function __parentEpochsHaveChanged(child: Child) {
  const currentEpochs = child.parents.map(p => p.epoch)
  for (let i = 0; i < currentEpochs.length; i++) {
    if (currentEpochs[i] !== child.parentEpochs[i]) {
      return true
    }
  }
  return false
}

function haveParentsChanged(child: Child) {
  const parentValues = child.parents.map(p => p.__unsafe_get_value())
  if (parentValues.some(a => a instanceof Promise)) {
    return Promise.all(parentValues).then(() =>
      __parentEpochsHaveChanged(child),
    )
  }
  return __parentEpochsHaveChanged(child)
}

export interface Derivable<T> {
  __unsafe_get_value(): T
}

interface Child {
  parents: Parent<any>[]
  parentEpochs: number[]
  traverseReactors(cb: (reactor: Reactor) => void): void
}

interface Parent<T> extends Derivable<T> {
  children: Child[]
  epoch: number
  dirty: boolean
}

export class Atom<T> implements Parent<T>, Derivable<T> {
  constructor(initialState: T) {
    this.state = initialState
  }
  protected state: T
  dirty = false
  epoch = 0
  children: Child[] = []
  __unsafe_get_value() {
    return this.state
  }
  async set(value: T): Promise<T> {
    if (value === this.state) {
      return value
    }
    this.epoch++
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

export type Use = <T>(derivable: Derivable<T>) => T

class UseContext {
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
  use: Use = <T>(derivable: Derivable<T>) => {
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
  }
}

export class Derivation<T> implements Child, Parent<T>, Derivable<T> {
  epoch = 0
  dirty = true
  children: Child[] = []
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

  traverseReactors(cb: (r: Reactor) => void) {
    this.dirty = true
    for (const child of this.children) {
      child.traverseReactors(cb)
    }
  }
}

export class Reactor implements Child {
  constructor(protected reactFn: (use: Use) => void | Promise<void>) {
    this.reactFn = reactFn
  }
  ctx = new UseContext()
  stopping = false
  parents: Parent<any>[] = []
  parentEpochs: number[] = []
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
    this.ctx.stopCapture(this)
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
