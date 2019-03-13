import { Child, Parent } from "./types"

export function isChild(x: any): x is Child {
  return x && Array.isArray(x.parents)
}

export function addChild(parent: Parent<any>, child: Child) {
  if (!parent.children.includes(child)) {
    parent.children.push(child)
  }
}

export function removeChild(parent: Parent<any>, child: Child) {
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

export function haveParentsChanged(child: Child) {
  const parentValues = child.parents.map(p => p.__unsafe_get_value())
  if (parentValues.some(a => a instanceof Promise)) {
    return Promise.all(parentValues).then(() =>
      __parentEpochsHaveChanged(child),
    )
  }
  return __parentEpochsHaveChanged(child)
}
