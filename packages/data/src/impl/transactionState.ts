import { Atom } from "./Atom"
import { DiffBuffer } from "./DiffBuffer"

class TransactionState {
  isTransactionInProgress: boolean = false
  changedAtoms: Atom<any>[] = []
  overflowedDiffBuffers: Set<DiffBuffer<any>> = new Set()

  beginTransaction() {
    this.changedAtoms = []
    this.isTransactionInProgress = true
    this.overflowedDiffBuffers = new Set()
  }

  endTransaction() {
    this.isTransactionInProgress = false
    for (const diffBuffer of this.overflowedDiffBuffers) {
      diffBuffer.transactionEnded()
    }
  }
}

export const transactionState = new TransactionState()
