import { Parent, Derivable, Child } from "./types"

import { Reactor } from "./Reactor"

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
