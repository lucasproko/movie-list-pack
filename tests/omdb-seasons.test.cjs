const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mapSeason,getSeasonRatings}=require('../seasons/helpers.ts');
const ep=(n,rating,id=`tt${100+n}`)=>({Episode:String(n),imdbRating:String(rating),imdbID:id,Released:'2024-01-01'});
const data=(season,episodes)=>({Response:'True',Season:String(season),Episodes:episodes});
const ctx=handler=>({fetcher:{fetch:async request=>({body:await handler(new URL(request.url))})}});

test('OMDb means weight episodes equally, ignore missing/future scores and deduplicate episodes',()=>{
 const result=mapSeason(data(1,[ep(1,8),ep(2,6),ep(3,'N/A'),ep(2,10),{...ep(4,10),Released:'2099-01-01'},ep(5,11)]),1);
 assert.equal(result.Rating,7);assert.equal(result.RatedEpisodes,2);assert.equal(result.KnownEpisodes,4);
 assert.equal(mapSeason(data(2,[ep(1,9)]),1),undefined);
});
test('OMDb formula uses IMDb identity, deduplicates regular seasons and labels partial coverage',async()=>{
 const calls=[];const result=await getSeasonRatings(ctx(async u=>{
  calls.push(u);assert.equal(u.hostname,'www.omdbapi.com');assert.equal(u.searchParams.get('i'),'tt100');assert.equal(u.searchParams.has('apikey'),false);
  return data(Number(u.searchParams.get('Season')),[ep(1,8),ep(2,'N/A')]);
 }),'tt100',[2,0,1,2]);
 assert.equal(calls.length,2);assert.deepEqual(result.Seasons.map(s=>s.Label),['S1 · 8.0 (1/2 rated)','S2 · 8.0 (1/2 rated)']);
 assert.equal(result.LatestSeasonNumber,2);assert.equal(result.LiveSeasons,2);
});
test('incomplete OMDb listings retain the more complete imported season, without reusing another title',async()=>{
 const backup=JSON.stringify({ImdbId:'tt100',Seasons:[{SeasonNumber:1,Rating:7.5,RatedEpisodes:8,KnownEpisodes:8,MedianEpisodeVotes:500}]});
 const result=await getSeasonRatings(ctx(async()=>data(1,[ep(1,9)])),'tt100',[1],backup);
 assert.equal(result.Seasons[0].Rating,7.5);assert.equal(result.Seasons[0].Source,'IMDb dataset');assert.equal(result.SavedSeasons,1);
 const changed=await getSeasonRatings(ctx(async()=>({Response:'False',Error:'Series not found'})),'tt200',[1],backup);
 assert.deepEqual(changed.Seasons,[]);
});
test('provider limits stop subsequent request groups and preserve imported scores',async()=>{
 let calls=0;const result=await getSeasonRatings(ctx(async()=>{calls++;return {Response:'False',Error:'Request limit reached!'};}),'tt100',[1,2,3,4,5,6]);
 assert.equal(calls,4);assert.match(result.Status,/limit reached/);assert.deepEqual(result.Seasons,[]);
 const empty=await getSeasonRatings(ctx(async()=>{throw Error('unexpected request')}),'',[]);
 assert.deepEqual(empty.Seasons,[]);
 await assert.rejects(()=>getSeasonRatings(ctx(async()=>{}),'tt100',[1.5]),/whole numbers/);
});
test('the OMDb Pack uses its own single network domain and native key authentication',()=>{
 const {pack}=require('../seasons/pack.ts');assert.deepEqual(pack.networkDomains,['omdbapi.com']);
 assert.equal(pack.systemConnectionAuthentication.type,'QueryParamToken');assert.equal(pack.systemConnectionAuthentication.paramName,'apikey');
});
