import {z} from 'zod';
import {DecisionId,StudentId,EntityId,EvidenceId,RuleVersion,Instant} from './ids.ts';
import {Evidence} from './evidence.ts';
export const Decision=z.strictObject({schemaVersion:z.literal('academy.decision/2.0.0'),decisionId:DecisionId,studentId:StudentId,targetEntityIds:z.array(EntityId).min(1),evidenceIds:z.array(EvidenceId).min(1),ruleVersion:RuleVersion,status:z.enum(['pending','confirmed','conflicted','superseded','retracted']),authority:z.strictObject({actorKind:z.enum(['user','assistant','native_tool','system']),role:z.enum(['teacher','source_collector','reviewer','maintainer','unknown'])}),recordedAt:Instant}).superRefine((d,c)=>{
 if(new Set(d.evidenceIds).size!==d.evidenceIds.length||new Set(d.targetEntityIds).size!==d.targetEntityIds.length)c.addIssue({code:'custom',message:'duplicate_decision_reference'});
 if(d.status==='confirmed'&&!((d.authority.actorKind==='user'&&['teacher','reviewer'].includes(d.authority.role))||(d.authority.actorKind==='native_tool'&&d.authority.role==='reviewer')))c.addIssue({code:'custom',message:'confirmed_decision_requires_teacher_authority'});
});
export type Decision=z.infer<typeof Decision>;
export function validateDecisionReferences(input:unknown,evidenceInputs:readonly unknown[]):Decision{
 const decision=Decision.parse(input),evidence=evidenceInputs.map(value=>Evidence.parse(value));
 const byId=new Map(evidence.map(e=>[e.evidenceId,e]));if(byId.size!==evidence.length)throw Error('duplicate_evidence_id');
 for(const id of decision.evidenceIds){const e=byId.get(id);if(!e)throw Error('decision_evidence_missing');if(e.scope.studentId!==decision.studentId)throw Error('decision_student_scope_mismatch');if(!decision.targetEntityIds.every(target=>e.scope.entityIds.includes(target)))throw Error('decision_entity_scope_mismatch');if(decision.status==='confirmed'){if(e.claim.type!=='teacher_review_statement')throw Error('teacher_confirmation_requires_teacher_review_evidence');if(e.verificationStatus==='contradicted')throw Error('teacher_review_evidence_contradicted');const teacherReport=e.source.kind==='user_report'&&e.source.actor.kind==='user'&&['teacher','reviewer'].includes(e.source.actor.role),nativeReview=e.source.kind==='direct_lms_observation'&&e.source.actor.kind==='native_tool'&&e.source.actor.role==='reviewer';if(!teacherReport&&!nativeReview)throw Error('teacher_confirmation_requires_teacher_source_authority');const value=e.claim.value;if(value===null||typeof value!=='object'||Array.isArray(value)||!('state'in value)||typeof value.state!=='string'||!['teacher_confirmed_complete','teacher_confirmed_incomplete'].includes(value.state))throw Error('teacher_review_statement_state_required');}}
 return decision;
}
