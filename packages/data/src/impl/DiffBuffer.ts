import { DiffOf } from "./types"
import { transactionState } from "./transactionState"

// need 'diffChildren'
// if an atom has diff children, compute and store diffs up until the next epoch
// assume only one epoch of history is enough for now.

// all you need to get generative property based tests are:
// a) a thing to turn your diffs into your main type
// b) generative versions of input sources.

// update(use => { ... }) global function for transactions
// no nested transactions. atoms save diffs in separate place
// if inside of transaction
// need separate epoch system for transactions to make derefing
// derivables during a transaction not fuck up reactors.
// or, just change this diff buffer to store [epoch, diff]
// tuples. Then, during a transaction, store another growable
// buffer, and after the transaction has been committed, collapse
// the diff that accumulated.
// could also not bother with that if the derivable has no
// direct reactor children.
// actually no, we should do it for any derivables which have
// a direct reactor child or have been derefed directly during
// a transaction and also have active children.

// diff buffer is probably not going to be useful
// we should be able to get away with 'last diff' and 'last diff epoch'
// and then the same for 'last transaction diff' and 'last transaction epoch'
// think of the situation like
/**
 *      a
 *     /  \
 *    b    c
 *
 * b is a derivation, c is a reactor,
 * a is changed 5 times during a transaction,
 * b is deref'd each time a changes
 *
 * After the transaction commits c is going to want to know diffSince 0
 * b is going to want to know diffSince 4
 *
 */
// then make transaction functions async
// still need a growable buffer

function flatten<T>(arr: T[][]): T[] {
  if (arr.length === 0) {
    return []
  }
  if (arr.length === 1) {
    return arr[0]
  }

  const result: T[] = []

  for (const child of arr) {
    result.push(...child)
  }

  return result
}

function normalizeDiff<T>(diff: DiffOf<T>) {
  let i = diff.length
  while (i--) {
    if (i > 0 && (diff[i] as any).type === "reset") {
      return diff.slice(i)
    }
  }
  return diff
}

export interface DiffRecord<T> {
  fromEpoch: number
  toEpoch: number
  diff: DiffOf<T>
}

export class DiffBuffer<T> {
  epochBeforeFirstModifiedDuringTransaction: number | null = null

  transactionOverflow: null | DiffRecord<T>[] = null
  diffs: (DiffRecord<T> | null)[]
  bufferHeadIndex: number = 0
  constructor(size: number) {
    this.diffs = new Array(size)
  }

  // TODO: decide whether it should collapse all the diffs but the last one
  // for things that have been derefin' during the transaction
  transactionEnded() {
    if (this.transactionOverflow) {
      const transactionDiffRecord: DiffRecord<T> = {
        fromEpoch: this.epochBeforeFirstModifiedDuringTransaction!,
        toEpoch: this.transactionOverflow[this.transactionOverflow.length - 1]
          .toEpoch,
        diff: [],
      }
      for (const { diff } of this.transactionOverflow) {
        transactionDiffRecord.diff.push(...diff)
      }
      this.add(transactionDiffRecord)
    }
    this.epochBeforeFirstModifiedDuringTransaction = null
    this.transactionOverflow = null
  }

  add(diffRecord: DiffRecord<T> | null) {
    if (transactionState.isTransactionInProgress) {
      if (diffRecord === null) {
        return
      }
      if (
        !this.transactionOverflow ||
        this.epochBeforeFirstModifiedDuringTransaction === null
      ) {
        transactionState.overflowedDiffBuffers.add(this)
        this.epochBeforeFirstModifiedDuringTransaction = diffRecord.fromEpoch
        this.transactionOverflow = []
      }
      this.transactionOverflow.push(diffRecord)
      return
    }
    if (diffRecord) {
      // sanity check
      const prevDiffRecord = this.diffs[this.bufferHeadIndex]
      if (prevDiffRecord && prevDiffRecord.toEpoch !== diffRecord.fromEpoch) {
        throw new Error("invalid diff buffer state: epochs don't match up")
      }
    }
    this.bufferHeadIndex = (this.bufferHeadIndex + 1) % this.diffs.length
    this.diffs[this.bufferHeadIndex] = diffRecord
  }

  // always want to know diff between now and some previous version

  // with linear buffer you can calculate diff with previous versions by walking
  // back
  // with non-linear buffer you need to know the epoch ranges and hope that they
  // match what you need.

  // {fromEpoch, toEpoch, diff}

  diffSince(epoch: number): DiffOf<T> | null {
    const resultParts: DiffOf<T>[] = []
    if (this.transactionOverflow) {
      // no nulls in here
      let i = this.transactionOverflow.length
      while (i--) {
        const record = this.transactionOverflow[i]
        if (record.fromEpoch === epoch) {
          resultParts.unshift(record.diff)
          return normalizeDiff(flatten(resultParts))
        } else if (record.fromEpoch < epoch) {
          return null
        }
        resultParts.unshift(record.diff)
      }
    }

    {
      let i = this.diffs.length
      while (i--) {
        const record = this.diffs[
          (this.bufferHeadIndex + i + 1) % this.diffs.length
        ]
        if (!record) {
          return null
        }

        if (record.fromEpoch === epoch) {
          resultParts.unshift(record.diff)
          return normalizeDiff(flatten(resultParts))
        } else if (record.fromEpoch < epoch) {
          return null
        }
        resultParts.unshift(record.diff)
      }
    }

    return null
  }
}
