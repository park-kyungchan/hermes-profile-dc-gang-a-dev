import {assertExactKeys,assertInstant,canonicalJson,digest,immutableCopy} from '../learning/model';
import type {RecordVersion} from '../academy/contracts/storageRecords';
import type {ClinicSnapshot,ClinicStore,ReviewAppend,ReviewCommand,ReviewReceipt} from '../ports/clinicStore';
import {assertClinicSnapshot,assertClinicReviewBasis} from '../ports/clinicStore';
import {validateLearningAttempt,validateTeacherClinic} from '../academy/learningWork';
import {parseClinicReviewCommand} from '../application/clinicWorkbench';
import {clinicTargetId} from '../academy/clinicIdentity';
/** Synthetic, single-process adapter only. No DB, network, authorization or production durability. */
export class SyntheticClinicStore implements ClinicStore {
 private state:ClinicSnapshot;
 private readonly requests=new Map<string,{digest:string;receipt:ReviewReceipt}>();
 private readonly evidenceLog:ReviewAppend[]=[];
 constructor(seed:ClinicSnapshot){const candidate=immutableCopy(seed);assertClinicSnapshot(candidate);this.state=structuredClone(candidate);}
 async snapshot(){assertClinicSnapshot(this.state);return structuredClone(this.state);}
 async lookupReview(input:ReviewCommand):Promise<ReviewReceipt|null>{return this.retainedReceipt(parseClinicReviewCommand(input));}
 private retainedReceipt(c:ReviewCommand):ReviewReceipt|null{
  assertClinicSnapshot(this.state);
  if(c.ownerId!==this.state.ownerId||c.studentId!==this.state.studentId||canonicalJson(c.clinic.sourceStudent)!==canonicalJson(this.state.sourceStudent))throw Error('owner_scope_conflict');
  const prior=this.requests.get(canonicalJson([c.ownerId,c.studentId,c.actorId,c.requestId]));
  if(!prior)return null;if(prior.digest!==digest(c))throw Error('idempotency_reuse');
  return {...prior.receipt,status:'replay'};
 }
 async appendReview(input:ReviewAppend):Promise<ReviewReceipt>{
  // Copy the ENTIRE finite input before property access/rest removes a getter such as now.
  const snapshot=immutableCopy(input);
  assertExactKeys(snapshot,['ownerId','studentId','actorId','requestId','expectedRevisionId','clinic','decision','evidence','now']);
  const {now,...body}=snapshot,command=parseClinicReviewCommand(body),c=immutableCopy({...command,now});
  const prior=this.retainedReceipt(command);if(prior)return prior;
  assertInstant(now);if(Date.parse(c.clinic.reportedAt)>Date.parse(now))throw Error('future_reported_at');
  // No await between reading a head and appending: atomic only within this one JS process.
  assertClinicSnapshot(this.state);validateTeacherClinic(c.clinic);
  if(c.ownerId!==this.state.ownerId||c.studentId!==this.state.studentId||canonicalJson(c.clinic.sourceStudent)!==canonicalJson(this.state.sourceStudent))throw Error('owner_scope_conflict');
  const commandDigest=digest(command),requestKey=canonicalJson([c.ownerId,c.studentId,c.actorId,c.requestId]);
  assertClinicReviewBasis(this.state,c);
  const entityId=clinicTargetId(c.clinic),current=this.state.heads.find(x=>x.entityId===entityId);
  if((current?.revisionId??null)!==c.expectedRevisionId)throw Error('stale_base');
  const contentDigest=digest(c.clinic),sequence=(current?.sequence??0)+1;
  const revisionId='synthetic-clinic-'+digest([entityId,sequence,commandDigest]);
  const row:RecordVersion={ownerId:c.ownerId,studentId:c.studentId,entityId,sequence,revisionId,previousRevisionId:current?.revisionId??null,previousDigest:current?.contentDigest??null,payload:structuredClone(c.clinic),contentDigest,integrityDigest:digest([contentDigest,current?.integrityDigest??null]),sourceObservedAt:c.clinic.reportedAt,recordedAt:now,actorId:c.actorId,idempotencyKey:c.requestId,commandDigest};
  const next=this.withRevision(row);assertClinicSnapshot(next);
  const evidenceCopy=immutableCopy(c),receipt:ReviewReceipt=immutableCopy({status:'saved',revisionId,officialSaved:false,parentSent:false});
  const requestReplay={digest:commandDigest,receipt},result=structuredClone(receipt);
  // All validation/copying is finished. Commit only ordinary private state/log/map operations.
  this.state=next;this.evidenceLog.push(evidenceCopy);this.requests.set(requestKey,requestReplay);
  return result;
 }
 /** Explicit test-only source replacement; does not claim an acquisition receipt. */
 replaceSyntheticAttempt(input:RecordVersion){
  const row=immutableCopy(input);assertClinicSnapshot(this.state);
  if(row.ownerId!==this.state.ownerId||row.studentId!==this.state.studentId||row.payload.kind!=='learning_work_attempt')throw Error('synthetic_attempt_scope_conflict');
  validateLearningAttempt(row.payload);
  if(this.state.versions.some(x=>x.revisionId===row.revisionId))throw Error('duplicate_revision_identity');
  const old=this.state.heads.find(x=>x.entityId===row.entityId);
  if(!old||old.payload.kind!=='learning_work_attempt'||row.sequence!==old.sequence+1||row.payload.previousAttemptRevisionId!==old.revisionId||row.previousRevisionId!==old.revisionId||row.previousDigest!==old.contentDigest)throw Error('synthetic_attempt_transition_conflict');
  const next=this.withRevision(row);assertClinicSnapshot(next);this.state=next;
 }
 private withRevision(row:RecordVersion):ClinicSnapshot{return {...this.state,versions:[...this.state.versions,immutableCopy(row)],heads:[...this.state.heads.filter(x=>x.entityId!==row.entityId),immutableCopy(row)]};}
 retainedReviews(){return structuredClone(this.evidenceLog);}
}
