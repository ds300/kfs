import { Parent, Child } from "./types"
import { addToArray, removeFromArray, isChild } from "./helpers"

// TODO: upgrade to Set once average number of marked children reaches a certain size?
let markedChildren: (Parent<any> & Child)[] | null = null

export function beginMarkPhase() {
  markedChildren = []
}

function mark(child: Parent<any> & Child) {
  if (!markedChildren) {
    throw new Error("invalid state: mark called outside of mark phase")
  }
  addToArray(markedChildren, child)
}

export function sweep() {
  if (!markedChildren) {
    throw new Error("invalid state: sweep called outside of mark phase")
  }
  const marked = markedChildren
  markedChildren = null

  for (const child of marked) {
    if (child.children.length === 0 && child.diffChildren.length === 0) {
      detach(child)
    }
  }
}

export function addChild(parent: Parent<any>, child: Child) {
  return addToArray(parent.children, child)
}

export function addDiffChild(parent: Parent<any>, child: Child) {
  return addToArray(parent.diffChildren, child)
}

function detach(child: Child) {
  for (const parent of child.parents) {
    removeChild(parent, child, true)
  }
  for (const parent of child.diffParents) {
    removeDiffChild(parent, child, true)
  }
}

export function removeChild(
  parent: Parent<any>,
  child: Child,
  detaching = false,
) {
  if (
    removeFromArray(parent.children, child) &&
    parent.children.length === 0 &&
    parent.diffChildren.length === 0 &&
    isChild(parent)
  ) {
    if (detaching) {
      detach(parent)
    } else {
      mark(parent)
    }
  }
}

export function removeDiffChild(
  parent: Parent<any>,
  child: Child,
  detaching = false,
) {
  if (
    removeFromArray(parent.diffChildren, child) &&
    parent.diffChildren.length === 0 &&
    parent.children.length === 0 &&
    isChild(parent)
  ) {
    if (detaching) {
      detach(parent)
    } else {
      mark(parent)
    }
  }
}
