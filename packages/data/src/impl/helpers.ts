import { Child, Parent } from "./types"

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
export function addChild(parent: Parent<any>, child: Child) {
  return addToArray(parent.children, child)
}

export function addDiffChild(parent: Parent<any>, child: Child) {
  return addToArray(parent.diffChildren, child)
}

export function removeChild(parent: Parent<any>, child: Child) {
  if (
    removeFromArray(parent.children, child) &&
    parent.children.length === 0 &&
    isChild(parent)
  ) {
    for (const grandparent of parent.parents) {
      removeChild(grandparent, parent)
    }
  }
}

export function removeDiffChild(parent: Parent<any>, child: Child) {
  if (
    removeFromArray(parent.diffChildren, child) &&
    parent.diffChildren.length === 0 &&
    isChild(parent)
  ) {
    for (const grandparent of parent.diffParents) {
      removeChild(grandparent, parent)
    }
  }
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
