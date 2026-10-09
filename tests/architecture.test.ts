import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {test,expect} from 'bun:test';
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(join(dir,x.name)):x.name.endsWith('.ts')?[join(dir,x.name)]:[]);}
test('selected production modules obey domain/application/ports/UI boundaries',()=>{
 for(const path of files('src')){
  const text=readFileSync(path,'utf8');expect(text).not.toMatch(/\b(?:Bun\.serve|fetch\(|process\.env|localStorage)\b/);
  for(const match of text.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)){
   const spec=match[1],target=spec.startsWith('.')?resolve(path,'..',spec):spec;
   if(path.startsWith('src/reference/domain/'))expect(spec==='zod'||spec.startsWith('./')).toBe(true);
   if(path.startsWith('src/academy/')||path.startsWith('src/learning/'))expect(target).not.toMatch(/\/(?:adapters|application|ui|demo)\//);
   if(path.startsWith('src/application/'))expect(target).not.toMatch(/\/(?:adapters|ui|demo)\//);
   if(path.startsWith('src/ports/'))expect(target).not.toMatch(/\/(?:adapters|ui|demo)\//);
   if(path.startsWith('src/ui/'))expect(target).not.toMatch(/\/(?:adapters|demo)\//);
  }
 }
});
