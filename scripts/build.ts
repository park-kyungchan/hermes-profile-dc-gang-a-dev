export {};
const result=await Bun.build({entrypoints:['src/index.ts'],outdir:'dist',target:'bun',format:'esm',sourcemap:'none',external:['zod']});
if(!result.success){console.error(result.logs);process.exit(1);}
console.log(JSON.stringify({built:result.outputs.map(x=>({path:x.path.split('/').pop(),bytes:x.size})),target:'bun',external:['zod']}));
