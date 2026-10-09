import {assertDate,canonicalJson,immutableCopy,unknown} from '../learning/model';
import type {CatalogNode,SourceKey} from './domain';
import type {RecordVersion} from './contracts/storageRecords';
import type {LearningWorkAssignment,LearningWorkAttempt,TeacherClinicRevision} from './learningWork';
import {classroomCyclePolicy} from './classroomCyclePolicy';
import {assertClinicTargetStreams} from './clinicIdentity';
type Version<T>=RecordVersion&{payload:T};
export interface PinnedCatalog {node:CatalogNode;revisionId:string}
/** Lesson-effective teacher decisions, not a claim to reconstruct what a source showed on that date. */
export function projectLearningWork(studentId:string,studentKey:SourceKey,date:string,versions:readonly RecordVersion[],heads:readonly RecordVersion[],catalog:readonly PinnedCatalog[]){
  assertDate(date);
  // Validate original input before deduplication can hide a conflicting retained clinic row.
  assertClinicTargetStreams(versions);assertClinicTargetStreams(heads);
  const rows=[...new Map(versions.map(row=>[row.revisionId,row])).values()];
  for(const row of rows)if(row.studentId!==studentId||'sourceStudent' in row.payload&&canonicalJson(row.payload.sourceStudent)!==canonicalJson(studentKey))throw Error('work_context_scope_conflict');
  const assignments=rows.filter((v):v is Version<LearningWorkAssignment>=>v.payload.kind==='learning_work_assignment');
  const attempts=rows.filter((v):v is Version<LearningWorkAttempt>=>v.payload.kind==='learning_work_attempt');
  const decisions=rows.filter((v):v is Version<TeacherClinicRevision>=>v.payload.kind==='teacher_clinic_revision');
  const latest=<T extends RecordVersion>(values:readonly T[]):T|null=>[...values].sort((a,b)=>b.sequence-a.sequence)[0]??null;
  const currentIds=new Set(heads.map(v=>v.revisionId));
  const selected=[...new Set(assignments.map(v=>v.entityId))].flatMap(id=>{
    const record=latest(assignments.filter(v=>v.entityId===id&&v.payload.effectiveDate<=date));return record?[record]:[];
  });
  const projectAssignment=(record:Version<LearningWorkAssignment>,historical:boolean)=>{
      const payload=record.payload,writable=!historical&&currentIds.has(record.revisionId)&&payload.status==='assigned';
      const nodes=payload.catalogRefs.map(ref=>{const found=catalog.find(row=>row.revisionId===ref.revisionId&&row.node.id===ref.nodeId);if(!found)throw Error('work_catalog_binding_conflict');return found.node;});
      const related=attempts.filter(v=>v.payload.assignmentRevisionId===record.revisionId);
      return {record,catalog:nodes,writable,history:assignments.filter(v=>v.entityId===record.entityId),
        attempts:[...new Set(related.map(v=>v.entityId))].map(entityId=>{
          const attempt=latest(related.filter(v=>v.entityId===entityId))!;
          const items=payload.items.map(item=>{
            const history=decisions.filter(v=>v.payload.assignmentRevisionId===record.revisionId&&v.payload.attemptEntityId===entityId&&v.payload.assignedItemId===item.assignedItemId).sort((a,b)=>a.sequence-b.sequence);
            const effective=history.filter(v=>v.payload.effectiveDate<=date),effectiveHead=latest(effective),current=latest(history);
            const decision=effectiveHead,currentDecision=latest(effective.filter(v=>v.payload.attemptRevisionId===attempt.revisionId));
            let retainedCompletion:Version<TeacherClinicRevision>|null=null;
            for(const row of effective){if(row.payload.decision==='completed')retainedCompletion=row;else if(classroomCyclePolicy.clinicWorkflow.completionInvalidatingDecisions.includes(row.payload.decision))retainedCompletion=null;}
            // Source replacement never deletes a teacher judgment or silently inspects the successor evidence.
            const completion=retainedCompletion?.payload.attemptRevisionId===attempt.revisionId?retainedCompletion:null;
            const inspectionBasis=completion?'current_attempt_revision' as const:retainedCompletion?'prior_attempt_revision' as const:'not_established' as const;
            return {item,sourceGrade:attempt.payload.itemResults.find(row=>row.assignedItemId===item.assignedItemId)?.grade??unknown('No qualified item grade'),decision,currentDecision,completion,retainedCompletion,inspectionBasis,history,
              writable:writable&&currentIds.has(attempt.revisionId)&&(!current||current.revisionId===effectiveHead?.revisionId),
              expectedRevisionId:current?.revisionId??null,
              state:completion?'completed' as const:retainedCompletion?'prior_revision_completed' as const:currentDecision?.payload.decision??'source_unknown' as const};
          });
          return {record:attempt,history:related.filter(v=>v.entityId===entityId),items,completed:items.length>0&&items.every(item=>item.state==='completed')};
        }),
      };
  };
  return immutableCopy({schemaVersion:1 as const,date,coverage:'retained_explicit_assignments_not_complete_inventory' as const,
    sourceClockMeaning:'latest_retained_source_versions_not_historical_source_reconstruction' as const,
    assignments:selected.map(record=>({...projectAssignment(record,false),archived:assignments.filter(v=>v.entityId===record.entityId&&v.revisionId!==record.revisionId).map(v=>projectAssignment(v,true))})),
    unknowns:['No catalog-only section is an assignment','Missing attempt or grade is unknown, not nonperformance','Completion is exact assignment revision/attempt/item only; no official projection or delivery'],
  });
}
export type LearningWorkProjection=ReturnType<typeof projectLearningWork>;
