import test from 'node:test';
import assert from 'node:assert/strict';
import { AttackQueue } from '../src/attack-queue.js';
test('players can weave ahead of delayed acknowledgements and send attacks in order',()=>{
 const queue=new AttackQueue();
 assert.equal(queue.complete(),true);assert.equal(queue.next,1);
 assert.equal(queue.complete(),true);assert.equal(queue.completed,2);assert.equal(queue.next,1);
 queue.acknowledge(1);assert.equal(queue.next,2);assert.equal(queue.completed,2);
 queue.acknowledge(1);assert.equal(queue.next,2);
 queue.acknowledge(2);assert.equal(queue.next,null);
 for(let i=0;i<3;i++)queue.complete();
 assert.equal(queue.completed,5);assert.equal(queue.complete(),false);
 queue.acknowledge(5);assert.equal(queue.next,null);
});
