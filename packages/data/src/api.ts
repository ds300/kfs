import { Reactor, Atom, Derivation, Derivable } from "./implementation"

export { Derivable }

export interface Store<T> extends Derivable<T> {
  set(value: T): Promise<T>
  update(updater: (val: T) => T): Promise<T>
}

export type Use = <T>(derivable: Derivable<T>) => T

export function reactor(reactFn: (use: Use) => void | Promise<void>) {
  return new Reactor(reactFn as any)
}

export function when(
  condition: Derivable<any>,
  reactFn: (use: Use) => void | Promise<void>,
) {
  const subordinate = reactor(reactFn)
  const leader = reactor(async use => {
    if (await Promise.resolve(use(condition as any))) {
      leader.stop()
      subordinate.start()
    }
  })
}

export function atom<T>(init: T): Store<T> {
  return new Atom(init) as any
}

export function derive<T>(deriver: (use: Use) => T): Derivable<T> {
  return new Derivation(deriver as any) as any
}
