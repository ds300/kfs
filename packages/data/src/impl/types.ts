import { Reactor } from "./Reactor"

export type UnpackPromise<T> = T extends Promise<infer R> ? R : T

export interface SyncDerivable<T> {
  __unsafe_get_value(): T
  __unsafe_get_diff(sinceEpoch: number): DiffOf<T>
}
export interface AsyncDerivable<T> {
  __unsafe_get_value(): Promise<T>
  __unsafe_get_diff(sinceEpoch: number): Promise<DiffOf<T>>
}

export type Derivable<T> = T extends Promise<infer R>
  ? AsyncDerivable<R>
  : SyncDerivable<T>

export interface Child {
  parents: Parent<any>[]
  parentEpochs: number[]
  diffParents: Parent<any>[]
  diffParentEpochs: number[]
  traverseReactors(cb: (reactor: Reactor) => void): void
}

export interface Parent<T> {
  __unsafe_get_value(): unknown
  __unsafe_get_diff(sinceEpoch: number): unknown
  children: Child[]
  diffChildren: Child[]
  epoch: number
  dirty: boolean
}

export interface Diffable<Diff> {
  diff(other: any): Diff[]
}

export interface BaseDiff<T> {
  type: "reset"
  value: T
}

export type MaybePromise<T> = T | Promise<T>

export type UseIncremental = Use & {
  diff<T>(
    derivable: Derivable<T>,
  ): ReturnType<Derivable<T>["__unsafe_get_diff"]>
  // TODO: keep this out of reactors
  reset(): never
}

export type Use = <T>(derivable: Derivable<T>) => T

type ExtractDiffType<T> = T extends Diffable<infer D>
  ? D | BaseDiff<T>
  : T extends Promise<Diffable<infer D>>
  ? D | BaseDiff<T>
  : BaseDiff<T>

export type DiffOf<T> = ExtractDiffType<T>[]

function isDiffable(x: any): x is Diffable<any> {
  return typeof x === "object" && x !== null && typeof x.diff === "function"
}

export const diff = <T>(prev: T, next: T): DiffOf<T> => {
  if (isDiffable(next)) {
    return next.diff(prev) as any
  } else {
    return [
      {
        type: "reset",
        value: next,
      } as any,
    ]
  }
}
