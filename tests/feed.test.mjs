import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSnapshot} from '../feed.js';
const now=Date.now(),endpoint='https://example.com/exec';
const response=payload=>async(_url,opts)=>{assert.equal(opts.cache,'no-store');assert.equal(opts.credentials,'omit');assert.ok(opts.signal instanceof AbortSignal);return {ok:true,json:async()=>payload}};
test('fresh snapshot and valid empty room are accepted',async()=>{
 const result=await fetchSnapshot(endpoint,{now,fetcher:response({generatedAt:new Date(now).toISOString(),rows:[{name:'Maya'}]})});assert.equal(result.people[0].name,'Maya');assert.equal(result.generated,now);
 assert.deepEqual((await fetchSnapshot(endpoint,{fetcher:response({headers:['name'],rows:[]})})).people,[]);
});
test('network failure, non-JSON, HTTP errors, stale and malformed responses reject before replacing state',async()=>{
 const fetchers=[async()=>{throw new Error('Network unavailable')},async()=>({ok:false,status:503}),async()=>({ok:true,json:async()=>{throw new SyntaxError('HTML login page')}}),response(null),response({rows:'invalid'}),response({rows:[],generatedAt:new Date(now-180000).toISOString()}),response({rows:[],generatedAt:'invalid'}),response({rows:[],generatedAt:new Date(now+180000).toISOString()})];
 for(const fetcher of fetchers)await assert.rejects(fetchSnapshot(endpoint,{now,fetcher}));
 await assert.rejects(fetchSnapshot(endpoint,{now,lastGenerated:now,fetcher:response({rows:[],generatedAt:new Date(now-1000).toISOString()})}));
 await assert.rejects(fetchSnapshot('http://example.com',{fetcher:response([])}));
});
test('unchanged answers with fresh generation metadata remain valid',async()=>{
 const payload={rows:[{name:'Maya'}],generatedAt:new Date(now).toISOString()};
 const a=await fetchSnapshot(endpoint,{now,fetcher:response(payload)});const b=await fetchSnapshot(endpoint,{now:now+5000,lastGenerated:a.generated,fetcher:response({...payload,generatedAt:new Date(now+5000).toISOString()})});assert.deepEqual(a.people,b.people);assert.ok(b.generated>a.generated);
});
