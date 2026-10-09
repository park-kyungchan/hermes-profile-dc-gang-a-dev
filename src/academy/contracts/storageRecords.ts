import type {CatalogNode,SourceKey} from '../domain';
import type {LearningWorkAssignment,LearningWorkAttempt,TeacherClinicRevision} from '../learningWork';
type AcademyRecord=LearningWorkAssignment|LearningWorkAttempt|TeacherClinicRevision;
/** Provider-neutral persisted values. PostgreSQL retains validation/transaction ownership. */
export interface StudentRegistration {readonly ownerId:string;readonly id:string;readonly displayName:string;readonly sourceKey:SourceKey;readonly proofRefs:readonly string[]}
export interface StoredStudent extends StudentRegistration {readonly registeredAt:string}
export interface AppendCommand {readonly ownerId:string;readonly studentId:string;readonly entityId:string;readonly actorId:string;readonly idempotencyKey:string;readonly expectedRevisionId:string|null;readonly sourceObservedAt:string;readonly payload:AcademyRecord}
export interface WriteAcknowledgement {readonly status:'saved'|'unchanged'|'replay';readonly revisionId:string;readonly sequence:number;readonly recordedAt:string;readonly contentDigest:string;readonly officialSaved:false;readonly parentSent:false}
export interface RecordVersion {ownerId:string;studentId:string;entityId:string;sequence:number;revisionId:string;previousRevisionId:string|null;previousDigest:string|null;payload:AcademyRecord;contentDigest:string;integrityDigest:string;sourceObservedAt:string;recordedAt:string;actorId:string;idempotencyKey:string;commandDigest:string}
export type CurrentRecord=RecordVersion&{lastVerifiedAt:string};
export interface PinnedCatalogNode {node:CatalogNode;revisionId:string}
