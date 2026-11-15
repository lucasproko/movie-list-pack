const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseQuery,getMovie,getSeries}=require('../helpers.ts');
const {mapRatings,getRatings,getRatingsMany}=require('../ratings/helpers.ts');

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
test('a ratings outage leaves the separate metadata result usable',async()=>{
 const calls=[];const ctx=context(async u=>{
  calls.push(u);assert.equal(u.hostname,'api.themoviedb.org');
  assert.equal(u.searchParams.has('api_key'),false);
  if(u.pathname.endsWith('/find/tt1375666'))return {movie_results:[{id:27205}]};
  return {id:27205,title:'Inception',imdb_id:'tt1375666',release_date:'2010-07-16',runtime:148,credits:{cast:[],crew:[]}};
 });
 const movie=await getMovie(ctx,'tt1375666');
 const failed=context(async u=>{assert.equal(u.hostname,'api.mdblist.com');throw {statusCode:429};});
 const scores=await getRatings(failed,movie.ImdbId);
 assert.equal(movie.Title,'Inception');assert.equal(movie.ImdbId,'tt1375666');assert.equal(scores.ImdbRating,undefined);assert.match(scores.RatingsStatus,/rate limit/);
 assert.equal(calls.length,2);
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

test('each Pack declares exactly its own service and native API-key authentication',()=>{
 const {pack:details}=require('../pack.ts');const {pack:ratings}=require('../ratings/pack.ts');
 assert.deepEqual(details.networkDomains,['themoviedb.org']);assert.deepEqual(ratings.networkDomains,['mdblist.com']);
 assert.equal(details.systemConnectionAuthentication.type,'QueryParamToken');assert.equal(details.systemConnectionAuthentication.paramName,'api_key');
 assert.equal(ratings.systemConnectionAuthentication.type,'QueryParamToken');assert.equal(ratings.systemConnectionAuthentication.paramName,'apikey');
});
test('ratings use the supplied IMDb identity and distinguish movie from show',async()=>{
 const ctx=context(async u=>{
  assert.equal(u.pathname,'/imdb/show/tt0903747');assert.equal(u.searchParams.has('apikey'),false);
  return {title:'Breaking Bad',ids:{imdb:'tt0903747'},ratings:[{source:'popcorn',value:97}]};
 });
 const r=await getRatings(ctx,'https://www.imdb.com/title/tt0903747/','show');assert.equal(r.ImdbId,'tt0903747');assert.equal(r.RottenTomatoesAudience,97);
});
test('missing IDs do not request data and mismatched results never supply scores',async()=>{
 const empty=context(async()=>{throw Error('unexpected request');});assert.equal((await getRatings(empty,'')).RatingsStatus,'No IMDb ID');
 await assert.rejects(()=>getRatings(empty,'Inception'),/IMDb title ID/);
 const wrong=context(async()=>({ids:{imdb:'tt0087182'},ratings:[{source:'imdb',value:6.2}]}));
 const r=await getRatings(wrong,'tt1160419');assert.equal(r.ImdbRating,undefined);assert.match(r.RatingsStatus,/different title/);
});

test('extra discovery and TV commitment fields use the same two TMDB requests',async()=>{
 const calls=[];const ctx=context(async u=>{
  calls.push(u);
  if(u.pathname.endsWith('/search/tv'))return {results:[{id:87108,name:'Chernobyl',first_air_date:'2019-05-06'}]};
  assert.ok(u.searchParams.get('append_to_response').includes('keywords,recommendations'));
  return {name:'Chernobyl',first_air_date:'2019-05-06',last_air_date:'2019-06-03',in_production:false,status:'Ended',type:'Miniseries',number_of_episodes:5,number_of_seasons:1,spoken_languages:[{english_name:'English'}],keywords:{results:[{name:'based on true story'}]},recommendations:{results:[{name:'Toxic Town',first_air_date:'2025-02-27'}]},next_episode_to_air:null};
 });
 const r=await getSeries(ctx,'Chernobyl');assert.equal(calls.length,2);assert.equal(r.TotalEpisodes,5);assert.equal(r.SeasonCount,1);assert.equal(r.Status,'Ended');assert.equal(r.SeriesType,'Miniseries');assert.equal(r.NextEpisodeNumber,undefined);assert.deepEqual(r.Languages,['English']);assert.deepEqual(r.Keywords,['based on true story']);assert.deepEqual(r.MoreLikeThis,['Toxic Town (2025)']);
});
test('rating counts and provider timestamps preserve missing and invalid values',()=>{
 const r=mapRatings({ratings:[{source:'imdb',votes:180169},{source:'letterboxd',votes:1910587},{source:'tomatoes',votes:317}],updated:'2026-11-13T22:07:32Z',released_digital:'2023-08-22',awards:'Two Oscar nominations'});
 assert.equal(r.ImdbVotes,180169);assert.equal(r.LetterboxdVotes,1910587);assert.equal(r.RottenTomatoesCriticReviews,317);assert.equal(r.ProviderUpdatedAt,'2026-11-13T22:07:32.000Z');assert.equal(r.DigitalReleaseDate,'2023-08-22');assert.equal(r.Awards,'Two Oscar nominations');
 const bad=mapRatings({ratings:[{source:'imdb',votes:-1},{source:'letterboxd',votes:'500+'}],updated:'unknown',awards:null});assert.equal(bad.ImdbVotes,undefined);assert.equal(bad.LetterboxdVotes,undefined);assert.equal(bad.ProviderUpdatedAt,undefined);assert.equal(bad.Awards,undefined);
});

test('audience lower-bound counts and critic counts retain their source',()=>{
 const r=mapRatings({ratings:[{source:'popcorn',votes:250000},{source:'metacritic',votes:42}]});
 assert.equal(r.RottenTomatoesAudienceVotes,250000);assert.equal(r.MetacriticReviews,42);
 assert.equal(mapRatings({ratings:[{source:'audience',votes:0}]}).RottenTomatoesAudienceVotes,0);
 assert.equal(mapRatings({ratings:[{source:'metacritic',votes:2.5}]}).MetacriticReviews,undefined);
});

test('batches deduplicate IDs, split safely and match unordered responses by identity',async()=>{
 const ids=Array.from({length:51},(_,i)=>`tt${1000+i}`);let calls=0;
 const ctx={fetcher:{fetch:async request=>{
  calls++;assert.equal(request.method,'POST');assert.equal(new URL(request.url).pathname,'/imdb/show');
  const chunk=JSON.parse(request.body).ids;assert.ok(chunk.length<=50);
  return {body:[...chunk].reverse().filter(id=>id!=='tt1001').map(id=>({title:id,ids:{imdb:id},ratings:[{source:'imdb',value:8},{source:'letterboxd',value:8.4}]})).concat({ids:{imdb:'tt9999'},ratings:[{source:'imdb',value:10}]})};
 }}};
 const results=await getRatingsMany(ctx,[...ids,' TT1000 ',''],'tv');
 assert.equal(calls,2);assert.equal(results.length,51);assert.equal(results[0].ImdbId,'tt1000');assert.equal(results[0].ImdbRating,8);
 assert.equal(results[0].LetterboxdRating,4.2);
 assert.equal(results[1].ImdbId,'tt1001');assert.equal(results[1].ImdbRating,undefined);assert.match(results[1].RatingsStatus,/did not return/);
 assert.deepEqual(await getRatingsMany(ctx,[]),[]);assert.equal(calls,2);
 await assert.rejects(()=>getRatingsMany(ctx,['bad']),/IMDb title IDs/);
 await assert.rejects(()=>getRatingsMany(ctx,['tt1'],'person'),/media type/);
 await assert.rejects(()=>getRatingsMany({fetcher:{fetch:async()=>({body:{error:'unavailable'}})}},['tt1']),/did not return a ratings batch/);
});

test('season scores exclude specials, future seasons, and unrated seasons without extra calls',async()=>{
 let calls=0;const ctx=context(async u=>{
  calls++;if(u.pathname.includes('/find/'))return {tv_results:[{id:1}]};
  return {id:1,name:'Example',external_ids:{imdb_id:'tt123'},seasons:[
   {season_number:0,vote_average:9,air_date:'2020-01-01'},
   {season_number:2,vote_average:7.6,air_date:'2021-01-01',episode_count:8},
   {season_number:1,vote_average:8.4,air_date:'2020-01-01',episode_count:10},
   {season_number:3,vote_average:0,air_date:'2022-01-01'},
   {season_number:4,vote_average:9.9,air_date:'2999-01-01'}]};
 });
 const result=await getSeries(ctx,'tt123');assert.equal(calls,2);
 assert.deepEqual(result.SeasonRatings.map(s=>s.Label),['S1 · 8.4','S2 · 7.6']);
 assert.equal(result.LatestSeasonRating,7.6);assert.equal(result.LatestSeasonNumber,2);
 assert.equal(result.Seasons.length,5);
});
