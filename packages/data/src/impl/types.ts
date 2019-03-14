import { Reactor } from "./Reactor"

export type UnpackPromise<T> = T extends Promise<infer R> ? R : T

export interface Derivable<T> {
  __unsafe_get_value(): T
  __unsafe_get_diff(sinceEpoch: number): MaybePromise<DiffOf<UnpackPromise<T>>>
}

export interface Child {
  parents: Parent<any>[]
  parentEpochs: number[]
  traverseReactors(cb: (reactor: Reactor) => void): void
}

export interface Parent<T> extends Derivable<T> {
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
  diff<T>(derivable: Derivable<T>): MaybePromise<DiffOf<T>>
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
