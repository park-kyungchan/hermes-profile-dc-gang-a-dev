import {digest,known,unknown} from '../learning/model';
import type {CatalogNode,SourceKey} from '../academy/domain';
import {classroomCyclePolicy} from '../academy/classroomCyclePolicy';
import type {LearningWorkAssignment,LearningWorkAttempt,TeacherClinicRevision} from '../academy/learningWork';
import type {RecordVersion} from '../academy/contracts/storageRecords';
export const SYNTHETIC_ONLY=true;
export const ownerId='synthetic-owner',studentId='synthetic-learner',actorId='synthetic-teacher';
export const date='2030-01-07',instant='2030-01-07T10:00:00Z';
export const key=(namespace:string,literalKey:string):SourceKey=>({namespace,literalKey});
export const sourceStudent=key('academy_student','synthetic-learner-key');
export const catalog: {node:CatalogNode;revisionId:string}[]=[
 {node:{id:'synthetic-section',kind:'learning_section',sourceKey:key('synthetic_catalog','section'),label:'Synthetic practice section',parent:unknown('Synthetic partial catalog')},revisionId:'synthetic-catalog-section-v1'},
 {node:{id:'synthetic-problem',kind:'problem',sourceKey:key('synthetic_catalog','problem'),label:'Synthetic problem 1',parent:unknown('Synthetic partial catalog')},revisionId:'synthetic-catalog-problem-v1'}
];
export const assignment:LearningWorkAssignment={kind:'learning_work_assignment',sourceStudent,sourceCourse:key('academy_course','synthetic-course'),sourceBook:key('academy_book','synthetic-book'),sourceUserCourse:key('academy_user_course','synthetic-registration'),registrationRevisionId:'synthetic-registration-v1',assignmentKey:key('synthetic_assignment','assignment'),activity:'wrong_clinic',origin:'teacher_report',effectiveDate:date,dueDate:unknown('No synthetic due date'),status:'assigned',catalogRefs:catalog.map(x=>({nodeId:x.node.id,revisionId:x.revisionId})),sectionNodeIds:['synthetic-section'],items:[{assignedItemId:'synthetic-item-1',itemKey:key('synthetic_item','1'),contentNodeId:'synthetic-problem',sectionNodeId:'synthetic-section',labelLiteral:'Synthetic problem 1'}],paper:unknown('No synthetic paper issuance'),evidenceRefs:['synthetic-assignment-report']};
export const attempt:LearningWorkAttempt={kind:'learning_work_attempt',sourceStudent,attemptKey:key('synthetic_attempt','attempt'),assignmentRevisionId:'synthetic-assignment-v1',paperIssuanceKey:null,previousAttemptRevisionId:null,occurredAt:unknown('No actual source event'),state:'graded',itemResults:[{assignedItemId:'synthetic-item-1',grade:known('incorrect',['synthetic-grade-evidence'])}],evidenceRefs:['synthetic-attempt-evidence']};
export function version(payload:RecordVersion['payload'],entityId:string,revisionId:string,sequence=1,previous?:RecordVersion):RecordVersion{
 return {ownerId,studentId,entityId,sequence,revisionId,previousRevisionId:previous?.revisionId??null,previousDigest:previous?.contentDigest??null,payload:structuredClone(payload),contentDigest:digest(payload),integrityDigest:digest({payload,sequence}),sourceObservedAt:instant,recordedAt:instant,actorId,idempotencyKey:'synthetic-'+revisionId,commandDigest:digest(payload)};
}
export function seed(){const versions=[version(assignment,'synthetic-assignment','synthetic-assignment-v1'),version(attempt,'synthetic-attempt','synthetic-attempt-v1')];return {ownerId,studentId,sourceStudent,versions,heads:structuredClone(versions),catalog:structuredClone(catalog)};}
export function review(requestId='synthetic-review-1'){
 const clinic:TeacherClinicRevision={kind:'teacher_clinic_revision',sourceStudent,assignmentRevisionId:'synthetic-assignment-v1',attemptEntityId:'synthetic-attempt',attemptRevisionId:'synthetic-attempt-v1',assignedItemId:'synthetic-item-1',effectiveDate:date,reportedAt:instant,decision:'completed',inspection:{writtenSolution:true,correctionExplanation:true},note:'Synthetic teacher inspected both required artifacts.',policyRevision:classroomCyclePolicy.operationalContextRevision};
 const target='clinic-review-'+digest({assignmentRevisionId:clinic.assignmentRevisionId,attemptEntityId:clinic.attemptEntityId,attemptRevisionId:clinic.attemptRevisionId,assignedItemId:clinic.assignedItemId});
 const evidenceId='synthetic-review-evidence-'+requestId;
 const evidence={schemaVersion:'academy.evidence/2.0.1',evidenceId,scope:{studentId,entityIds:[target],fields:['teacher_review'],sourceId:'synthetic-teacher-report',window:null},recordedAt:instant,timeRaw:null,claim:{type:'teacher_review_statement',value:{state:'teacher_confirmed_complete'}},verificationStatus:'unverified',verificationDetail:'Synthetic-only user report, not live authorization',revision:1,supersedesEvidenceIds:[],retractsEvidenceIds:[],conflictingEvidenceIds:[],source:{kind:'user_report',sourceMessageId:'synthetic-message-'+requestId,reportedAt:instant,reportedEventAt:null,observedAt:null,capturedAt:null,sourceRef:{reference:null,sha256:null,jsonPointer:null},actor:{kind:'user',role:'teacher',id:actorId},statementProvenanceConfirmed:true}};
 const decision={schemaVersion:'academy.decision/2.0.0',decisionId:'synthetic-decision-'+requestId,studentId,targetEntityIds:[target],evidenceIds:[evidenceId],ruleVersion:clinic.policyRevision,status:'confirmed',authority:{actorKind:'user',role:'teacher'},recordedAt:instant};
 return {ownerId,studentId,actorId,requestId,expectedRevisionId:null as string|null,clinic,decision,evidence:[evidence]};
}
