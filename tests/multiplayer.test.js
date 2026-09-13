import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import worker from '../server/index.js';
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const db={prepare(query){const stmt=sql.prepare(query);let args=[];return{bind(...v){args=v;return this;},async first(){return stmt.get(...args)||null;},async all(){return{results:stmt.all(...args)};},run(){return stmt.run(...args);}};},async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const call=async(token,action,body={})=>{const response=await worker.fetch(new Request('https://game.test/api/multiplayer/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://game.test'},body:JSON.stringify(body)}),{DB:db});return{status:response.status,...await response.json()};};
 return{sql,call};
}
test('private rooms admit only one guest, keep credentials private, and finish at five attacks',async()=>{
 const {sql,call}=setup(),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID();
 const created=await call(a,'create',{name:'Naruto'});assert.equal(created.status,200);assert.equal(created.room.code.length,6);
 assert.equal(JSON.stringify(created).includes(a),false);
 const guests=await Promise.all([call(b,'join',{name:'Sasuke',code:created.room.code}),call(c,'join',{name:'Kakashi',code:created.room.code})]);
 assert.deepEqual(guests.map(x=>x.status).sort(),[200,409]);
 const guest=guests[0].status===200?b:c;
 assert.equal((await call(a,'ready')).room.status,'waiting');
 const ready=await call(guest,'ready');assert.equal(ready.room.status,'playing');assert.ok(ready.room.startsAt>Date.now());
 assert.equal((await call(a,'score',{count:1})).room.players[0].score,0);
 sql.prepare('UPDATE multiplayer_rooms SET starts_at=?').run(Date.now()-10000);
 assert.equal((await call(a,'score',{count:2})).room.players[0].score,0);
 for(let n=1;n<=4;n++) assert.equal((await call(a,'score',{count:n})).room.players[0].score,n);
 assert.equal((await call(a,'score',{count:4})).room.players[0].score,4);
 assert.equal((await call(a,'score',{count:5})).room.status,'finished');
 assert.equal((await call(guest,'score',{count:1})).room.players[1].score,0);
 assert.equal((await call(c===guest?b:c,'state')).status,404);
 sql.close();
});
test('simultaneous random matchmaking pairs players atomically and respects leave and expiry',async()=>{
 const {sql,call}=setup(),a=crypto.randomUUID(),b=crypto.randomUUID();
 const rooms=await Promise.all([call(a,'match',{name:'A'}),call(b,'match',{name:'B'})]);
 assert.equal(rooms[0].room.code,rooms[1].room.code);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM multiplayer_rooms').get().n,1);
 assert.equal((await call(a,'match',{name:'A'})).room.code,rooms[0].room.code);
 await call(a,'leave');assert.equal((await call(b,'state')).room.status,'closed');
 const c=crypto.randomUUID();await call(c,'create',{name:'C'});
 sql.prepare('UPDATE multiplayer_rooms SET host_seen=? WHERE host_token=?').run(Date.now()-61000,c);
 assert.equal((await call(c,'state')).room.status,'closed');
 sql.close();
});
