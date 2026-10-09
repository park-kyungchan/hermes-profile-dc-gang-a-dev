# Teacher clinic source workbench

A runnable, source-only integration of selected original modules from `park-kyungchan/dc-gang-a` and the inspected `park-kyungchan/gang-a` archive, maintained by the product owner. It is a new source snapshot, not a full repository or Git-history merge. The original repositories, private history and live runtime are unchanged.

## What runs today

One Bun/TypeScript build chain connects the two domain seams in a single clinic workflow:

1. Explicit synthetic assignment, attempt and pinned catalog records enter the workbench.
2. gang-a's original strict evidence and decision contracts verify teacher-review evidence, student/entity scope and decision references.
3. The application binds that decision to dc-gang-a's exact assignment revision, attempt revision and assigned item. It rejects source-grade-only completion, missing inspection, stale policy, wrong actor/scope and wrong targets.
4. A clearly synthetic single-process adapter retains revisions and evidence with compare-and-append and idempotent replay. Seed, snapshot and write boundaries reject duplicate retained revision identities, foreign owner/student/source scope, divergent same-ID heads, stale entity heads and inconsistent predecessor chains before mutation. The application applies the same finite snapshot/basis checks even for custom storage ports; those ports still own atomic enforcement.
5. The public derivative of dc-gang-a's learning-work projection separates source grade, teacher review and retained prior-attempt completion. Its escaped teacher-rail renderer produces a read-only HTML view.

This is semantic integration, not two independent packages placed next to one another. It is deliberately a bounded clinic slice: it does not ship the private full teacher application, observation/clinic request-recovery journals, live source clients, PostgreSQL adapter or original authorization ingress. The public snapshot's activity/clinic-policy subset is not the current live operational policy owner.

## Run

Required: Bun 1.4.2. TypeScript 7.0.2 and all selected dependencies are locked.

    bun install --frozen-lockfile --ignore-scripts
    bun run check

Individual commands:

    bun run test
    bun run typecheck
    bun run build
    bun run demo

The demo writes `dist/synthetic-clinic.html`, which can be opened locally without a server. It prints actual synthetic before/after state, retained version count and `officialSaved: false`, `parentSent: false`. `dist/` and `node_modules/` are local generated outputs, not publication source. The Bun library bundle is `dist/index.js`; Zod remains an explicit runtime dependency.

## Boundaries

- All demo records and tests are newly authored, typed, visibly synthetic examples. No actual learners, parents, teacher originals or operational receipts are included.
- Evidence syntax and a supplied actor label are not authentication, permission, a trusted native receipt or teacher acceptance. This workbench has no production login. Its context is only a synthetic test input.
- The adapter is in-process memory, not durable storage or a deployed service. Its compare-and-append guarantee is limited to that process.
- R3 snapshots the entire finite-JSON command and synthetic context before suspension or property destructuring. Accessors are rejected without being evaluated. Direct synthetic adapter writes also execute the same decision/evidence-to-clinic binding validation; this is consistency validation, not authentication. Candidate state, evidence and replay receipt are validated/copied before a synchronous in-process commit; no crash durability or arbitrary runtime failure recovery is claimed.
- R4 repairs the public pure JSON codec: same-realm ordinary arrays must have dense own data indices and no decorations, symbols, accessors or custom prototypes. Plain objects must have only enumerable own data fields. Proxies are rejected before reflection using Bun's supported built-in proxy detector. Encoding never dispatches through caller methods, iterators or `toJSON`; valid plain JSON retains the original sorted bytes and hashes. This fixes a defect inherited from the selected original codec, not the private canonical source. Cross-realm objects and arbitrary global intrinsic tampering are outside this finite input contract.
- The shared domain-level clinic identity binds every retained clinic row to its exact assignment revision, attempt entity and assigned item. Seed, custom snapshots, new-write candidates and the exported projection reject unbound/competing streams and retargeted predecessors before effects or sequence comparison. Attempt revision remains a separate evidence binding so successor attempts retain teacher history but never inherit completion. Valid corrections invalidate prior completion without deleting it; incomparable local sequences are never merged or normalized.
- Optional `ClinicStore.lookupReview` is a read-only, complete-command-digest check scoped by owner, student, actor and request. Exact retained retries replay before current source-basis admission, even after a source successor; they never reapply obsolete completion. Changed request reuse is refused. The store repeats lookup at append for races. Legacy ports without this optional capability still work for new writes and retain application basis validation, but cannot promise replay after source advancement; production ports own trustworthy receipts and atomic enforcement.
- Production ingress, trusted source verification, persistence, official finalization and delivery need their own implementation and admission. No network acquisition, printing, sending, scheduler or native Hermes control is provided.
- The read-only HTML is a functional local view, not an independently accepted classroom UI. No browser/physical-device/teacher-acceptance claim is made.
- Current code does not implement 3D visualization or a Claude integration. These are possible future integrations, not delivered capabilities, installed providers or connected services.

