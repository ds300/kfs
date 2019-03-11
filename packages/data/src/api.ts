import {
  Reactor as ReactorImpl,
  Atom,
  Derivation,
  Derivable,
} from "./implementation"

export { Derivable }

export interface Store<T> extends Derivable<T> {
  set(value: T): Promise<T>
  update(updater: (val: T) => T): Promise<T>
}

export interface Reactor {
  start(): this
  stop(): this
}

export type Use = <T>(derivable: Derivable<T>) => T

export function reactor(
  reactFn: (use: UseIncremental) => void | Promise<void>,
): Reactor {
  return new ReactorImpl(reactFn as any)
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

export interface Diffable<Diff extends { type: string }> {
  diff(other: this): Diff[]
}

export interface BaseDiff<T> {
  type: "reset"
  value: T
}

export type MaybePromise<T> = T | Promise<T>

export type UseIncremental = Use & {
  diff<T>(derivable: Derivable<T>): MaybePromise<Array<ExtractDiffType<T>>>
}

type ExtractDiffType<T> = T extends Diffable<infer D>
  ? D
  : T extends Promise<Diffable<infer D>>
  ? D
  : BaseDiff<T>

export function derive<T>(
  deriver: (use: Use) => T,
  options?: {
    incremental: (use: UseIncremental) => MaybePromise<ExtractDiffType<T>[]>
  },
): Derivable<T> {
  return new Derivation(deriver as any) as any
}
