const fs=require('fs');const assert=require('assert/strict');
const {executeFormulaFromPackDef}=require('@codahq/packs-sdk/dist/testing/execution');
const {pack}=require('../pack.ts');
const credentials=JSON.parse(fs.readFileSync('.coda-credentials.json','utf8')).credentials.params;
const cases=[['Movie','tt1375666','tt1375666'],['Movie','Dune (2021)','tt1160419'],['Movie','Dune (1984)','tt0087182'],['Series','Breaking Bad','tt0903747'],['Person','Tom Hanks','nm0000158']];
(async()=>{
 for(const [formula,input,id] of cases){
  const result=await executeFormulaFromPackDef(pack,formula,[input],undefined,undefined,{useRealFetcher:true,manifestPath:'pack.ts'});
  assert.equal(result.ImdbId,id);
  if(formula==='Movie'){assert.ok(result.ImdbRating>0);assert.ok(result.RottenTomatoesAudience>0);assert.ok(result.LetterboxdRating>0&&result.LetterboxdRating<=5);assert.ok(result.LetterboxdLink);}
  if(formula==='Series'){assert.ok(result.Seasons.length);assert.ok(result.RottenTomatoesAudience>0);}
  console.log(JSON.stringify({formula,input,title:result.Title||result.Name,id:result.ImdbId,imdb:result.ImdbRating,critics:result.RottenTomatoesCritics,audience:result.RottenTomatoesAudience,letterboxd:result.LetterboxdRating,ratingsStatus:result.RatingsStatus}));
 }
})().catch(error=>{let message=String(error?.stack||error);for(const key of Object.values(credentials))message=message.split(key).join('[redacted]');console.error(message.slice(0,1800));process.exitCode=1;});
