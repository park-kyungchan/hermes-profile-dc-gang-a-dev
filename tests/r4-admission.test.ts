import {describe,test,expect} from 'bun:test';
import {ClinicWorkbench} from '../src/application/clinicWorkbench';
import {SyntheticClinicStore} from '../src/adapters/syntheticClinicStore';
import {seed,review,ownerId,studentId,actorId,date,instant,version} from '../src/demo/synthetic';
import {canonicalJson,digest,immutableCopy} from '../src/learning/model';
import {clinicTargetId} from '../src/academy/clinicIdentity';
import {projectLearningWork} from '../src/academy/learningWorkProjection';
import {parseClinicReviewCommand} from '../src/application/clinicWorkbench';
import type {ClinicSnapshot,ClinicStore} from '../src/ports/clinicStore';
import {createHash} from 'node:crypto';
const context={ownerId,studentId,actorId};
type Tamper=(array:unknown[],hit:()=>void)=>void;
const arrayCases:[string,Tamper][]=[
 ['inherited map getter',(a,hit)=>{const p=Object.create(Array.prototype);Object.defineProperty(p,'map',{get(){hit();return Array.prototype.map;}});Object.setPrototypeOf(a,p);}],
 ['own map method',(a,hit)=>{Object.defineProperty(a,'map',{enumerable:true,value:()=>{hit();return [];}});}],
 ['own map getter',(a,hit)=>{Object.defineProperty(a,'map',{enumerable:false,get(){hit();return Array.prototype.map;}});}],
 ['sparse decorated indices',a=>{const value=a[0];delete a[0];Object.assign(a,{'01':value});}],
 ['nonenumerable decoration',a=>{Object.defineProperty(a,'syntheticExtra',{value:true});}],
 ['own index getter',(a,hit)=>{const value=a[0];Object.defineProperty(a,'0',{enumerable:true,get(){hit();return value;}});}],
 ['inherited index getter',(a,hit)=>{const value=a[0],p=Object.create(Array.prototype);delete a[0];Object.defineProperty(p,'0',{get(){hit();return value;}});Object.setPrototypeOf(a,p);}],
 ['iterator override',(a,hit)=>{Object.defineProperty(a,Symbol.iterator,{value:()=>{hit();return [][Symbol.iterator]();}});}],
 ['hidden toJSON',(a,hit)=>{Object.defineProperty(a,'toJSON',{value:()=>{hit();return [];}});}]
];
describe('R4 finite JS input boundary (not native transport or authority)',()=>{
 for(const [name,tamper] of arrayCases)for(const route of ['application','direct_adapter','custom_port'] as const)test(route+' refuses '+name+' with no calls or mutation',async()=>{
  const store=new SyntheticClinicStore(seed()),before=await store.snapshot(),command=structuredClone(parseClinicReviewCommand(review()));let reads=0,calls=0;
  tamper(command.evidence,()=>{reads++;});
  const port:ClinicStore={snapshot:async()=>{calls++;return seed();},appendReview:async()=>{calls++;throw Error('unexpected_append');},lookupReview:async()=>{calls++;return null;}};
  const app=new ClinicWorkbench(route==='custom_port'?port:store,context,()=>instant);
  const pending=route==='direct_adapter'?store.appendReview({...command,now:instant}):app.recordReview(command);
  await expect(pending).rejects.toThrow();expect(reads).toBe(0);expect(calls).toBe(0);expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual([]);
  // The refused request must not reserve a replay key or leave a partial write.
  expect((await store.appendReview({...parseClinicReviewCommand(review()),now:instant})).status).toBe('saved');
 });
 for(const [name,tamper] of arrayCases)test('seed and custom snapshot refuse '+name+' before effects',async()=>{
  const s=seed();let reads=0,writes=0;tamper(s.versions,()=>{reads++;});
  expect(()=>new SyntheticClinicStore(s)).toThrow();
  const port:ClinicStore={snapshot:async()=>s,appendReview:async()=>{writes++;throw Error('unexpected_append');}};
  const app=new ClinicWorkbench(port,context,()=>instant);await expect(app.scene(date)).rejects.toThrow();await expect(app.recordReview(review())).rejects.toThrow();expect(reads).toBe(0);expect(writes).toBe(0);
 });
 test('proxy objects and arrays refuse before reflective traps',async()=>{
  let reads=0;const handler:ProxyHandler<object>={get(){reads++;throw Error('untrusted_get');},ownKeys(){reads++;throw Error('untrusted_keys');},getPrototypeOf(){reads++;throw Error('untrusted_prototype');},getOwnPropertyDescriptor(){reads++;throw Error('untrusted_descriptor');}};
  for(const part of [{},[]])expect(()=>canonicalJson(new Proxy(part,handler))).toThrow('proxies are not JSON data');
  const store=new SyntheticClinicStore(seed()),before=await store.snapshot(),c=review();
  await expect(new ClinicWorkbench(store,context,()=>instant).recordReview(new Proxy(c,handler))).rejects.toThrow('proxies are not JSON data');
  expect(reads).toBe(0);expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual([]);
 });
 test('plain JSON parse is supported, not inferred native ingress',async()=>{
  const store=new SyntheticClinicStore(JSON.parse(JSON.stringify(seed()))),app=new ClinicWorkbench(store,context,()=>instant);
  expect((await app.recordReview(JSON.parse(JSON.stringify(review())))).status).toBe('saved');expect((await app.scene(date)).assignments[0].attempts[0].completed).toBe(true);
 });
});
describe('R4 canonical finite data compatibility',()=>{
 // Prior codec on valid data only, independent of the production implementation.
 const legacy=(v:unknown):string=>Array.isArray(v)?'['+v.map(legacy).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+legacy((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
 test('stable canonical bytes and hashes for plain JSON including shared references',()=>{
  const shared={z:0,a:'synthetic'},vectors:unknown[]=[null,true,false,0,-0,1.5,'quote"\\\n',[],{},[null,1,{z:false,a:[true,'synthetic']}],{z:shared,a:shared},Object.assign(Object.create(null),{b:2,a:1}),Object.freeze([1,2]),seed(),review()];
  for(let i=0;i<50;i++)vectors.push({z:[i,`synthetic-${i}`,false],a:{b:i/10,a:null}});
  for(const v of vectors){const expected=legacy(v);expect(canonicalJson(v)).toBe(expected);expect(digest(v)).toBe(createHash('sha256').update(expected,'utf8').digest('hex'));expect(canonicalJson(immutableCopy(v))).toBe(expected);}
 });
 test('nonfinite, cycles, symbols, hidden fields and custom objects fail closed',()=>{
  const cycle:unknown[]=[];cycle.push(cycle);const symbol={[Symbol('synthetic')]:true},hidden=Object.defineProperty({},'synthetic',{value:true});
  for(const v of [undefined,NaN,Infinity,-Infinity,1n,()=>0,cycle,symbol,hidden,new Date(),Object.create({synthetic:true}),new Array(2)])expect(()=>canonicalJson(v)).toThrow();
 });
 test('object accessors and toJSON methods never execute',()=>{
  let reads=0;const object=Object.defineProperty({},'synthetic',{enumerable:true,get(){reads++;return 1;}}),toJSON={toJSON(){reads++;return {};}};
  expect(()=>canonicalJson(object)).toThrow('accessors');expect(()=>canonicalJson(toJSON)).toThrow();expect(reads).toBe(0);
 });
});
function invalidStream(kind:string):ClinicSnapshot{
 const s=seed(),clinic=review().clinic,target=clinicTargetId(clinic),first=version(clinic,target,'synthetic-clinic-v1');
 if(kind==='unbound_entity'){first.entityId='synthetic-unbound';s.versions.push(first);s.heads.push(structuredClone(first));}
 else if(kind==='competing_streams'){const other=version(clinic,'synthetic-unbound','synthetic-other-v1'),last=version(clinic,'synthetic-unbound','synthetic-other-v2',2,other);s.versions.push(first,other,last);s.heads.push(structuredClone(first),structuredClone(last));}
 else {const changed={...clinic,assignedItemId:'synthetic-item-2'},nextTarget=kind==='cross_target_predecessor'?clinicTargetId(changed):target,next=version(changed,nextTarget,'synthetic-clinic-v2',2,first);s.versions.push(first,next);s.heads.push(structuredClone(next));}
 return s;
}
describe('R4 target-stream admission',()=>{
 test('direct projection cannot deduplicate away a conflicting clinic revision',()=>{
  const s=seed(),clinic=review().clinic,v1=version(clinic,clinicTargetId(clinic),'synthetic-clinic-v1'),conflict=structuredClone(v1);conflict.payload={...clinic,note:'Synthetic conflicting duplicate'};conflict.contentDigest=digest(conflict.payload);
  s.versions.push(v1,conflict);s.heads.push(conflict);expect(()=>projectLearningWork(s.studentId,s.sourceStudent,date,s.versions,s.heads,s.catalog)).toThrow('clinic_revision_identity_conflict');
 });
 test('clinic predecessor cannot be a retained assignment or attempt',()=>{
  const s=seed(),clinic=review().clinic,v1=version(clinic,clinicTargetId(clinic),'synthetic-clinic-v1',2,s.versions[1]);s.versions.push(v1);s.heads.push(v1);
  expect(()=>projectLearningWork(s.studentId,s.sourceStudent,date,s.versions,s.heads,s.catalog)).toThrow('clinic_target_predecessor_conflict');expect(()=>new SyntheticClinicStore(s)).toThrow();
 });
 for(const kind of ['unbound_entity','competing_streams','retargeted_predecessor','cross_target_predecessor']){
  test('seed and direct projection reject '+kind+' without input normalization',()=>{
   const s=invalidStream(kind),before=structuredClone(s);expect(()=>new SyntheticClinicStore(s)).toThrow();expect(()=>projectLearningWork(s.studentId,s.sourceStudent,date,s.versions,s.heads,s.catalog)).toThrow();expect(s).toEqual(before);
  });
  test('custom port scene/new-write reject '+kind+' before append',async()=>{
   const s=invalidStream(kind),before=structuredClone(s);let writes=0;
   const port:ClinicStore={snapshot:async()=>structuredClone(s),appendReview:async()=>{writes++;throw Error('unexpected_append');}};
   const app=new ClinicWorkbench(port,context,()=>instant);await expect(app.scene(date)).rejects.toThrow();await expect(app.recordReview(review())).rejects.toThrow();expect(writes).toBe(0);expect(s).toEqual(before);
  });
  test('direct adapter new-write rejects '+kind+' retaining state, evidence and replay',async()=>{
   const store=new SyntheticClinicStore(seed()),internal=store as unknown as {state:ClinicSnapshot};internal.state=invalidStream(kind);const before=structuredClone(internal.state);
   await expect(store.appendReview({...parseClinicReviewCommand(review()),now:instant})).rejects.toThrow();expect(internal.state).toEqual(before);expect(store.retainedReviews()).toEqual([]);
   internal.state=seed();expect((await store.appendReview({...parseClinicReviewCommand(review()),now:instant})).status).toBe('saved');
  });
 }
 test('target identity retains original stable hash and excludes attempt revision',()=>{
  const c=review().clinic,old='clinic-'+digest({assignmentRevisionId:c.assignmentRevisionId,attemptEntityId:c.attemptEntityId,assignedItemId:c.assignedItemId});
  expect(clinicTargetId(c)).toBe(old);expect(clinicTargetId({...c,attemptRevisionId:'synthetic-successor'} as typeof c)).toBe(old);
  for(const key of ['assignmentRevisionId','attemptEntityId','assignedItemId'] as const)expect(clinicTargetId({...c,[key]:'synthetic-other'})).not.toBe(old);
 });
 test('valid seeded canonical two-version history correction invalidates completion and replays',async()=>{
  const s=seed(),clinic=review().clinic,id=clinicTargetId(clinic),v1=version(clinic,id,'synthetic-clinic-v1'),v2=version(clinic,id,'synthetic-clinic-v2',2,v1);s.versions.push(v1,v2);s.heads.push(structuredClone(v2));
  const store=new SyntheticClinicStore(s),app=new ClinicWorkbench(store,context,()=>instant);expect((await app.scene(date)).assignments[0].attempts[0].completed).toBe(true);
  const c=review('synthetic-correction');c.expectedRevisionId=v2.revisionId;c.clinic.decision='correction_required';c.evidence[0].claim.value.state='teacher_confirmed_incomplete';
  const receipt=await app.recordReview(c),after=await store.snapshot(),item=(await app.scene(date)).assignments[0].attempts[0].items[0];
  expect(item.state).toBe('correction_required');expect(item.completion).toBeNull();expect(item.retainedCompletion).toBeNull();expect(item.history).toHaveLength(3);expect(canonicalJson(item.history.slice(0,2))).toBe(canonicalJson([v1,v2]));expect((await app.scene(date)).assignments[0].attempts[0].completed).toBe(false);
  expect(after.versions.slice(0,s.versions.length)).toEqual(s.versions);expect(after.versions.at(-1)!.entityId).toBe(id);expect(after.versions.at(-1)!.previousRevisionId).toBe(v2.revisionId);expect(after.versions.at(-1)!.sequence).toBe(3);
  expect((await app.recordReview(c))).toEqual({...receipt,status:'replay'});expect(await store.snapshot()).toEqual(after);expect(store.retainedReviews()).toHaveLength(1);
 });
});
describe('R4 exact parent counterexamples',()=>{
 test('R4 RED: inherited array map getter is never read or saved',async()=>{
  const store=new SyntheticClinicStore(seed()),before=await store.snapshot(),app=new ClinicWorkbench(store,context,()=>instant),c=review();let reads=0;
  const proto=Object.create(Array.prototype);Object.defineProperty(proto,'map',{get(){reads++;return Array.prototype.map;}});Object.setPrototypeOf(c.evidence,proto);
  let refused=false;try{await app.recordReview(c);}catch{refused=true;}
  expect({refused,reads,versions:(await store.snapshot()).versions.length,reviews:store.retainedReviews().length}).toEqual({refused:true,reads:0,versions:before.versions.length,reviews:0});
  expect(await store.snapshot()).toEqual(before);
 });
 test('R4 RED: noncanonical two-version completion stream is refused',async()=>{
  const s=seed(),clinic=review().clinic,v1=version(clinic,'synthetic-unbound-clinic','synthetic-unbound-v1'),v2=version(clinic,'synthetic-unbound-clinic','synthetic-unbound-v2',2,v1);
  s.versions.push(v1,v2);s.heads.push(v2);const before=structuredClone(s);
  let refused=false,writeStatus:string|null=null,completed:boolean|null=null;
  try{const store=new SyntheticClinicStore(s),app=new ClinicWorkbench(store,context,()=>instant),c=review('synthetic-correction');c.clinic.decision='correction_required';c.evidence[0].claim.value.state='teacher_confirmed_incomplete';writeStatus=(await app.recordReview(c)).status;completed=(await app.scene(date)).assignments[0].attempts[0].completed;}catch{refused=true;}
  expect({refused,writeStatus,completed}).toEqual({refused:true,writeStatus:null,completed:null});expect(s).toEqual(before);
 });
});
