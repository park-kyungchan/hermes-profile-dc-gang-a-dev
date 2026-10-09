import {seed,review,ownerId,studentId,actorId,date,instant} from '../src/demo/synthetic';
// Build output is intentionally loaded at runtime so typechecking cannot disguise a missing bundle.
const bundle='../dist/index.js';
const m=await import(bundle) as typeof import('../src/index');
const s=new m.SyntheticClinicStore(seed()),a=new m.ClinicWorkbench(s,{ownerId,studentId,actorId},()=>instant);
await a.recordReview(review());const p=await a.scene(date);
if(!p.assignments[0].attempts[0].completed||!m.renderWorkbench(p).includes('completed'))throw Error('bundled_consumer_failed');
console.log(JSON.stringify({bundledConsumer:'PASS',bothSourceSemanticsConsumed:true}));
