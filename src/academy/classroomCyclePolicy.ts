export type ClassroomSeries='gauss'|'davinci';
export const clinicDecisionKinds=['grading','correction_required','explanation_required','review_pending','completed','reopened'] as const;
export type ClinicDecision=typeof clinicDecisionKinds[number];
export type CycleActivity='prestudy_review'|'concept_note_inspection'|'solution_note_inspection'|'app_problem_grading'|'concept_blank_test'|'wrong_clinic'|'similar_clinic'|'daily_test'|'havruta';
export interface CycleRequirement {
  activity:CycleActivity;
  responsibleActor:'teacher'|'student';
  completionAuthority:'explicit_teacher_judgment'|'verified_app_grading_for_exact_assigned_range';
}
const gauss:readonly CycleRequirement[]=[
  {activity:'prestudy_review',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'concept_note_inspection',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'solution_note_inspection',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'app_problem_grading',responsibleActor:'student',completionAuthority:'verified_app_grading_for_exact_assigned_range'},
  {activity:'concept_blank_test',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'wrong_clinic',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'similar_clinic',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'daily_test',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'havruta',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
];
/** Public snapshot subset, not the live operational policy owner. */
export const classroomCyclePolicy={operationalContextRevision:"public-source-clinic-v1",clinicWorkflow:{completionInvalidatingDecisions:["correction_required","explanation_required","reopened"] as readonly ClinicDecision[]}} as const;
export function requirementsForSeries(series:ClassroomSeries):CycleRequirement[]{
  if(series!=='gauss'&&series!=='davinci')throw Error('unsupported_classroom_series');
  const selected=series==='gauss'?gauss:gauss.filter(x=>x.activity==='wrong_clinic'||x.activity==='similar_clinic');
  return selected.map(x=>({...x}));
}
