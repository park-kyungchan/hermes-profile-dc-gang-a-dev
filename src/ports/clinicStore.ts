import type {RecordVersion} from '../academy/contracts/storageRecords';
import type {SourceKey} from '../academy/domain';
import type {PinnedCatalog} from '../academy/learningWorkProjection';
import type {TeacherClinicRevision} from '../academy/learningWork';
import type {Decision} from '../reference/domain/decision';
import type {Evidence} from '../reference/domain/evidence';
import {assertInstant,canonicalJson,digest} from '../learning/model';
import {validateSourceKey} from '../academy/domain';
import {validateLearningAssignment,validateLearningAttempt,validateTeacherClinic,workToken} from '../academy/learningWork';
import {assertClinicTargetStreams} from '../academy/clinicIdentity';
export interface ClinicSnapshot {ownerId:string;studentId:string;sourceStudent:SourceKey;versions:RecordVersion[];heads:RecordVersion[];catalog:PinnedCatalog[]}
export interface ReviewAppend {ownerId:string;studentId:string;actorId:string;requestId:string;expectedRevisionId:string|null;clinic:TeacherClinicRevision;decision:Decision;evidence:Evidence[];now:string}
export type ReviewCommand=Omit<ReviewAppend,'now'>;
export interface ReviewReceipt {status:'saved'|'replay';revisionId:string;officialSaved:false;parentSent:false}
/** A production adapter must supply trusted ingress, atomic CAS, persistence and evidence readback. */
export interface ClinicStore {
 snapshot():Promise<ClinicSnapshot>;
 appendReview(input:ReviewAppend):Promise<ReviewReceipt>;
 /** Optional for legacy ports. Match complete command digest and owner/student/actor/request scope;
  * return only a retained replay receipt or null, refuse changed request reuse, never apply a write.
  * Implementations own trusted ingress; this structural interface supplies no authorization. */
 lookupReview?(input:ReviewCommand):Promise<ReviewReceipt|null>;
}
/** Finite public snapshot contract, not a durable storage engine or authentication check. */
export function assertClinicSnapshot(s:ClinicSnapshot):void{
 canonicalJson(s);workToken(s.ownerId);workToken(s.studentId);validateSourceKey(s.sourceStudent);
 assertClinicTargetStreams(s.versions);assertClinicTargetStreams(s.heads);
 const revisions=new Map<string,RecordVersion>(),entities=new Map<string,RecordVersion[]>();
 for(const row of s.versions){
  assertScopedRecord(s,row);
  if(revisions.has(row.revisionId))throw Error('duplicate_revision_identity');
  revisions.set(row.revisionId,row);const chain=entities.get(row.entityId)??[];chain.push(row);entities.set(row.entityId,chain);
 }
 const latest=new Map<string,RecordVersion>();
 for(const [id,chain] of entities){
  chain.sort((a,b)=>a.sequence-b.sequence);let previous:RecordVersion|undefined;
  for(const row of chain){
   if(row.sequence!==(previous?.sequence??0)+1||row.previousRevisionId!==(previous?.revisionId??null)||row.previousDigest!==(previous?.contentDigest??null)||previous&&row.payload.kind!==previous.payload.kind)throw Error('revision_predecessor_conflict');
   if(row.payload.kind==='learning_work_attempt'&&row.payload.previousAttemptRevisionId!==(previous?.revisionId??null))throw Error('attempt_predecessor_conflict');
   previous=row;
  }
  latest.set(id,previous!);
 }
 const heads=new Set<string>();
 for(const head of s.heads){
  assertScopedRecord(s,head);
  if(heads.has(head.entityId))throw Error('duplicate_entity_head');heads.add(head.entityId);
  const retained=revisions.get(head.revisionId),current=latest.get(head.entityId);
  if(!retained||canonicalJson(head)!==canonicalJson(retained)||current?.revisionId!==head.revisionId)throw Error('head_revision_conflict');
 }
 if(heads.size!==latest.size)throw Error('missing_entity_head');
}
function assertScopedRecord(s:ClinicSnapshot,row:RecordVersion):void{
 if(row.ownerId!==s.ownerId||row.studentId!==s.studentId||canonicalJson(row.payload.sourceStudent)!==canonicalJson(s.sourceStudent))throw Error('owner_scope_conflict');
 for(const value of [row.entityId,row.revisionId,row.actorId,row.idempotencyKey,row.commandDigest,row.contentDigest,row.integrityDigest])workToken(value);
 assertInstant(row.sourceObservedAt);assertInstant(row.recordedAt);
 if(!Number.isSafeInteger(row.sequence)||row.sequence<1||row.previousRevisionId===row.revisionId)throw Error('invalid_revision_transition');
 if(row.payload.kind==='learning_work_assignment')validateLearningAssignment(row.payload);
 else if(row.payload.kind==='learning_work_attempt')validateLearningAttempt(row.payload);
 else validateTeacherClinic(row.payload);
 if(row.contentDigest!==digest(row.payload))throw Error('content_digest_conflict');
}
/** Call after snapshot validation; adapters must repeat it at their atomic write boundary. */
export function assertClinicReviewBasis(s:ClinicSnapshot,c:Pick<ReviewAppend,'ownerId'|'studentId'|'clinic'>):void{
 if(c.ownerId!==s.ownerId||c.studentId!==s.studentId||canonicalJson(c.clinic.sourceStudent)!==canonicalJson(s.sourceStudent))throw Error('owner_scope_conflict');
 const assignment=s.heads.find(x=>x.revisionId===c.clinic.assignmentRevisionId&&x.payload.kind==='learning_work_assignment');
 if(!assignment||assignment.payload.kind!=='learning_work_assignment'||assignment.payload.status!=='assigned')throw Error('work_assignment_basis_conflict');
 const attempt=s.heads.find(x=>x.entityId===c.clinic.attemptEntityId&&x.revisionId===c.clinic.attemptRevisionId&&x.payload.kind==='learning_work_attempt');
 if(!attempt||attempt.payload.kind!=='learning_work_attempt'||attempt.payload.assignmentRevisionId!==assignment.revisionId)throw Error('work_attempt_basis_conflict');
 assertScopedRecord(s,assignment);assertScopedRecord(s,attempt);
 if(!assignment.payload.items.some(x=>x.assignedItemId===c.clinic.assignedItemId))throw Error('work_item_binding_conflict');
}
