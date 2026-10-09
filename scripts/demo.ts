import {mkdirSync,writeFileSync} from 'node:fs';
import {ClinicWorkbench} from '../src/application/clinicWorkbench';
import {SyntheticClinicStore} from '../src/adapters/syntheticClinicStore';
import {renderWorkbench} from '../src/ui/workbench';
import {seed,review,ownerId,studentId,actorId,date,instant} from '../src/demo/synthetic';
const store=new SyntheticClinicStore(seed()),app=new ClinicWorkbench(store,{ownerId,studentId,actorId},()=>instant);
const before=await app.scene(date);const receipt=await app.recordReview(review());const after=await app.scene(date);
mkdirSync('dist',{recursive:true});writeFileSync('dist/synthetic-clinic.html',renderWorkbench(after));
console.log(JSON.stringify({scope:'synthetic_only',before:before.assignments[0].attempts[0].items[0].state,after:after.assignments[0].attempts[0].items[0].state,retainedVersions:(await store.snapshot()).versions.length,retainedEvidenceReviews:store.retainedReviews().length,officialSaved:receipt.officialSaved,parentSent:receipt.parentSent,html:'dist/synthetic-clinic.html'}));
