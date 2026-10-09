import {canonicalJson,digest} from '../learning/model';
import type {RecordVersion} from './contracts/storageRecords';
import {validateTeacherClinic,type TeacherClinicRevision} from './learningWork';
type ClinicTarget=Pick<TeacherClinicRevision,'assignmentRevisionId'|'attemptEntityId'|'assignedItemId'>;
function targetKey(c:ClinicTarget){return {assignmentRevisionId:c.assignmentRevisionId,attemptEntityId:c.attemptEntityId,assignedItemId:c.assignedItemId};}
/** Stable history identity; evidence separately binds an exact attempt revision. */
export function clinicTargetId(c:ClinicTarget){return 'clinic-'+digest(targetKey(c));}
/** Never compare entity-local sequences from different streams for a logical clinic target.
 * This finite domain guard does not replace storage scope/head/predecessor admission. */
export function assertClinicTargetStreams(rows:readonly RecordVersion[]):void{
 canonicalJson(rows);
 const targets=new Map<string,string>(),entities=new Map<string,string>(),revisions=new Map<string,RecordVersion>();
 for(const row of rows){
  const prior=revisions.get(row.revisionId);
  if(prior&&(prior.payload.kind==='teacher_clinic_revision'||row.payload.kind==='teacher_clinic_revision')&&canonicalJson(prior)!==canonicalJson(row))throw Error('clinic_revision_identity_conflict');
  revisions.set(row.revisionId,row);
  if(row.payload.kind!=='teacher_clinic_revision')continue;
  validateTeacherClinic(row.payload);
  const key=canonicalJson(targetKey(row.payload)),target=clinicTargetId(row.payload);
  if(targets.has(key)&&targets.get(key)!==row.entityId)throw Error('competing_clinic_streams');
  if(entities.has(row.entityId)&&entities.get(row.entityId)!==key)throw Error('clinic_target_retargeted');
  if(row.entityId!==target)throw Error('clinic_entity_target_conflict');
  targets.set(key,row.entityId);entities.set(row.entityId,key);
 }
 for(const row of revisions.values()){
  if(row.payload.kind!=='teacher_clinic_revision')continue;
  const previous=row.previousRevisionId===null?undefined:revisions.get(row.previousRevisionId);
  if(previous&&(previous.entityId!==row.entityId||previous.payload.kind!=='teacher_clinic_revision'||canonicalJson(targetKey(previous.payload))!==canonicalJson(targetKey(row.payload))))throw Error('clinic_target_predecessor_conflict');
 }
}
