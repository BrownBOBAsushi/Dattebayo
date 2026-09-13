// Visual feedback is local; only ordered server acknowledgements decide the winner.
export class AttackQueue {
  constructor() { this.completed = 0; this.acknowledged = 0; }
  complete() { if (this.completed >= 5) return false; this.completed++; return true; }
  acknowledge(count) {
    this.acknowledged = Math.max(this.acknowledged, count);
    this.completed = Math.max(this.completed, this.acknowledged);
  }
  get next() { return this.completed > this.acknowledged ? this.acknowledged + 1 : null; }
}
