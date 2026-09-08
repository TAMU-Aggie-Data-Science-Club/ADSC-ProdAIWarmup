import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DEMO,HEADERS,OPTIONS,parsePayload,featureVectors,pca,project,nearest,dot,reasons} from '../data.js';

test('24 diverse demo attendees use exact form categories and normalized vectors',()=>{
 const p=DEMO();assert.equal(p.length,24);for(const person of p)for(const [field,options] of Object.entries(OPTIONS))assert.ok(options.includes(person[field]));
 for(const v of featureVectors(p))assert.ok(Math.abs(Math.hypot(...v)-1)<1e-12);
});
test('exact headers, shortened aliases, extra columns, blanks, duplicate names',()=>{
 const p=parsePayload({headers:['Timestamp','Email Address',HEADERS.name,'Major','AI comfort','Student ID'],rows:[['today','secret',' Alex ',' csce ','Comfortable','sensitive'],['tomorrow','private','Alex',' stat ','','id'],['','','','','','']]});
 assert.equal(p.length,2);assert.equal(p[0].major,'CSCE');assert.equal(p[1].comfort,'Not shared');assert.notEqual(p[0].id,p[1].id);assert.ok(!JSON.stringify(p).includes('secret'));assert.ok(!JSON.stringify(p).includes('sensitive'));
 assert.equal(p[0].id,parsePayload({headers:['name'],rows:[['Alex'],['Alex'],['Ben'] ]})[0].id);
});
test('empty/malformed payloads and partial rows are handled intentionally',()=>{
 assert.deepEqual(parsePayload({headers:['name'],rows:[]}),[]);assert.deepEqual(parsePayload([{},null,['']]),[]);
 for(const bad of [{error:'bad'},'<html/>',{rows:[{email:'only private data'}]},{headers:['email'],rows:[]}])assert.throws(()=>parsePayload(bad));
 const p=parsePayload([{name:'A'},{name:'B',major:' NEWX '}]);assert.equal(p[1].major,'NEWX');assert.ok(featureVectors(p).every(v=>v.every(Number.isFinite)));
});
test('cosine uses original vectors: exact matches win independent of PCA',()=>{
 const [a,b]=DEMO();const people=[a,b,{...a,id:'clone',name:'Another person'}];const v=featureVectors(people);const n=nearest(people,v,a.id);
 assert.equal(n[0].person.id,'clone');assert.ok(Math.abs(n[0].score-1)<1e-12);assert.ok(!n.some(x=>x.person.id===a.id));assert.ok(reasons(a,people[2]).length);
 assert.equal(dot([1,0],[0,1]),0);
});
test('PCA preserves distances for a known rank-3 matrix and centers output',()=>{
 const matrix=[[1,2,3,6],[2,0,4,6],[-1,3,-2,0],[0,1,1,2],[4,-1,2,5]];const out=pca(matrix);
 // Fourth column is first+second+third: rank cannot exceed 3.
 for(let i=0;i<matrix.length;i++)for(let j=0;j<matrix.length;j++)assert.ok(Math.abs(Math.hypot(...matrix[i].map((v,k)=>v-matrix[j][k]))-Math.hypot(...out[i].map((v,k)=>v-out[j][k])))<1e-7);
 for(let k=0;k<3;k++)assert.ok(Math.abs(out.reduce((s,r)=>s+r[k],0))<1e-8);
 assert.deepEqual(pca(matrix),out);
});
test('zero, one, two and identical attendees produce finite positions and correct neighbor counts',()=>{
 for(const n of [0,1,2,24]){const people=DEMO().slice(0,n),vectors=featureVectors(people),coords=project(people,vectors);assert.equal(coords.length,n);assert.ok(coords.flat().every(Number.isFinite));if(n)assert.equal(nearest(people,vectors,people[0].id).length,Math.min(3,n-1));}
 const people=Array.from({length:4},(_,i)=>({...DEMO()[0],id:String(i)}));const coords=project(people,featureVectors(people));assert.equal(new Set(coords.map(v=>JSON.stringify(v))).size,4);
});
test('Apps Script serves only allowlisted fields and response freshness',()=>{
 const raw=[['Email','Timestamp',HEADERS.name,HEADERS.major,'Student ID'],['secret@example.com','private-time','Maya','CSCE','sensitive'],['','','','','']];let output;
 const context=vm.createContext({SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>({getDataRange:()=>({getDisplayValues:()=>raw.map(r=>r.slice())})})})},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>{output=JSON.parse(s);return output}})}});
 vm.runInContext(readFileSync(new URL('../google-apps-script.gs',import.meta.url),'utf8'),context);vm.runInContext('doGet()',context);
 assert.equal(output.rows.length,1);assert.deepEqual(output.headers,[HEADERS.name,HEADERS.major]);assert.ok(!JSON.stringify(output).includes('secret'));assert.ok(!JSON.stringify(output).includes('private-time'));assert.ok(!JSON.stringify(output).includes('sensitive'));assert.equal(parsePayload(output)[0].name,'Maya');assert.ok(Date.parse(output.generatedAt));
});
