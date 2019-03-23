import { Child, Parent, MaybePromise } from "./types"

export function isChild(x: any): x is Child {
  return x && Array.isArray(x.parents)
}

export function addToArray<T>(arr: T[], elem: T) {
  if (arr.indexOf(elem) < 0) {
    arr.push(elem)
    return true
  }
  return false
}

export function removeFromArray<T>(arr: T[], elem: T) {
  const index = arr.indexOf(elem)
  if (index >= 0) {
    arr.splice(index, 1)
    return true
  }
  return false
}

export function transformMaybePromise<T, R>(
  val: MaybePromise<T>,
  map: (val: T) => MaybePromise<R>,
): MaybePromise<R> {
  if (val instanceof Promise) {
    return val.then(map)
  }
  return map(val)
}

function __parentEpochsHaveChanged(child: Child) {
  {
    const currentEpochs = child.parents.map(p => p.epoch)
    for (let i = 0; i < currentEpochs.length; i++) {
      if (currentEpochs[i] !== child.parentEpochs[i]) {
        return true
      }
    }
  }
  const currentDiffEpochs = child.diffParents.map(p => p.epoch)
  for (let i = 0; i < currentDiffEpochs.length; i++) {
    if (currentDiffEpochs[i] !== child.diffParentEpochs[i]) {
      return true
    }
  }
  return false
}

export function haveParentsChanged(child: Child) {
  const parentValues = child.parents
    .map(p => p.__unsafe_get_value())
    .concat(
      child.diffParents.map((p, index) =>
        p.__unsafe_get_diff(child.diffParentEpochs[index]),
      ),
    )
  // TODO: test that it works when mixing .diff and regular deref.
  if (parentValues.some(a => a instanceof Promise)) {
    return Promise.all(parentValues).then(() =>
      __parentEpochsHaveChanged(child),
    )
  }
  return __parentEpochsHaveChanged(child)
}

export function equals(a: any, b: any) {
  return (
    a === b ||
    Object.is(a, b) ||
    Boolean(a && b && typeof a.equals === "function" && a.equals(b))
  )
}

export declare function assertNever(x: never): never
