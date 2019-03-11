import { Reactor } from "./Reactor"

export interface Derivable<T> {
  __unsafe_get_value(): T
}

export interface Child {
  parents: Parent<any>[]
  parentEpochs: number[]
  traverseReactors(cb: (reactor: Reactor) => void): void
}

export interface Parent<T> extends Derivable<T> {
  children: Child[]
  epoch: number
  dirty: boolean
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

export type Use = <T>(derivable: Derivable<T>) => T

export type ExtractDiffType<T> = T extends Diffable<infer D>
  ? D & BaseDiff<T>
  : T extends Promise<Diffable<infer D>>
  ? D & BaseDiff<T>
  : BaseDiff<T>
