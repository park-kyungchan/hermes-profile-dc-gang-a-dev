import { assertExactKeys, assertKnowledge, assertRefs, canonicalJson, immutableCopy, requireText, stableId, type Knowledge } from '../learning/model';

/** Matches the existing student-evidence SourceKey definition; namespaces are never aliases. */
export interface SourceKey { readonly namespace: string; readonly literalKey: string }
export type CatalogKind = 'book_edition' | 'major_unit' | 'middle_unit' | 'minor_unit' | 'learning_section' | 'printed_page' | 'problem';
/** Qualified display metadata, never a replacement for the edition's source key. */
export interface BookDisplayIdentity {
  readonly series:'gauss'|'davinci'; readonly schoolStage:'elementary'|'middle';
  readonly grade:number; readonly term:1|2; readonly volume:number; readonly evidenceRefs:readonly string[];
}
export interface CatalogNode {
  readonly id: string;
  readonly kind: CatalogKind;
  readonly sourceKey: SourceKey;
  readonly label: string;
  readonly parent: Knowledge<string>;
  readonly bookIdentity?: BookDisplayIdentity;
}
export const catalogLevels: readonly CatalogKind[] = ['book_edition', 'major_unit', 'middle_unit', 'minor_unit', 'learning_section', 'printed_page', 'problem'];
/** Sections attach to their observed unit scope; old page-to-minor bindings remain valid. */
const catalogParents: Readonly<Record<CatalogKind, readonly CatalogKind[]>> = {
  book_edition: [], major_unit: ['book_edition'], middle_unit: ['major_unit'], minor_unit: ['middle_unit'],
  learning_section: ['major_unit', 'middle_unit', 'minor_unit'], printed_page: ['minor_unit', 'learning_section'], problem: ['printed_page'],
};
export function validateSourceKey(key: SourceKey): void {
  assertExactKeys(key, ['namespace', 'literalKey']);
  requireText(key.namespace, 'source namespace');
  requireText(key.literalKey, 'literal source key');
  if (key.namespace.length > 160 || key.literalKey.length > 200 || /[\u0000-\u001f\u007f]/.test(key.namespace + key.literalKey)) throw Error('invalid_source_key');
}
export function sourceId(key: SourceKey): string {
  validateSourceKey(key);
  return stableId('source', key.namespace, key.literalKey);
}
export function validateHierarchy(nodes: readonly CatalogNode[]): void {
  if (!Array.isArray(nodes) || nodes.length > 100000) throw Error('invalid_catalog');
  canonicalJson(nodes);
  const index = new Map<string, CatalogNode>();
  for (const node of nodes) {
    assertExactKeys(node, ['id', 'kind', 'sourceKey', 'label', 'parent', ...(Object.hasOwn(node,'bookIdentity')?['bookIdentity']:[])]);
    requireText(node.id, 'catalog id'); requireText(node.label, 'catalog label');
    if (node.label.length > 16000 || !catalogLevels.includes(node.kind)) throw Error('invalid_catalog_node');
    validateSourceKey(node.sourceKey); assertKnowledge<string>(node.parent, value => requireText(value, 'catalog parent'));
    if(Object.hasOwn(node,'bookIdentity')){
      if(node.kind!=='book_edition')throw Error('book_identity_requires_edition');
      validateBookDisplayIdentity(node.bookIdentity);
    }
    if (index.has(node.id)) throw Error('duplicate_catalog_id');
    index.set(node.id, node);
  }
  for (const node of nodes) {
    if (node.kind === 'book_edition') {
      if (node.parent.state === 'known') throw Error('catalog_root_parent');
    } else if (node.parent.state === 'known') {
      const parent = index.get(node.parent.value);
      if (!parent) throw Error('catalog_parent_missing');
      if (!catalogParents[node.kind as CatalogKind].includes(parent.kind)) throw Error('catalog_parent_level');
    }
  }
}
function validateBookDisplayIdentity(value:BookDisplayIdentity):void {
  assertExactKeys(value,['series','schoolStage','grade','term','volume','evidenceRefs']);
  if(!['gauss','davinci'].includes(value.series)||!['elementary','middle'].includes(value.schoolStage)
    ||!Number.isSafeInteger(value.grade)||value.grade<1||value.grade>(value.schoolStage==='elementary'?6:3)
    ||![1,2].includes(value.term)||!Number.isSafeInteger(value.volume)||value.volume<1)throw Error('invalid_book_identity');
  assertRefs(value.evidenceRefs);
}
export function catalogDisplayName(node:CatalogNode):string {
  canonicalJson(node);requireText(node.label,'catalog label');
  if(!Object.hasOwn(node,'bookIdentity'))return node.label;
  if(node.kind!=='book_edition')throw Error('book_identity_requires_edition');
  const identity=node.bookIdentity!;validateBookDisplayIdentity(identity);
  return `${identity.series==='gauss'?'가우스':'다빈치'} ${identity.schoolStage==='middle'?'중':''}${identity.grade}-${identity.term}-${identity.volume}`;
}
export function traceHierarchy(nodes: readonly CatalogNode[], id: string) {
  validateHierarchy(nodes);
  const index = new Map(nodes.map(node => [node.id, node]));
  const path: CatalogNode[] = [];
  let node = index.get(id);
  if (!node) throw Error('unknown_catalog_node');
  while (node) {
    path.unshift(node);
    if (node.kind === 'book_edition') return immutableCopy({ state: 'known' as const, path, unknowns: [] as string[] });
    if (node.parent.state === 'unknown') return immutableCopy({ state: 'partial' as const, path, unknowns: [node.parent.reason] });
    node = index.get(node.parent.value);
  }
  throw Error('catalog_parent_missing');
}
