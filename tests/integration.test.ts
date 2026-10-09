import {describe,test,expect} from 'bun:test';
import {ClinicWorkbench} from '../src/application/clinicWorkbench';
import {SyntheticClinicStore} from '../src/adapters/syntheticClinicStore';
import {seed,review,ownerId,studentId,actorId,date,instant,version,attempt} from '../src/demo/synthetic';
import {renderWorkbench} from '../src/ui/workbench';
import {digest} from '../src/learning/model';
import type {ClinicSnapshot,ClinicStore} from '../src/ports/clinicStore';
import {Evidence} from '../src/reference/domain/evidence';
import {validateDecisionReferences} from '../src/reference/domain/decision';
const setup=()=>{const store=new SyntheticClinicStore(seed());return {store,app:new ClinicWorkbench(store,{ownerId,studentId,actorId},()=>instant)};};
describe('R3 exact parent counterexamples',()=>{
 test('R3 RED: caller target mutation during await cannot rebind evidence',async()=>{
  const s=seed(),payload=structuredClone(s.versions[0].payload);
  if(payload.kind!=='learning_work_assignment')throw Error('synthetic_assignment_expected');
  const twoItems={...payload,items:[...payload.items,{...payload.items[0],assignedItemId:'synthetic-item-2',itemKey:{namespace:'synthetic_item',literalKey:'2'},labelLiteral:'Synthetic problem 2'}]};
  s.versions[0]=version(twoItems,'synthetic-assignment','synthetic-assignment-v1');s.heads[0]=structuredClone(s.versions[0]);
  const store=new SyntheticClinicStore(s),app=new ClinicWorkbench(store,{ownerId,studentId,actorId},()=>instant);
  const c=review(),pending=app.recordReview(c);c.clinic.assignedItemId='synthetic-item-2';await pending;
  expect(store.retainedReviews()[0].clinic.assignedItemId).toBe('synthetic-item-1');
  const items=(await app.scene(date)).assignments[0].attempts[0].items;
  expect(items.find(x=>x.item.assignedItemId==='synthetic-item-1')!.state).toBe('completed');
  expect(items.find(x=>x.item.assignedItemId==='synthetic-item-2')!.completion).toBeNull();
 });
 test('R3 RED: accessor now rejection leaves state evidence and replay unchanged',async()=>{
  const {store}=setup(),before=await store.snapshot(),c=review(),evidence=c.evidence.map(e=>Evidence.parse(e)),decision=validateDecisionReferences(c.decision,evidence);
  const command={...c,evidence,decision,now:instant};let reads=0;
  Object.defineProperty(command,'now',{enumerable:true,get:()=>{reads++;return instant;}});
  await expect(store.appendReview(command)).rejects.toThrow('accessors are not JSON data');
  expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual([]);expect(reads).toBe(0);
  const saved=await store.appendReview({...c,evidence,decision,now:instant});expect(saved.status).toBe('saved');
  expect((await store.appendReview({...c,evidence,decision,now:instant})).status).toBe('replay');
 });
 test('R3 RED: exact replay survives source advance without restoring old completion',async()=>{
  const {store,app}=setup(),c=review(),first=await app.recordReview(c),previous=(await store.snapshot()).heads.find(x=>x.entityId==='synthetic-attempt')!;
  store.replaceSyntheticAttempt(version({...attempt,previousAttemptRevisionId:previous.revisionId},previous.entityId,'synthetic-attempt-v2',2,previous));
  const before=await store.snapshot(),history=store.retainedReviews(),replay=await app.recordReview(c);
  expect(replay).toEqual({...first,status:'replay'});expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual(history);
  expect((await app.scene(date)).assignments[0].attempts[0].completed).toBe(false);
  c.clinic.note='Synthetic changed after advance';await expect(app.recordReview(c)).rejects.toThrow('idempotency_reuse');
  await expect(app.recordReview(review('synthetic-new-stale-request'))).rejects.toThrow('work_attempt_basis_conflict');
  expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual(history);
 });
});
describe('R3 boundary and port compatibility',()=>{
 const appendCommand=()=>{const c=review(),evidence=c.evidence.map(e=>Evidence.parse(e)),decision=validateDecisionReferences(c.decision,evidence);return {...c,evidence,decision,now:instant};};
 for(const field of ['requestId','clinic','decision','evidence','now'] as const)test('direct append rejects accessor '+field+' before all mutation',async()=>{
  const {store}=setup(),before=await store.snapshot(),c=appendCommand(),value=c[field];let reads=0;
  Object.defineProperty(c,field,{enumerable:true,get:()=>{reads++;return value;}});
  await expect(store.appendReview(c)).rejects.toThrow('accessors are not JSON data');
  expect(reads).toBe(0);expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual([]);
  expect((await store.appendReview(appendCommand())).status).toBe('saved');
 });
 test('direct append enforces evidence binding rather than trusting a structurally typed body',async()=>{
  const {store}=setup(),before=await store.snapshot(),c=appendCommand();c.clinic.assignedItemId='synthetic-item-2';
  await expect(store.appendReview(c)).rejects.toThrow('clinic_decision_binding_conflict');expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual([]);
 });
 test('nested evidence getter and invalid clock cannot partially commit',async()=>{
  const {store}=setup(),before=await store.snapshot(),c=appendCommand();let reads=0;
  Object.defineProperty(c.evidence[0].claim,'value',{enumerable:true,get:()=>{reads++;return {state:'teacher_confirmed_complete'};}});
  await expect(store.appendReview(c)).rejects.toThrow('accessors are not JSON data');expect(reads).toBe(0);
  await expect(store.appendReview({...appendCommand(),now:'synthetic-invalid-time'})).rejects.toThrow('invalid timestamp');
  expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual([]);expect((await store.appendReview(appendCommand())).status).toBe('saved');
 });
 test('application nested getter rejects before consulting a custom port',async()=>{
  let calls=0,reads=0;const c=review();Object.defineProperty(c.clinic,'note',{enumerable:true,get:()=>{reads++;return 'Synthetic getter';}});
  const port:ClinicStore={snapshot:async()=>{calls++;return seed();},appendReview:async()=>{throw Error('unexpected_append');}};
  const app=new ClinicWorkbench(port,{ownerId,studentId,actorId},()=>instant);await expect(app.recordReview(c)).rejects.toThrow('accessors are not JSON data');expect(calls).toBe(0);expect(reads).toBe(0);
 });
 test('context is detached before caller mutation and getters never become authority',async()=>{
  const store=new SyntheticClinicStore(seed()),context={ownerId,studentId,actorId},app=new ClinicWorkbench(store,context,()=>instant);
  context.actorId='synthetic-other-actor';expect((await app.recordReview(review())).status).toBe('saved');
  let reads=0;Object.defineProperty(context,'actorId',{enumerable:true,get:()=>{reads++;return actorId;}});
  expect(()=>new ClinicWorkbench(store,context,()=>instant)).toThrow('accessors are not JSON data');expect(reads).toBe(0);
 });
 test('seed and replacement accessors reject without evaluating or changing state',async()=>{
  const s=seed();let reads=0;Object.defineProperty(s,'ownerId',{enumerable:true,get:()=>{reads++;return ownerId;}});
  expect(()=>new SyntheticClinicStore(s)).toThrow('accessors are not JSON data');
  const {store}=setup(),before=await store.snapshot(),previous=before.heads[1],row=version({...attempt,previousAttemptRevisionId:previous.revisionId},previous.entityId,'synthetic-attempt-v2',2,previous);
  Object.defineProperty(row,'recordedAt',{enumerable:true,get:()=>{reads++;return instant;}});
  expect(()=>store.replaceSyntheticAttempt(row)).toThrow('accessors are not JSON data');expect(reads).toBe(0);expect(await store.snapshot()).toEqual(before);
 });
 test('legacy custom port without lookup still validates and appends a new command',async()=>{
  const store=new SyntheticClinicStore(seed());let writes=0;
  const port:ClinicStore={snapshot:()=>store.snapshot(),appendReview:c=>{writes++;return store.appendReview(c);}};
  const app=new ClinicWorkbench(port,{ownerId,studentId,actorId},()=>instant);expect((await app.recordReview(review())).status).toBe('saved');expect(writes).toBe(1);
 });
 test('custom snapshot accessors reject before scope reads in scene and review',async()=>{
  const s=seed();let reads=0,writes=0;Object.defineProperty(s,'ownerId',{enumerable:true,get:()=>{reads++;return ownerId;}});
  const port:ClinicStore={snapshot:async()=>s,appendReview:async()=>{writes++;throw Error('unexpected_append');}};
  const app=new ClinicWorkbench(port,{ownerId,studentId,actorId},()=>instant);
  await expect(app.scene(date)).rejects.toThrow('accessors are not JSON data');await expect(app.recordReview(review())).rejects.toThrow('accessors are not JSON data');expect(reads).toBe(0);expect(writes).toBe(0);
 });
 for(const corruption of ['foreign_owner','false_head'] as const)test('custom replay-capable port miss preserves '+corruption+' basis rejection',async()=>{
  const s=seed();if(corruption==='foreign_owner')s.heads[1].ownerId='synthetic-other-owner';else s.heads[1].revisionId='synthetic-false-head';let lookups=0,writes=0;
  const port:ClinicStore={lookupReview:async()=>{lookups++;return null;},snapshot:async()=>structuredClone(s),appendReview:async()=>{writes++;throw Error('unexpected_append');}};
  const app=new ClinicWorkbench(port,{ownerId,studentId,actorId},()=>instant);await expect(app.recordReview(review())).rejects.toThrow();expect(lookups).toBe(1);expect(writes).toBe(0);
 });
 test('lookup receipts are exact scoped detached readback and never apply source-obsolete writes',async()=>{
  const {store,app}=setup(),{now,...c}=appendCommand();expect(await store.lookupReview(c)).toBeNull();const first=await app.recordReview(c);
  const previous=(await store.snapshot()).heads.find(x=>x.entityId==='synthetic-attempt')!;store.replaceSyntheticAttempt(version({...attempt,previousAttemptRevisionId:previous.revisionId},previous.entityId,'synthetic-attempt-v2',2,previous));
  const before=await store.snapshot(),receipt=(await store.lookupReview(c))!;expect(receipt).toEqual({...first,status:'replay'});receipt.revisionId='synthetic-tampered';
  expect((await store.lookupReview(c))!.revisionId).toBe(first.revisionId);
  await expect(store.lookupReview({...c,ownerId:'synthetic-other-owner'})).rejects.toThrow('owner_scope_conflict');
  await expect(store.lookupReview({...c,clinic:{...c.clinic,note:'Synthetic changed'}})).rejects.toThrow('idempotency_reuse');
  expect((await store.appendReview(appendCommand())).status).toBe('replay');expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toHaveLength(1);
 });
});
describe('two-source clinic integration (synthetic only)',()=>{
 test('source grades alone never imply teacher completion',async()=>{const {app}=setup();const p=await app.scene(date);expect(p.assignments[0].attempts[0].items[0].state).toBe('source_unknown');expect(p.assignments[0].attempts[0].completed).toBe(false);});
 test('gang-a scoped teacher evidence becomes dc-gang-a exact-item completion',async()=>{const {app}=setup();const r=await app.recordReview(review());expect(r.officialSaved).toBe(false);expect(r.parentSent).toBe(false);const p=await app.scene(date);expect(p.assignments[0].attempts[0].completed).toBe(true);expect(renderWorkbench(p)).toContain('completed');});
 test('cross-student evidence is refused without mutation',async()=>{const {app,store}=setup();const c=review();c.evidence[0].scope.studentId='synthetic-other';await expect(app.recordReview(c)).rejects.toThrow('decision_student_scope_mismatch');expect((await store.snapshot()).versions.length).toBe(2);});
 test('inferred source cannot act as teacher confirmation',async()=>{const {app}=setup();const c=review();c.evidence[0].claim.type='grade_summary';await expect(app.recordReview(c)).rejects.toThrow('teacher_confirmation_requires_teacher_review_evidence');});
 test('wrong item target is not joined by a display label',async()=>{const {app}=setup();const c=review();c.decision.targetEntityIds=['synthetic-other-target'];await expect(app.recordReview(c)).rejects.toThrow();});
 test('inspection is mandatory even with confirmed evidence',async()=>{const {app}=setup();const c=review();c.clinic.inspection.writtenSolution=false;await expect(app.recordReview(c)).rejects.toThrow('explicit_clinic_inspection_required');});
 test('stale policy fails closed',async()=>{const {app}=setup();const c=review();c.clinic.policyRevision='synthetic-stale';await expect(app.recordReview(c)).rejects.toThrow('stale_clinic_policy');});
 test('actor label does not replace trusted scope',async()=>{const {app}=setup();const c=review();c.actorId='synthetic-other-actor';await expect(app.recordReview(c)).rejects.toThrow('owner_scope_conflict');});
 test('future reported clock fails without mutation',async()=>{const {app,store}=setup();const c=review();c.clinic.reportedAt='2030-01-08T10:00:00Z';await expect(app.recordReview(c)).rejects.toThrow('future_reported_at');expect((await store.snapshot()).versions.length).toBe(2);});
 test('exact retry replays and different payload cannot reuse request',async()=>{const {app,store}=setup();const c=review();const first=await app.recordReview(c);const second=await app.recordReview(c);expect(second.status).toBe('replay');expect(second.revisionId).toBe(first.revisionId);c.clinic.note='Synthetic changed note';await expect(app.recordReview(c)).rejects.toThrow('idempotency_reuse');expect((await store.snapshot()).versions.length).toBe(3);});
 test('CAS refuses competing reviewers and retains original evidence',async()=>{const {app,store}=setup();const results=await Promise.allSettled([app.recordReview(review('synthetic-a')),app.recordReview(review('synthetic-b'))]);expect(results.filter(x=>x.status==='fulfilled').length).toBe(1);expect(results.filter(x=>x.status==='rejected').length).toBe(1);const s=await store.snapshot();expect(s.versions.length).toBe(3);expect(s.versions[0].payload.kind).toBe('learning_work_assignment');});
 test('new attempt never inherits prior teacher completion',async()=>{const {app,store}=setup();await app.recordReview(review());const previous=(await store.snapshot()).heads.find(x=>x.entityId==='synthetic-attempt')!;store.replaceSyntheticAttempt(version({...attempt,previousAttemptRevisionId:'synthetic-attempt-v1'},'synthetic-attempt','synthetic-attempt-v2',2,previous));const p=await app.scene(date);const item=p.assignments[0].attempts[0].items[0];expect(item.state).toBe('prior_revision_completed');expect(item.completion).toBeNull();expect(p.assignments[0].attempts[0].completed).toBe(false);await expect(app.recordReview(review('synthetic-stale-review'))).rejects.toThrow('work_attempt_basis_conflict');});
 test('later correction invalidates prior completion without erasing it',async()=>{const {app,store}=setup();const first=await app.recordReview(review());const c=review('synthetic-correction');c.expectedRevisionId=first.revisionId;c.clinic.decision='correction_required';c.evidence[0].claim.value.state='teacher_confirmed_incomplete';await app.recordReview(c);const p=await app.scene(date);expect(p.assignments[0].attempts[0].items[0].state).toBe('correction_required');expect((await store.snapshot()).versions.length).toBe(4);});
 test('rendering escapes notes and labels',async()=>{const {app}=setup();const c=review();c.clinic.note='<script>synthetic-only</script>';await app.recordReview(c);const html=renderWorkbench(await app.scene(date));expect(html).not.toContain('<script>synthetic-only');expect(html).toContain('&lt;script&gt;');});
 test('invalid dates and catalog pins remain real refusals',async()=>{const {app}=setup();await expect(app.scene('2030-02-30')).rejects.toThrow();const s=seed();s.catalog=[];const other=new ClinicWorkbench(new SyntheticClinicStore(s),{ownerId,studentId,actorId},()=>instant);await expect(other.scene(date)).rejects.toThrow('work_catalog_binding_conflict');});
 test('old review evidence cannot be rebound to a successor attempt',async()=>{const {app,store}=setup();const c=review();const previous=(await store.snapshot()).heads[1];store.replaceSyntheticAttempt(version({...attempt,previousAttemptRevisionId:'synthetic-attempt-v1'},'synthetic-attempt','synthetic-attempt-v2',2,previous));c.clinic.attemptRevisionId='synthetic-attempt-v2';await expect(app.recordReview(c)).rejects.toThrow('clinic_decision_binding_conflict');expect((await store.snapshot()).versions.length).toBe(3);});
 test('unknown fields are refused by original strict evidence schema',async()=>{const {app}=setup();const c=review();Object.assign(c.evidence[0],{syntheticExtra:true});await expect(app.recordReview(c)).rejects.toThrow();});
 test('contradicted teacher evidence cannot confirm completion',async()=>{const {app}=setup();const c=review();c.evidence[0].verificationStatus='contradicted';await expect(app.recordReview(c)).rejects.toThrow('teacher_review_evidence_contradicted');});
 test('a different report actor is refused even with valid decision scope',async()=>{const {app}=setup();const c=review();c.evidence[0].source.actor.id='synthetic-other-actor';await expect(app.recordReview(c)).rejects.toThrow('synthetic_teacher_report_required');});
 test('future detection compares instants rather than timestamp text',async()=>{const {app}=setup();const c=review();c.clinic.reportedAt='2030-01-07T09:30:00-01:00';await expect(app.recordReview(c)).rejects.toThrow('future_reported_at');});
 test('caller mutation cannot rewrite retained evidence or revisions',async()=>{const {app,store}=setup();const c=review();await app.recordReview(c);c.evidence[0].claim.value.state='synthetic-tampered';c.clinic.note='Synthetic tampered note';const history=store.retainedReviews();expect(history[0].evidence[0].claim.value).toEqual({state:'teacher_confirmed_complete'});const s=await store.snapshot();s.versions.length=0;expect((await store.snapshot()).versions.length).toBe(3);});
});
describe('R2 retained identity and storage basis regressions',()=>{
 test('RED reproduction: changed payload cannot reuse the inspected v1 identity',async()=>{
  const {app,store}=setup();await app.recordReview(review());const before=await store.snapshot(),evidence=store.retainedReviews();
  const row=version({...attempt,previousAttemptRevisionId:'synthetic-attempt-v1',itemResults:[]},'synthetic-attempt','synthetic-attempt-v1',2);
  expect(()=>store.replaceSyntheticAttempt(row)).toThrow();
  expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual(evidence);
 });
 test('RED reproduction: foreign same-ID head is refused at seed admission',()=>{
  const s=seed(),head=s.heads[1];head.ownerId='synthetic-other-owner';head.studentId='synthetic-other-learner';head.payload.sourceStudent={namespace:'academy_student',literalKey:'synthetic-other-key'};
  const before=structuredClone(s);expect(()=>new SyntheticClinicStore(s)).toThrow();expect(s).toEqual(before);
 });
 const corruptions:[string,(s:ClinicSnapshot)=>void][]=[
  ['duplicate global revision ID',s=>{s.versions[1].revisionId=s.versions[0].revisionId;}],
  ['self predecessor',s=>{s.versions[1].previousRevisionId=s.versions[1].revisionId;}],
  ['foreign owner',s=>{s.heads[1].ownerId='synthetic-other-owner';}],
  ['foreign student',s=>{s.versions[1].studentId='synthetic-other-student';}],
  ['foreign source',s=>{s.heads[1].payload.sourceStudent={namespace:'academy_student',literalKey:'synthetic-other-key'};}],
  ['same-ID different payload',s=>{if(s.heads[1].payload.kind==='learning_work_attempt')s.heads[1].payload.itemResults=[];s.heads[1].contentDigest=digest(s.heads[1].payload);}],
  ['head missing version',s=>{s.heads[1].revisionId='synthetic-missing-version';}],
  ['predecessor metadata drift',s=>{s.heads[1].previousDigest='synthetic-wrong-digest';}],
  ['missing entity head',s=>{s.heads.pop();}],
  ['duplicate entity head',s=>{s.heads.push(structuredClone(s.heads[1]));}],
  ['content digest drift',s=>{s.versions[1].contentDigest='synthetic-wrong-digest';}]
 ];
 for(const [name,corrupt] of corruptions){
  test('seed refuses '+name,()=>{const s=seed();corrupt(s);const before=structuredClone(s);expect(()=>new SyntheticClinicStore(s)).toThrow();expect(s).toEqual(before);});
  test('custom port scene and review refuse '+name+' without invoking append',async()=>{
   const s=seed();corrupt(s);const before=structuredClone(s);let appended=0;
   const port:ClinicStore={snapshot:async()=>structuredClone(s),appendReview:async()=>{appended++;return {status:'saved',revisionId:'synthetic-false-receipt',officialSaved:false,parentSent:false};}};
   const app=new ClinicWorkbench(port,{ownerId,studentId,actorId},()=>instant);
   await expect(app.scene(date)).rejects.toThrow();await expect(app.recordReview(review())).rejects.toThrow();expect(appended).toBe(0);expect(s).toEqual(before);
  });
 }
 test('replacement uses original pure validator before any mutation',async()=>{
  const {store}=setup(),before=await store.snapshot();const row=version({...attempt,previousAttemptRevisionId:'synthetic-attempt-v1'},'synthetic-attempt','synthetic-attempt-v2',2,before.heads[1]);
  Object.assign(row.payload,{state:'synthetic-invalid-state'});row.contentDigest=digest(row.payload);
  expect(()=>store.replaceSyntheticAttempt(row)).toThrow();expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual([]);
 });
 const replacementCorruptions:[string,(row:ReturnType<typeof version>)=>void][]=[
  ['global duplicate from another entity',r=>{r.revisionId='synthetic-assignment-v1';}],
  ['self parent',r=>{r.previousRevisionId=r.revisionId;if(r.payload.kind==='learning_work_attempt')r.payload.previousAttemptRevisionId=r.revisionId;}],
  ['owner scope',r=>{r.ownerId='synthetic-other-owner';}],
  ['student scope',r=>{r.studentId='synthetic-other-student';}],
  ['source scope',r=>{r.payload.sourceStudent={namespace:'academy_student',literalKey:'synthetic-other-key'};}],
  ['metadata predecessor drift',r=>{r.previousRevisionId='synthetic-missing-predecessor';}],
  ['payload predecessor drift',r=>{if(r.payload.kind==='learning_work_attempt')r.payload.previousAttemptRevisionId=null;}],
  ['predecessor digest drift',r=>{r.previousDigest='synthetic-wrong-digest';}],
  ['sequence gap',r=>{r.sequence=3;}],
  ['content digest drift',r=>{r.contentDigest='synthetic-wrong-digest';}]
 ];
 for(const [name,corrupt] of replacementCorruptions)test('replacement refuses '+name+' without changing history, heads or evidence',async()=>{
  const {app,store}=setup();await app.recordReview(review());const before=await store.snapshot(),evidence=store.retainedReviews();
  const row=version({...attempt,previousAttemptRevisionId:'synthetic-attempt-v1',itemResults:[]},'synthetic-attempt','synthetic-attempt-v2',2,before.heads.find(x=>x.entityId==='synthetic-attempt'));corrupt(row);
  if(name!=='content digest drift')row.contentDigest=digest(row.payload);
  expect(()=>store.replaceSyntheticAttempt(row)).toThrow();expect(await store.snapshot()).toEqual(before);expect(store.retainedReviews()).toEqual(evidence);
 });
 test('valid distinct successor retains the exact predecessor chain and does not inherit completion',async()=>{
  const {app,store}=setup();await app.recordReview(review());const before=await store.snapshot(),previous=before.heads.find(x=>x.entityId==='synthetic-attempt')!;
  const row=version({...attempt,previousAttemptRevisionId:previous.revisionId,itemResults:[]},previous.entityId,'synthetic-attempt-v2',2,previous);store.replaceSyntheticAttempt(row);
  const after=await store.snapshot();expect(after.versions.slice(0,before.versions.length)).toEqual(before.versions);expect(after.heads.find(x=>x.entityId===row.entityId)).toEqual(after.versions.at(-1)!);expect(after.versions.at(-1)!.previousDigest).toBe(previous.contentDigest);
  row.payload.sourceStudent={namespace:'academy_student',literalKey:'synthetic-caller-mutated'};expect((await store.snapshot()).versions.at(-1)!.payload.sourceStudent).toEqual(previous.payload.sourceStudent);
  const result=(await app.scene(date)).assignments[0].attempts[0];expect(result.completed).toBe(false);expect(result.items[0].state).toBe('prior_revision_completed');expect(result.items[0].completion).toBeNull();expect(result.items[0].inspectionBasis).toBe('prior_attempt_revision');expect(store.retainedReviews()).toHaveLength(1);
 });
 test('an old retained revision cannot remain the entity head',async()=>{
  const {store}=setup(),s=await store.snapshot(),previous=s.heads[1];s.versions.push(version({...attempt,previousAttemptRevisionId:previous.revisionId},previous.entityId,'synthetic-attempt-v2',2,previous));
  expect(()=>new SyntheticClinicStore(s)).toThrow('head_revision_conflict');
 });
 test('snapshot and direct append revalidate a corrupted internal basis without retaining evidence',async()=>{
  const {store}=setup();const internal=store as unknown as {state:ClinicSnapshot};internal.state.heads[1].ownerId='synthetic-other-owner';const before=structuredClone(internal.state);
  await expect(store.snapshot()).rejects.toThrow('owner_scope_conflict');
  const c=review(),evidence=c.evidence.map(e=>Evidence.parse(e)),decision=validateDecisionReferences(c.decision,evidence);await expect(store.appendReview({...c,evidence,decision,now:instant})).rejects.toThrow('owner_scope_conflict');
  expect(internal.state).toEqual(before);expect(store.retainedReviews()).toEqual([]);
 });
 test('matching heads cannot conceal drift in retained predecessor history',()=>{
  const s=seed(),previous=s.heads[1],row=version({...attempt,previousAttemptRevisionId:previous.revisionId},previous.entityId,'synthetic-attempt-v2',2,previous);
  row.previousDigest='synthetic-wrong-digest';s.versions.push(row);s.heads[1]=structuredClone(row);const before=structuredClone(s);
  expect(()=>new SyntheticClinicStore(s)).toThrow('revision_predecessor_conflict');expect(s).toEqual(before);
 });
});
