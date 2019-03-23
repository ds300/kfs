import { atom, reactor, derive, Derivable } from "./api"
import { Diffable, DiffOf } from "./impl/types"
import { assertNever } from "./impl/helpers"

const deref = async <T>(derivable: Derivable<T>): Promise<T> => {
  return new Promise(resolve => {
    const r = reactor(use => {
      resolve(use(derivable))
    })
    r.start()
    r.stop()
  })
}

const timeout = (duration: number) => {
  return new Promise(r => setTimeout(r, duration))
}

describe("atoms", () => {
  it("is can be made", () => {
    expect(atom("init")).toBeTruthy()
  })

  it("can be reacted to", async () => {
    const state = atom("hello")
    expect(await deref(state)).toBe("hello")
  })

  it("can be reacted to multiple times", async () => {
    const state = atom("hello")
    const theValueIs = jest.fn()
    const r = await reactor(use => {
      theValueIs(use(state))
    }).start()
    expect(theValueIs).toHaveBeenCalledWith("hello")
    await state.update(_ => "hello world")
    expect(theValueIs).toHaveBeenCalledWith("hello world")
    r.stop()
  })
})

describe("reactors", () => {
  it("can be async", async () => {
    const a = atom("a")
    const b = atom("b")

    const theValueIs = jest.fn()
    const r = await reactor(async use => {
      const valA = use(a)
      await timeout(20)
      const valB = use(b)
      theValueIs(valA + valB)
    }).start()

    expect(theValueIs).toHaveBeenCalledWith("ab")

    await b.set("c")

    expect(theValueIs).toHaveBeenCalledWith("ac")

    expect(theValueIs).toHaveBeenCalledTimes(2)
    r.stop()
  })

  it("only react when the parent changes", async () => {
    const root = atom("banana")
    const anan = derive(use => {
      const match = use(root).match(/(an)+/)
      if (match) {
        return match[0]
      }
    })
    const theValueIs = jest.fn()
    const r = await reactor(use => {
      theValueIs(use(anan))
    }).start()
    expect(theValueIs).toHaveBeenCalledTimes(1)
    await root.set("bananana")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    await root.set("cananana")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    await root.set("dananana")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    await root.set("dan")
    expect(theValueIs).toHaveBeenCalledTimes(3)
    r.stop()
  })

  it("are cached with multiple parents", async () => {
    const wordA = atom("a")
    const wordB = atom("b")

    const aAndB = derive(use => {
      return use(wordA).startsWith("a") && use(wordB).startsWith("b")
    })

    const theValueIs = jest.fn()
    const r = await reactor(use => {
      theValueIs(use(aAndB))
    }).start()

    expect(theValueIs).toHaveBeenCalledTimes(1)
    await wordA.set("apple")
    expect(theValueIs).toHaveBeenCalledTimes(1)
    await wordB.set("banana")
    expect(theValueIs).toHaveBeenCalledTimes(1)
    await wordB.set("coffee")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    await wordB.set("drugs")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    await wordA.set("egads")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    await wordA.set("amigo")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    await wordB.set("brilliant")
    expect(theValueIs).toHaveBeenCalledTimes(3)
    r.stop()
  })

  it("can be incremental", async () => {
    const value = atom("hello")
    expect(await derefDiff(value)).toEqual([
      {
        type: "reset",
        value: "hello",
      },
    ])
  })

  it("can be incremental (diffable set)", async () => {
    const value = atom(new DiffableSet())
    expect(await derefDiff(value)).toEqual([
      {
        type: "reset",
        value: new DiffableSet(),
      },
    ])

    await value.update(val => val.add("cheese"))

    await value.update(val => val.add("mollusc"))

    expect(await derefDiff(value)).toEqual([
      {
        type: "reset",
        value: new DiffableSet().add("cheese").add("mollusc"),
      },
    ])
  })

  it("can be properly incremental (diffable set)", async () => {
    const value = atom(new DiffableSet())
    const theDiffIs = jest.fn()
    const r = await reactor(use => {
      theDiffIs(use.diff(value))
    }).start()

    expect(theDiffIs).toHaveBeenCalledWith([
      {
        type: "reset",
        value: new DiffableSet(),
      },
    ])

    await value.update(val => val.add("cheese"))

    expect(theDiffIs).toHaveBeenCalledWith([
      {
        type: "add",
        key: "cheese",
      },
    ])

    await value.update(val => val.add("mollusc").add("banana"))

    expect(theDiffIs).toHaveBeenCalledWith([
      {
        type: "add",
        key: "mollusc",
      },
      {
        type: "add",
        key: "banana",
      },
    ])

    await value.update(val => val.remove("mollusc").add("banana"))

    expect(theDiffIs).toHaveBeenCalledWith([
      {
        type: "remove",
        key: "mollusc",
      },
    ])

    await value.update(val =>
      val
        .remove("banana")
        .add("poughkeepsie")
        .add("joelle"),
    )

    expect(theDiffIs).toHaveBeenCalledWith([
      {
        type: "add",
        key: "poughkeepsie",
      },
      {
        type: "add",
        key: "joelle",
      },
      {
        type: "remove",
        key: "banana",
      },
    ])

    r.stop()
  })
})

