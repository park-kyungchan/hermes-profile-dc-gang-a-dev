import {assertExactKeys,assertInstant,digest,immutableCopy,requireText} from '../learning/model';
import {validateTeacherClinic,type TeacherClinicRevision} from '../academy/learningWork';
import {validateHierarchy,validateSourceKey} from '../academy/domain';
import {projectLearningWork} from '../academy/learningWorkProjection';
import {classroomCyclePolicy} from '../academy/classroomCyclePolicy';
export {clinicTargetId} from '../academy/clinicIdentity';
import {Evidence} from '../reference/domain/evidence';
import {validateDecisionReferences} from '../reference/domain/decision';
import {assertClinicSnapshot,assertClinicReviewBasis,type ClinicStore,type ReviewCommand} from '../ports/clinicStore';
export interface SyntheticContext {ownerId:string;studentId:string;actorId:string}

/** Evidence is stricter than the retained item history: never rebind an old review to a successor attempt. */
export function clinicReviewTargetId(c:TeacherClinicRevision){return 'clinic-review-'+digest({assignmentRevisionId:c.assignmentRevisionId,attemptEntityId:c.attemptEntityId,attemptRevisionId:c.attemptRevisionId,assignedItemId:c.assignedItemId});}
/** This source-only workbench accepts an explicitly synthetic context, not a login or native permission. */
export class ClinicWorkbench {
 private readonly context:SyntheticContext;
 constructor(private readonly store:ClinicStore,context:SyntheticContext,private readonly clock:()=>string){this.context=immutableCopy(context);assertExactKeys(this.context,['ownerId','studentId','actorId']);for(const v of Object.values(this.context))requireText(v,'synthetic context');}
 async scene(date:string){
  const s=immutableCopy(await this.store.snapshot());this.assertScope(s.ownerId,s.studentId,this.context.actorId);
  validateSourceKey(s.sourceStudent);validateHierarchy(s.catalog.map(x=>x.node));
  assertClinicSnapshot(s);
  return projectLearningWork(s.studentId,s.sourceStudent,date,s.versions,s.heads,s.catalog);
 }
 private assertScope(ownerId:string,studentId:string,actorId:string){if(ownerId!==this.context.ownerId||studentId!==this.context.studentId||actorId!==this.context.actorId)throw Error('owner_scope_conflict');}
 async recordReview(input:unknown){
  const snapshot=immutableCopy(input);if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('invalid_review_input');
  const scoped=snapshot as ReviewCommand;this.assertScope(scoped.ownerId,scoped.studentId,scoped.actorId);
  const c=parseClinicReviewCommand(snapshot);
  // Optional legacy ports retain pre-append basis checks; replay ports own exact retained lookup.
  const replay=await this.store.lookupReview?.(c);if(replay)return replay;
  const now=this.clock();assertInstant(now);if(Date.parse(c.clinic.reportedAt)>Date.parse(now))throw Error('future_reported_at');
  // Reject false bases even on custom ports; storage repeats this at its atomic boundary.
  const s=immutableCopy(await this.store.snapshot());this.assertScope(s.ownerId,s.studentId,c.actorId);assertClinicSnapshot(s);assertClinicReviewBasis(s,c);
  return this.store.appendReview({...c,now});
 }
}
/** Finite immutable command and evidence binding, not authentication or native authority. */
export function parseClinicReviewCommand(input:unknown):ReviewCommand{
  const snapshot=immutableCopy(input);if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('invalid_review_input');
  assertExactKeys(snapshot,['ownerId','studentId','actorId','requestId','expectedRevisionId','clinic','decision','evidence']);
  const c=snapshot as ReviewCommand;
  for(const value of [c.ownerId,c.studentId,c.actorId])requireText(value,'review scope');
  requireText(c.requestId,'review request');if(c.requestId.length>200)throw Error('invalid_review_request');
  if(c.expectedRevisionId!==null)requireText(c.expectedRevisionId,'expected revision');
  validateTeacherClinic(c.clinic);
  if(c.clinic.policyRevision!==classroomCyclePolicy.operationalContextRevision)throw Error('stale_clinic_policy');
  const evidence=c.evidence.map(e=>Evidence.parse(e));
  const decision=validateDecisionReferences(c.decision,evidence);
  if(decision.studentId!==c.studentId||decision.ruleVersion!==c.clinic.policyRevision||decision.targetEntityIds.length!==1||decision.targetEntityIds[0]!==clinicReviewTargetId(c.clinic)||decision.status!=='confirmed')throw Error('clinic_decision_binding_conflict');
  if(decision.authority.actorKind!=='user'||decision.authority.role!=='teacher')throw Error('synthetic_teacher_report_required');
  const expectedState=c.clinic.decision==='completed'?'teacher_confirmed_complete':'teacher_confirmed_incomplete';
  for(const id of decision.evidenceIds){const e=evidence.find(x=>x.evidenceId===id)!;
   if(e.source.kind!=='user_report'||e.source.actor.id!==c.actorId||e.source.actor.role!=='teacher'||!e.source.statementProvenanceConfirmed)throw Error('synthetic_teacher_report_required');
   if(e.claim.value===null||typeof e.claim.value!=='object'||Array.isArray(e.claim.value)||e.claim.value.state!==expectedState)throw Error('clinic_review_state_conflict');
  }
  if(evidence.length!==decision.evidenceIds.length)throw Error('unreferenced_review_evidence');
  return immutableCopy({...c,decision,evidence});
}
