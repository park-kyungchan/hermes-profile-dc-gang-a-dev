export interface EvidenceRailRow {
 readonly id:string;readonly title:string;readonly code:string;readonly status:string;readonly value:string|null;readonly date:string;readonly teacherState:string;
 readonly columns:readonly {title:string;fields:readonly (readonly [string,string])[]}[];
 readonly items?:readonly {label:string;correctness:'O'|'X'}[];readonly note:string;
}
export const escapeRailText=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const e=escapeRailText;
/** Shared read-only presentation for protected real scenes and explicitly synthetic gallery fixtures. */
export function renderEvidenceRailRow(row:EvidenceRailRow,open=false):string{
 const id='rail-'+encodeURIComponent(row.id);
 return `<details class="record" name="teacher-source-evidence" data-source-evidence="true" data-record-container="${e(row.id)}" ${open?'open':''}><summary class="record-summary" data-record-id="${e(row.id)}" aria-controls="${e(id)}"><span class="glyph observed" aria-hidden="true">⊙</span><span class="record-label">${e(row.title)}</span><span class="code">${e(row.code)}</span><span class="evidence-status observed">${e(row.status)}</span><span class="numeric ${row.value===null?'empty':''}">${row.value===null?'채점 근거 별도':e(row.value)+'<small>점</small>'}<span class="raw-date">${e(row.date)}</span></span><span class="teacher">${e(row.teacherState)}</span><span class="expand-sign" aria-hidden="true">+</span></summary><div class="inline-evidence" id="${e(id)}" role="region" aria-label="${e(row.title)} 근거"><div class="detail-line"><h5>${e(row.title)}</h5></div><div class="detail-columns">${row.columns.map(column=>`<section><h6>${e(column.title)}</h6><dl>${column.fields.map(([key,value])=>`<dt>${e(key)}</dt><dd>${e(value)}</dd>`).join('')}</dl></section>`).join('')}</div>${row.items?.length?`<div class="item-result-list" aria-label="원본 문항별 채점">${row.items.map(item=>`<span class="item-result" data-correctness="${e(item.correctness)}">${e(item.label)}번 ${e(item.correctness)}</span>`).join('')}</div>`:''}<p class="read-only-note">${e(row.note)}</p></div></details>`;
}