const derefDiff = <T>(d: Derivable<T>) =>
  new Promise<DiffOf<T>>(async resolve =>
    (await reactor(use => resolve(use.diff(d))).start()).stop(),
  )

type SetDiff = { type: "add"; key: string } | { type: "remove"; key: string }

class DiffableSet implements Diffable<SetDiff> {
  constructor(public elements: string[] = []) {
    this.elements = elements
  }

  diff(prev: this) {
    if (prev === this) {
      return []
    }
    const result: SetDiff[] = []
    for (const elem of this.elements) {
      if (!prev.elements.includes(elem)) {
        result.push({
          type: "add",
          key: elem,
        })
      }
    }
    for (const elem of prev.elements) {
      if (!this.elements.includes(elem)) {
        result.push({
          type: "remove",
          key: elem,
        })
      }
    }
    return result
  }

  add(elem: string) {
    if (this.elements.includes(elem)) {
      return this
    }
    return new DiffableSet(this.elements.concat([elem]))
  }

  remove(elem: string) {
    if (!this.elements.includes(elem)) {
      return this
    }
    const index = this.elements.indexOf(elem)
    const newElems = this.elements
      .slice(0, index)
      .concat(this.elements.slice(index + 1))
    return new DiffableSet(newElems)
  }

  equals(other: this) {
    return (
      this.elements.length === other.elements.length &&
      this.elements.every(e => other.has(e))
    )
  }

  has(elem: string) {
    return this.elements.includes(elem)
  }
}

describe("derivations", () => {
  it("can be created", async () => {
    const word = atom("hello")
    const upper = derive(use => use(word).toUpperCase())

    expect(await deref(upper)).toBe("HELLO")
  })

  it("can be reacted to", async () => {
    const word = atom("hello")
    const upper = derive(use => use(word).toUpperCase())
    const theValueIs = jest.fn()
    const r = await reactor(use => {
      theValueIs(use(upper))
    }).start()

    expect(theValueIs).toHaveBeenCalledWith("HELLO")

    await word.set("banana")

    expect(theValueIs).toHaveBeenCalledWith("BANANA")

    r.stop()
  })

  it("can be async", async () => {
    const wordA = atom("button")
    const wordB = atom("down")

    const combined = derive(async use => {
      const a = use(wordA)
      await timeout(20)
      const b = use(wordB)

      return a + " " + b
    })

    const theValueIs = jest.fn()
    const r = await reactor(async use => {
      theValueIs(await use(combined))
    }).start()

    expect(theValueIs).toHaveBeenCalledWith("button down")

    await wordB.set("up")

    expect(theValueIs).toHaveBeenCalledWith("button up")

    r.stop()
  })

  it("can be passive incremental", async () => {
    const setA = atom(new DiffableSet())
    const setB = atom(new DiffableSet())
    const intersection = derive(use => {
      return new DiffableSet(use(setA).elements.filter(e => use(setB).has(e)))
    })

    const theDiffIs = jest.fn()
    const r = await reactor(use => {
      theDiffIs(use.diff(intersection))
    }).start()

    expect(theDiffIs).toBeCalledWith([
      {
        type: "reset",
        value: new DiffableSet(),
      },
    ])

    theDiffIs.mockReset()
    await setA.update(set => set.add("banana"))
    expect(theDiffIs).not.toHaveBeenCalled()
    await setB.update(set => set.add("banana"))
    expect(theDiffIs).toHaveBeenCalledWith([
      {
        type: "add",
        key: "banana",
      },
    ])
    r.stop()
  })

  it("can be active incremental", async () => {
    const setA = atom(new DiffableSet(["a", "b", "c"]))
    const setB = atom(new DiffableSet(["d", "e", "f"]))
    const union = derive(
      use => {
        return use(setA).elements.reduce((acc, e) => acc.add(e), use(setB))
      },
      {
        incremental: use => {
          const a = use(setA)
          const b = use(setB)
          const diffA = use.diff(setA)
          const diffB = use.diff(setB)

          //  idea!
          /**
           * make DiffHistory helper for diffable immutable data types
           * whenever you make a new version of your datatype, you add
           * a reference to the previous version along with a memoized
           * diff. It's a deque so the helper can trim it if it gets
           * too long. It will be hooked into the transaction system
           * and collapse diffs accrued during a transaction. It will
           * let the diffs grow arbitrarily long during a transaction.
           */

          const result: SetDiff[] = []
          for (const patch of diffA) {
            switch (patch.type) {
              case "reset":
                // bail out
                // if bail out, delete diff parents
                return use.reset()
              case "add":
                result.push(patch)
                break
              case "remove":
                if (!b.has(patch.key)) {
                  result.push(patch)
                }
                break
              default:
                assertNever(patch)
            }
          }
          for (const patch of diffB) {
            switch (patch.type) {
              case "reset":
                // bail out
                // if bail out, delete diff parents
                return use.reset()
              case "add":
                result.push(patch)
                break
              case "remove":
                if (!a.has(patch.key)) {
                  result.push(patch)
                }
                break
              default:
                assertNever(patch)
            }
          }
          return result
        },
      },
    )
  })
})

// caching [done? need more tests]
// incremental derivations
// pluggable equality
// transactions: global update function
// redux store + dispatch instead of atom as primary state container
// async derefs of derivations (wait on existing promise)
