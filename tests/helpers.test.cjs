const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseQuery,mapRatings,getMovie}=require('../helpers.ts');

test('IMDb URL and remake year are parsed without losing identity',()=>{
 assert.equal(parseQuery(' https://www.imdb.com/title/tt1160419/?ref_=x ').imdbId,'tt1160419');
 assert.deepEqual(parseQuery('Dune (1984)'),{title:'Dune',year:1984});
 assert.deepEqual(parseQuery('Dune 2021'),{title:'Dune',year:2021});
 assert.throws(()=>parseQuery(' '),/Enter a title/);
});
test('critics, audience, and Letterboxd retain their distinct native scales',()=>{
 const r=mapRatings({ratings:[{source:'tomatoes',value:86,url:'/m/inception'},{source:'popcorn',value:91},{source:'letterboxd',value:4.2,score:84,url:'/film/inception/'},{source:'imdb',value:8.8}]});
 assert.equal(r.RottenTomatoes,86);assert.equal(r.RottenTomatoesAudience,91);assert.equal(r.LetterboxdRating,4.2);assert.equal(r.ImdbRating,8.8);
 assert.equal(r.RottenTomatoesLink,'https://www.rottentomatoes.com/m/inception');assert.equal(r.LetterboxdLink,'https://letterboxd.com/film/inception/');
});
test('missing and invalid ratings stay blank; historical audience names still work',()=>{
 const r=mapRatings({ratings:[{source:'letterboxd',value:84},{source:'imdb',value:null},{source:'audience',value:0},{source:'tomatoes',value:'86'}]});
 assert.equal(r.LetterboxdRating,undefined);assert.equal(r.ImdbRating,undefined);assert.equal(r.RottenTomatoes,undefined);assert.equal(r.RottenTomatoesAudience,0);
 assert.equal(mapRatings({ratings:[{source:'tomatoesaudience',value:92}]}).RottenTomatoesAudience,92);
 assert.equal(mapRatings({}).RatingsStatus,'No ratings available');
});
function context(handler){return {invocationToken:'test',fetcher:{fetch:async r=>({body:await handler(new URL(r.url))})}};}
test('a ratings outage preserves movie metadata and reports the failure',async()=>{
 const calls=[];const ctx=context(async u=>{
  calls.push(u);if(u.hostname==='api.mdblist.com')throw {statusCode:429};
  if(u.pathname.endsWith('/find/tt1375666'))return {movie_results:[{id:27205}]};
  return {id:27205,title:'Inception',imdb_id:'tt1375666',release_date:'2010-07-16',runtime:148,credits:{cast:[],crew:[]}};
 });
 const r=await getMovie(ctx,'tt1375666');assert.equal(r.Title,'Inception');assert.equal(r.ImdbId,'tt1375666');assert.equal(r.ImdbRating,undefined);assert.match(r.RatingsStatus,/rate limit/);
 assert.equal(calls.find(u=>u.hostname==='api.mdblist.com').pathname,'/tmdb/movie/27205');
});
test('an unavailable requested year never silently selects another remake',async()=>{
 const ctx=context(async u=>{
  assert.equal(u.searchParams.get('year'),'1984');return {results:[{id:438631,title:'Dune',release_date:'2021-09-15'}]};
 });
 await assert.rejects(()=>getMovie(ctx,'Dune (1984)'),/No matching title/);
});
test('a successful year match and UK streaming alias select the right record',async()=>{
 const ctx=context(async u=>{
  if(u.pathname.endsWith('/search/movie'))return {results:[{id:438631,title:'Dune',release_date:'2021-09-15'},{id:841,title:'Dune',release_date:'1984-12-14'}]};
  if(u.hostname==='api.mdblist.com')return {ratings:[]};
  assert.equal(u.pathname,'/3/movie/841');return {id:841,title:'Dune',release_date:'1984-12-14','watch/providers':{results:{GB:{flatrate:[{provider_name:'Example TV'}],link:'https://example.com'}}}};
 });
 const r=await getMovie(ctx,'Dune (1984)','uk');assert.equal(r.Year,1984);assert.equal(r.Stream[0].country,'GB');assert.equal(r.Stream[0].name,'Example TV');
});
