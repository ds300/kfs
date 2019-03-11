import { atom, reactor, derive, Derivable, BaseDiff } from "./api"

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

  it("can be reacted to", () => {
    const state = atom("hello")
    reactor(use => {
      const val = use(state)
      expect(val).toBe("hello")
    }).start()
    expect.assertions(1)
  })

  it("can be reacted to multiple times", async () => {
    const state = atom("hello")
    const theValueIs = jest.fn()
    reactor(use => {
      theValueIs(use(state))
    }).start()
    expect(theValueIs).toHaveBeenCalledWith("hello")
    state.update(_ => "hello world")
    await timeout(10)
    expect(theValueIs).toHaveBeenCalledWith("hello world")
  })
})

describe("reactors", () => {
  it("can be async", async () => {
    const a = atom("a")
    const b = atom("b")

    const theValueIs = jest.fn()
    reactor(async use => {
      const valA = use(a)
      await timeout(20)
      const valB = use(b)
      theValueIs(valA + valB)
    }).start()

    await timeout(30)
    expect(theValueIs).toHaveBeenCalledWith("ab")

    b.set("c")

    await timeout(30)
    expect(theValueIs).toHaveBeenCalledWith("ac")

    expect(theValueIs).toHaveBeenCalledTimes(2)
  })

  it("only react when the parent changes", () => {
    const root = atom("banana")
    const anan = derive(use => {
      const match = use(root).match(/(an)+/)
      if (match) {
        return match[0]
      }
    })
    const theValueIs = jest.fn()
    const r = reactor(use => {
      theValueIs(use(anan))
    }).start()
    expect(theValueIs).toHaveBeenCalledTimes(1)
    root.set("bananana")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    root.set("cananana")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    root.set("dananana")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    root.set("dan")
    expect(theValueIs).toHaveBeenCalledTimes(3)
    r.stop()
  })

  it("are cached with multiple parents", () => {
    const wordA = atom("a")
    const wordB = atom("b")

    const aAndB = derive(use => {
      return use(wordA).startsWith("a") && use(wordB).startsWith("b")
    })

    const theValueIs = jest.fn()
    const r = reactor(use => {
      theValueIs(use(aAndB))
    }).start()

    expect(theValueIs).toHaveBeenCalledTimes(1)
    wordA.set("apple")
    expect(theValueIs).toHaveBeenCalledTimes(1)
    wordB.set("banana")
    expect(theValueIs).toHaveBeenCalledTimes(1)
    wordB.set("coffee")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    wordB.set("drugs")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    wordA.set("egads")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    wordA.set("amigo")
    expect(theValueIs).toHaveBeenCalledTimes(2)
    wordB.set("brilliant")
    expect(theValueIs).toHaveBeenCalledTimes(3)
    r.stop()
  })
})

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
    const r = reactor(use => {
      theValueIs(use(upper))
    }).start()

    expect(theValueIs).toHaveBeenCalledWith("HELLO")

    word.set("banana")

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
    const r = reactor(async use => {
      theValueIs(await use(combined))
    }).start()

    await timeout(30)
    expect(theValueIs).toHaveBeenCalledWith("button down")

    wordB.set("up")

    await timeout(30)
    expect(theValueIs).toHaveBeenCalledWith("button up")

    r.stop()
  })

  it("can be incremental", async () => {
    const root = atom("banana")
    const reversed = derive(
      use =>
        use(root)
          .split("")
          .reverse()
          .join(""),
      {
        incremental: async use => {
          const diff = await use.diff(root)
          return diff.map(patch => {
            switch (patch.type) {
              case "reset":
                return {
                  type: "reset" as "reset",
                  value: patch.value
                    .split("")
                    .reverse()
                    .join(""),
                }
            }
          })
        },
      },
    )
    const theValueIs = jest.fn()

    const r = reactor(async use => {
      theValueIs(await use.diff(reversed))
    }).start()

    await timeout(1)

    expect(theValueIs).toHaveBeenCalledWith("ananab")

    r.stop()
  })
})

// caching [done? need more tests]
// incremental derivations
// pluggable equality
// transactions: global update function
// redux store + dispatch instead of atom as primary state container
// async derefs of derivations (wait on existing promise)
