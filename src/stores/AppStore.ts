
import { makeAutoObservable } from 'mobx'

class AppStore {
  zigzagRevealed = false

  constructor() {
    makeAutoObservable(this)
  }

  setZigzagRevealed(value: boolean) {
    this.zigzagRevealed = value
  }
}

const appStore = new AppStore()
export default appStore
