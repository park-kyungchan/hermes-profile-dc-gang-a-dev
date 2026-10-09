import {z} from 'zod';
import {StudentId,EntityId,Instant,SourceId} from './ids.ts';
export const EvidenceScope=z.strictObject({studentId:StudentId,entityIds:z.array(EntityId),fields:z.array(z.string().min(1)),sourceId:SourceId,window:z.strictObject({from:Instant.nullable(),to:Instant.nullable(),labelRaw:z.string().nullable()}).nullable()}).superRefine((scope,ctx)=>{
 if(new Set(scope.entityIds).size!==scope.entityIds.length||new Set(scope.fields).size!==scope.fields.length)ctx.addIssue({code:'custom',message:'duplicate_scope_member'});
 if(scope.window?.from&&scope.window.to&&Date.parse(scope.window.from)>Date.parse(scope.window.to))ctx.addIssue({code:'custom',message:'invalid_scope_window'});
});
export type EvidenceScope=z.infer<typeof EvidenceScope>;
