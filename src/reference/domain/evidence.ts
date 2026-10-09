import {z} from 'zod';
import {EvidenceId,Instant,NativeStudentId,RuleVersion,Sha256} from './ids.ts';
import {EvidenceScope} from './scope.ts';
export const EVIDENCE_SCHEMA_VERSION='academy.evidence/2.0.1' as const;
const ref=z.strictObject({sourceMessageId:z.string().min(1).nullable().optional(),reference:z.string().min(1).nullable(),sha256:Sha256.nullable(),jsonPointer:z.string().nullable()});
const common={evidenceId:EvidenceId,schemaVersion:z.literal(EVIDENCE_SCHEMA_VERSION),scope:EvidenceScope,recordedAt:Instant,timeRaw:z.string().nullable(),claim:z.strictObject({type:z.string().min(1),value:z.json()}),verificationStatus:z.enum(['unverified','corroborated','contradicted']),verificationDetail:z.string().nullable(),revision:z.number().int().positive(),supersedesEvidenceIds:z.array(EvidenceId),retractsEvidenceIds:z.array(EvidenceId),conflictingEvidenceIds:z.array(EvidenceId)};
const actor=z.strictObject({kind:z.enum(['user','assistant','native_tool','system']),role:z.enum(['teacher','source_collector','reviewer','maintainer','unknown']),id:z.string().nullable()});
/** Imported/inference reportedAt is the supplied report/upload clock, never a
 * source event or query-success clock. Inference providedClocks preserve legacy
 * supplied clock claims separately from its null direct observation clocks. */
export const EvidenceSource=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('user_report'),sourceMessageId:z.string().min(1),reportedAt:Instant.nullable(),reportedEventAt:Instant.nullable(),observedAt:z.null(),capturedAt:z.null(),sourceRef:ref,actor:actor.extend({kind:z.literal('user')}),statementProvenanceConfirmed:z.boolean()}),
 z.strictObject({kind:z.literal('imported_snapshot'),sourceRef:ref.extend({reference:z.string().min(1),sha256:Sha256}),reportedAt:Instant.nullable(),observedAt:Instant.nullable(),capturedAt:Instant.nullable(),actor}),
 z.strictObject({kind:z.literal('direct_lms_observation'),sourceRef:ref.extend({reference:z.string().min(1),sha256:Sha256}),reportedAt:z.null(),observedAt:Instant,capturedAt:Instant.nullable(),actor:actor.extend({kind:z.literal('native_tool')}),receipt:z.strictObject({toolName:z.string().min(1),runId:z.string().min(1),nativeStudentId:NativeStudentId,sourceRevision:z.string().min(1),observedAt:Instant})}),
 z.strictObject({kind:z.literal('inference'),sourceRef:ref,reportedAt:Instant.nullable(),observedAt:z.null(),capturedAt:z.null(),providedClocks:z.strictObject({observedAt:Instant.nullable(),capturedAt:Instant.nullable()}).optional(),actor:actor.extend({kind:z.enum(['assistant','system','native_tool'])}),inputEvidenceIds:z.array(EvidenceId).min(1),ruleVersion:RuleVersion})
]);
export const Evidence=z.strictObject({...common,source:EvidenceSource}).superRefine((e,c)=>{
 if(e.source.kind==='direct_lms_observation'&&e.source.observedAt!==e.source.receipt.observedAt)c.addIssue({code:'custom',message:'observation_time_must_match_receipt'});
 for(const ids of [e.supersedesEvidenceIds,e.retractsEvidenceIds,e.conflictingEvidenceIds])if(ids.includes(e.evidenceId)||new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'invalid_evidence_relation'});
});
export type Evidence=z.infer<typeof Evidence>;
export type EvidenceSource=z.infer<typeof EvidenceSource>;