## Architecture and source lineage

`src/academy/` retains selected dc-gang-a domain/catalog/work validation and a public projection derivative with target-stream admission. Its new `clinicIdentity.ts` owns the shared existing identity derivation and stream-consistency guard, reused by application, storage and projection. `src/learning/model.ts` extracts the original pure identity, knowledge and validation/hash utilities with the R4 finite-JSON codec repair; unrelated learning and Whole-Lens contracts are excluded. Storage record payloads are narrowed to this slice. The projection's nullable latest-record return type is made explicit for the pinned compiler. These public behavior changes do not change private originals or imply full product absorption.

`src/reference/domain/` retains gang-a's original v2 IDs, evidence scope, discriminated evidence and decision-reference validator. Those validators execute on the same review consumed by the clinic projection; they are not documentation-only copies.

`src/application/` owns the integration use case; `src/ports/` owns the narrow storage interface; `src/adapters/` contains only the synthetic adapter; `src/ui/` extracts dc-gang-a's escaped teacher-rail renderer and adds the local read-only view. No heavy framework, multiple build chains, microservices or copied runtime authority were introduced.

The R2 repair is newly authored public integration code, not a change to private canonical source. It reuses the selected original pure payload validators. Synthetic attempt replacements must supply a globally new revision ID and exact predecessor identity/digest metadata; no head is repaired, discarded or silently normalized to conceal inconsistent input. Retained heads must exactly match the latest retained entity revision, including payload and metadata. Distinct successor evidence preserves prior teacher history but never inherits current completion. The synthetic fixture builder accepts an explicit predecessor so tests construct the same valid chain that the adapter requires.

The import is non-history-preserving. Exact private source byte pins and the public file allowlist are kept outside this candidate for independent review. This README does not expose private operator paths or pretend to reproduce the original development history.

## AI-assisted development and checks

AI assisted source inspection, selection, integration implementation and synthetic tests in an owner-scoped Hermes task. This is not proof of autonomous end-to-end production delivery, external users, independent review or real classroom acceptance. Local tests exercise cross-student evidence refusal, wrong target/actor, mandatory inspection, stale policy/basis, idempotency conflicts, competing revisions, source replacement, correction history and HTML escaping. A local build is not remote CI; the supplied CI workflow becomes active only after separately reviewed publication.

## Ownership and third-party terms

Original product code remains owned by its original user/owner. No MIT, Apache or other permissive license is granted for this product snapshot; all rights remain reserved unless the owner separately chooses a license. Publishing readable source does not imply a reuse grant.

Dependencies retain their own terms: Zod and Bun/Node/Undici type declarations use their published MIT terms; TypeScript uses Apache-2.0. This repository does not bundle those package implementations or fonts. Installation retains dependency license files in `node_modules/`; no OFL font asset or private upstream asset was imported. See `third-party-notices.json` for the dependency scope.
