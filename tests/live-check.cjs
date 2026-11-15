const fs=require('fs');const assert=require('assert/strict');
const {executeFormulaFromPackDef}=require('@codahq/packs-sdk/dist/testing/execution');
const {pack:details}=require('../pack.ts');const {pack:ratings}=require('../ratings/pack.ts');
const secrets=['.coda-credentials.json','ratings/.coda-credentials.json'].map(p=>JSON.parse(fs.readFileSync(p,'utf8')).credentials.paramValue);
const cases=[['Movie','tt1375666','tt1375666'],['Movie','Dune (2021)','tt1160419'],['Movie','Dune (1984)','tt0087182'],['Series','Breaking Bad','tt0903747'],['Person','Tom Hanks','nm0000158']];
(async()=>{
 for(const [formula,input,id] of cases){
  const result=await executeFormulaFromPackDef(details,formula,[input],undefined,undefined,{useRealFetcher:true,manifestPath:'pack.ts'});
  assert.equal(result.ImdbId,id);
  if(formula==='Person'){assert.equal(result.Name,'Tom Hanks');console.log(JSON.stringify({formula,input,name:result.Name,id}));continue;}
  const score=await executeFormulaFromPackDef(ratings,'Ratings',[result.ImdbId,formula==='Series'?'show':'movie'],undefined,undefined,{useRealFetcher:true,manifestPath:'ratings/pack.ts'});
  assert.equal(score.ImdbId,result.ImdbId);assert.ok(score.ImdbRating>0);assert.ok(score.RottenTomatoesAudience>0);
  if(formula==='Movie'){assert.ok(score.LetterboxdRating>0&&score.LetterboxdRating<=5);assert.ok(score.LetterboxdLink);}
  if(formula==='Series')assert.ok(result.Seasons.length);
  console.log(JSON.stringify({formula,input,title:result.Title,id,imdb:score.ImdbRating,critics:score.RottenTomatoesCritics,audience:score.RottenTomatoesAudience,letterboxd:score.LetterboxdRating,ratingsStatus:score.RatingsStatus}));
 }
})().catch(error=>{let message=String(error?.stack||error);for(const key of secrets)message=message.split(key).join('[redacted]');console.error(message.slice(0,1800));process.exitCode=1;});
