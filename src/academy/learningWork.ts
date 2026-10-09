import {assertDate,assertExactKeys,assertInstant,assertKnowledge,assertRefs,canonicalJson,requireText,type Knowledge} from '../learning/model';
import {sourceId,validateSourceKey,type SourceKey} from './domain';
import {clinicDecisionKinds,requirementsForSeries,type ClinicDecision,type CycleActivity} from './classroomCyclePolicy';

/** Proven transaction refusals; transport/commit uncertainty must never enter this set. */
export const clinicTerminalRefusals:readonly string[]=['stale_base','work_assignment_basis_conflict','work_attempt_basis_conflict','work_item_binding_conflict','clinic_target_identity_conflict','invalid_revision_transition','idempotency_reuse','stale_clinic_policy'];
export const clinicReconciliationRefusals:readonly string[]=[...clinicTerminalRefusals,'unresolved_clinic_request'];
export class ClinicCommandRefusal extends Error {constructor(code:string,readonly originalRetained:boolean){super(code);}}

export interface WorkItem {assignedItemId:string;itemKey:SourceKey;contentNodeId:string;sectionNodeId:string;labelLiteral:string}
export interface PaperIssuance {
  paperKey:SourceKey;versionLiteral:string;issuanceKey:SourceKey;reissueOf:SourceKey|null;
  orderedItems:readonly {assignedItemId:string;printedOrdinal:string}[];
}
/** Actual bounded assignment, not a catalog template or inferred obligation. */
export interface LearningWorkAssignment {
  kind:'learning_work_assignment';sourceStudent:SourceKey;sourceCourse:SourceKey;sourceBook:SourceKey;assignmentKey:SourceKey;
  sourceUserCourse:SourceKey;registrationRevisionId:string;
  activity:CycleActivity;origin:'teacher_report'|'qualified_source';effectiveDate:string;dueDate:Knowledge<string>;status:'assigned'|'withdrawn';
  catalogRefs:readonly {nodeId:string;revisionId:string}[];sectionNodeIds:readonly string[];items:readonly WorkItem[];
  paper:Knowledge<PaperIssuance>;evidenceRefs:readonly string[];
}
export interface LearningWorkAttempt {
  kind:'learning_work_attempt';sourceStudent:SourceKey;attemptKey:SourceKey;assignmentRevisionId:string;
  paperIssuanceKey:SourceKey|null;previousAttemptRevisionId:string|null;occurredAt:Knowledge<string>;
  state:'unknown'|'not_started'|'solving'|'submitted'|'graded';
  itemResults:readonly {assignedItemId:string;grade:Knowledge<'correct'|'incorrect'|'ungraded'>}[];evidenceRefs:readonly string[];
}
export interface TeacherClinicRevision {
  kind:'teacher_clinic_revision';sourceStudent:SourceKey;assignmentRevisionId:string;attemptEntityId:string;attemptRevisionId:string;assignedItemId:string;
  effectiveDate:string;reportedAt:string;decision:ClinicDecision;inspection:{writtenSolution:boolean;correctionExplanation:boolean};note:string;policyRevision:string;
}
/** Clinic concurrency follows the exact item/attempt, not the selected lesson date. */
export function sameClinicTarget(a:Pick<TeacherClinicRevision,'assignmentRevisionId'|'attemptEntityId'|'assignedItemId'>,b:typeof a):boolean{
  return a.assignmentRevisionId===b.assignmentRevisionId&&a.attemptEntityId===b.attemptEntityId&&a.assignedItemId===b.assignedItemId;
}
/** Protected original request journal; pending is not an accepted teacher decision. */
export interface TeacherClinicRequest {
  kind:'teacher_clinic_request';sourceStudent:SourceKey;requestId:string;expectedRevisionId:string|null;
  decision:TeacherClinicRevision;resolution:'pending'|'rejected';refusal:string|null;
}
export function validateClinicRequest(value:TeacherClinicRequest):void{
  canonicalJson(value);assertExactKeys(value,['kind','sourceStudent','requestId','expectedRevisionId','decision','resolution','refusal']);
  if(value.kind!=='teacher_clinic_request'||!['pending','rejected'].includes(value.resolution))throw Error('invalid_clinic_request');
  keyNamespace(value.sourceStudent,'academy_student');workToken(value.requestId);if(value.expectedRevisionId!==null)workToken(value.expectedRevisionId);
  if(value.resolution==='pending'?value.refusal!==null:typeof value.refusal!=='string')throw Error('invalid_clinic_request');
  if(value.refusal!==null)workToken(value.refusal);validateTeacherClinic(value.decision);
  if(canonicalJson(value.sourceStudent)!==canonicalJson(value.decision.sourceStudent))throw Error('source_student_binding_conflict');
}
export function validateTeacherClinic(value:TeacherClinicRevision):void{
  canonicalJson(value);assertExactKeys(value,['kind','sourceStudent','assignmentRevisionId','attemptEntityId','attemptRevisionId','assignedItemId','effectiveDate','reportedAt','decision','inspection','note','policyRevision']);
  if(value.kind!=='teacher_clinic_revision'||!clinicDecisionKinds.includes(value.decision))throw Error('invalid_clinic_decision');
  keyNamespace(value.sourceStudent,'academy_student');
  for(const token of [value.assignmentRevisionId,value.attemptEntityId,value.attemptRevisionId,value.assignedItemId,value.policyRevision])workToken(token);
  assertDate(value.effectiveDate);assertInstant(value.reportedAt);requireText(value.note,'teacher directive');if(value.note.length>4000)throw Error('clinic_note_too_large');
  assertExactKeys(value.inspection,['writtenSolution','correctionExplanation']);
  if(typeof value.inspection.writtenSolution!=='boolean'||typeof value.inspection.correctionExplanation!=='boolean')throw Error('invalid_clinic_inspection');
  if(value.decision==='completed'&&(!value.inspection.writtenSolution||!value.inspection.correctionExplanation))throw Error('explicit_clinic_inspection_required');
}
export function workToken(value:string):void{requireText(value,'work identity');if(value.length>200||/[\u0000-\u001f\u007f]/.test(value))throw Error('invalid_work_identity');}
function list<T>(value:readonly T[],max:number):void{if(!Array.isArray(value)||value.length<1||value.length>max)throw Error('invalid_work_list');}
function keyNamespace(key:SourceKey,namespace:string){validateSourceKey(key);if(key.namespace!==namespace)throw Error('source_namespace_conflict');}
export function validateLearningAttempt(value:LearningWorkAttempt):void{
  canonicalJson(value);assertExactKeys(value,['kind','sourceStudent','attemptKey','assignmentRevisionId','paperIssuanceKey','previousAttemptRevisionId','occurredAt','state','itemResults','evidenceRefs']);
  if(value.kind!=='learning_work_attempt'||!['unknown','not_started','solving','submitted','graded'].includes(value.state))throw Error('invalid_work_attempt');
  keyNamespace(value.sourceStudent,'academy_student');validateSourceKey(value.attemptKey);workToken(value.assignmentRevisionId);
  if(value.paperIssuanceKey!==null)validateSourceKey(value.paperIssuanceKey);
  if(value.previousAttemptRevisionId!==null)workToken(value.previousAttemptRevisionId);
  assertKnowledge(value.occurredAt,assertInstant);assertRefs(value.evidenceRefs);
  if(!Array.isArray(value.itemResults)||value.itemResults.length>256)throw Error('invalid_work_list');
  const ids=new Set<string>();
  for(const item of value.itemResults){assertExactKeys(item,['assignedItemId','grade']);workToken(item.assignedItemId);if(ids.has(item.assignedItemId))throw Error('duplicate_work_item');ids.add(item.assignedItemId);assertKnowledge<string>(item.grade,grade=>{if(!['correct','incorrect','ungraded'].includes(grade))throw Error('invalid_work_grade');});}
}
export function validateLearningAssignment(value:LearningWorkAssignment):void{
  canonicalJson(value);assertExactKeys(value,['kind','sourceStudent','sourceCourse','sourceUserCourse','registrationRevisionId','sourceBook','assignmentKey','activity','origin','effectiveDate','dueDate','status','catalogRefs','sectionNodeIds','items','paper','evidenceRefs']);
  if(value.kind!=='learning_work_assignment')throw Error('invalid_work_kind');
  keyNamespace(value.sourceStudent,'academy_student');keyNamespace(value.sourceCourse,'academy_course');keyNamespace(value.sourceBook,'academy_book');validateSourceKey(value.assignmentKey);
  keyNamespace(value.sourceUserCourse,'academy_user_course');workToken(value.registrationRevisionId);
  if(!requirementsForSeries('gauss').some(row=>row.activity===value.activity)||!['teacher_report','qualified_source'].includes(value.origin)||!['assigned','withdrawn'].includes(value.status))throw Error('invalid_work_assignment');
  assertDate(value.effectiveDate);assertKnowledge(value.dueDate,assertDate);assertRefs(value.evidenceRefs);
  list(value.catalogRefs,512);const nodes=new Set<string>(),revisions=new Set<string>();
  for(const ref of value.catalogRefs){assertExactKeys(ref,['nodeId','revisionId']);workToken(ref.nodeId);workToken(ref.revisionId);if(nodes.has(ref.nodeId)||revisions.has(ref.revisionId))throw Error('duplicate_work_catalog');nodes.add(ref.nodeId);revisions.add(ref.revisionId);}
  list(value.sectionNodeIds,64);if(new Set(value.sectionNodeIds).size!==value.sectionNodeIds.length)throw Error('duplicate_work_section');
  for(const id of value.sectionNodeIds){workToken(id);if(!nodes.has(id))throw Error('work_section_reference_missing');}
  list(value.items,256);const items=new Set<string>();
  for(const item of value.items){
    assertExactKeys(item,['assignedItemId','itemKey','contentNodeId','sectionNodeId','labelLiteral']);workToken(item.assignedItemId);validateSourceKey(item.itemKey);workToken(item.contentNodeId);workToken(item.sectionNodeId);requireText(item.labelLiteral,'item label');
    if(item.labelLiteral.length>400||!nodes.has(item.contentNodeId)||!value.sectionNodeIds.includes(item.sectionNodeId))throw Error('work_item_scope_conflict');
    const key=item.assignedItemId;if(items.has(key))throw Error('duplicate_work_item');items.add(key);
  }
  assertKnowledge(value.paper,paper=>{
    assertExactKeys(paper,['paperKey','versionLiteral','issuanceKey','reissueOf','orderedItems']);validateSourceKey(paper.paperKey);validateSourceKey(paper.issuanceKey);workToken(paper.versionLiteral);
    if(paper.reissueOf!==null){validateSourceKey(paper.reissueOf);if(sourceId(paper.reissueOf)===sourceId(paper.issuanceKey))throw Error('paper_self_reissue');}
    list(paper.orderedItems,256);const members=new Set<string>(),ordinals=new Set<string>();
    for(const item of paper.orderedItems){assertExactKeys(item,['assignedItemId','printedOrdinal']);workToken(item.assignedItemId);workToken(item.printedOrdinal);const key=item.assignedItemId;if(members.has(key)||ordinals.has(item.printedOrdinal)||!items.has(key))throw Error('paper_item_membership_conflict');members.add(key);ordinals.add(item.printedOrdinal);}
    if(members.size!==items.size)throw Error('paper_item_membership_conflict');
  });
}
