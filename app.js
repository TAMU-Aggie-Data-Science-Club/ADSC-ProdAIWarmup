// Paste your deployed Google Apps Script /exec URL here. Empty = demo mode.
const DATA_ENDPOINT = "https://script.google.com/macros/s/AKfycbwKuQNO8ox7PN27oZwjC6eeA79l8BplfJ5QlTAMA-HmMBk-34-8jc1K6EI1dMT3DVqJ/exec";
const POLL_INTERVAL = 2000; // Wait after each completed request; never overlap requests.
const REQUEST_TIMEOUT = 10000;

import {DEMO,OPTIONS,LABELS,featureVectors,nearest,reasons,project} from './data.js';
import {RoomScene} from './scene.js';
import {fetchSnapshot} from './feed.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PALETTE=['#8b78db','#4e9bd1','#e8a443','#43aa91','#e27a94','#a28abb','#dd7f50','#5bb9bd','#aaac4d','#818eda'];
let people=[],vectors=[],selected=null,colorBy='classification',lastData='',isLive=false,lastGenerated=0;
let targets=new Map(),arrivalTimer,insightIndex=0;
const emptyPanel=$('panel').innerHTML;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function categories(){return colorBy==='major'?[...new Set(people.map(p=>p.major))].sort():[...OPTIONS[colorBy],...(people.some(p=>p[colorBy]==='Not shared')?['Not shared']:[])];}
function color(value){const index=categories().indexOf(value);return value==='Not shared'?'#a5aab4':PALETTE[index]||`hsl(${Math.round(index*137.508)%360} 52% 53%)`}
let scene;
try{scene=new RoomScene($('plot'),{onSelect:select,onHover:showHover,reduced});}
catch(error){$('plot').innerHTML='<div class="webgl-message">3D graphics aren’t available in this browser.<br>You can still search for people and explore their nearest neighbors.</div>';$('rotate').disabled=$('reset').disabled=true;console.warn('3D initialization unavailable',error);}
function showHover(id,x,y){const p=people.find(p=>p.id===id);const tip=$('tooltip');tip.hidden=!p;if(p){tip.textContent=p.name;tip.style.left=`${x}px`;tip.style.top=`${y}px`;}}
function recolor(){
 $('legend').replaceChildren();
 for(const category of categories().filter(category=>people.some(p=>p[colorBy]===category))){const item=document.createElement('span');item.className='legend-item';item.innerHTML=`<span class="swatch" style="background:${color(category)}"></span>${escape(category)}`;$('legend').append(item)}
 scene?.recolor(p=>color(p[colorBy]));if(selected)renderPanel();
}
function select(id,focus=true){
 if(id!==null&&!people.some(p=>p.id===id))return;
 selected=id;$('search-results').hidden=true;$('search').setAttribute('aria-expanded','false');
 scene?.select(id,nearest(people,vectors,id).map(n=>n.person.id),focus);
 renderPanel();
}
function renderPanel(){
 const person=people.find(p=>p.id===selected);
 if(!person){$('panel').innerHTML=emptyPanel;$('explore').disabled=!people.length;$('explore').onclick=()=>select(people[Math.floor(Math.random()*people.length)]?.id);return;}
 const neighbors=nearest(people,vectors,person.id);
 $('panel').innerHTML=`<div class="panel-top"><span>ONE OF US</span><span class="small-spark">✳</span></div><div class="person"><div class="person-header"><div class="avatar" style="background:${color(person[colorBy])}">${escape(person.name.split(/\s+/).map(s=>s[0]).slice(0,2).join(''))}</div><div><h2>${escape(person.name)}</h2><p>${escape(person.classification)} · ${escape(person.major)}</p></div></div><dl>${Object.entries(LABELS).map(([field,label])=>`<div><dt>${label}</dt><dd>${escape(person[field])}</dd></div>`).join('')}</dl><div class="neighbor-heading"><h3>Your nearest neighbors</h3><span>TOP ${neighbors.length}</span></div>${neighbors.length?neighbors.map((n,i)=>`<div class="neighbor"><button data-neighbor="${i}"><span>${escape(n.person.name)}</span><strong>${Math.round(n.score*100)}%</strong></button><p>${escape(reasons(person,n.person).join(' · ')||'Closest available answer vector')}</p></div>`).join(''):'<p class="panel-footnote">You’re first! Your neighbors will appear when others join.</p>'}<button class="clear-button" id="clear">Clear selection</button></div>`;
 $('clear').onclick=()=>select(null);
 $('panel').querySelectorAll('[data-neighbor]').forEach(button=>button.onclick=()=>select(neighbors[Number(button.dataset.neighbor)].person.id));
}
function search(){
 const query=$('search').value.trim().toLocaleLowerCase();const results=$('search-results');results.hidden=false;$('search').setAttribute('aria-expanded','true');results.replaceChildren();
 const matches=people.filter(p=>p.name.toLocaleLowerCase().includes(query));
 if(!matches.length){const p=document.createElement('p');p.textContent=query?'No matches yet. Try a first or last name.':'No attendees yet.';results.append(p)}
 matches.forEach(person=>{const button=document.createElement('button');button.innerHTML=`${escape(person.name)}<small>${escape(person.classification)} · ${escape(person.major)}${people.filter(p=>p.name===person.name).length>1?` · Response ${JSON.parse(person.id)[1]}`:''}</small>`;button.onclick=()=>{$('search').value=person.name;select(person.id);$('search').focus()};results.append(button)});
}
function update(next){
 const fingerprint=JSON.stringify(next);if(fingerprint===lastData)return;
 const oldIds=new Set(people.map(p=>p.id)),wasLoaded=Boolean(lastData);people=next;lastData=fingerprint;
 vectors=featureVectors(people);const positions=project(people,vectors,targets);targets=new Map(people.map((p,i)=>[p.id,positions[i]]));
 scene?.update(people,targets,p=>color(p[colorBy]));
 $('count').textContent=people.length;$('plot-empty').hidden=people.length>0;
 if(!people.some(p=>p.id===selected))selected=null;
 select(selected,false);recolor();renderInsight();
 if(!$('search-results').hidden)search();
 const arrivals=people.filter(p=>!oldIds.has(p.id));
 if(wasLoaded&&arrivals.length){$('arrival').textContent=arrivals.length===1?`Howdy, ${arrivals[0].name.split(' ')[0]}!`:`${arrivals.length} new people. More possibilities.`;$('arrival').hidden=false;clearTimeout(arrivalTimer);arrivalTimer=setTimeout(()=>$('arrival').hidden=true,2800);}
}
function renderInsight(){
 if(!people.length){$('insight').textContent='Every connection starts with a first hello.';return;}
 const common=field=>{const counts=new Map();for(const p of people)if(p[field]!=='Not shared')counts.set(p[field],(counts.get(p[field])||0)+1);return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Not shared'};
 const insights=[`Most common goal: ${common('goal')}`,`Most represented major: ${common('major')}`,`${people.filter(p=>p.activity==='Gamer').length} gamers in the room`,`${Math.round(100*people.filter(p=>['Yes','Maybe'].includes(p.fair)).length/people.length)}% are attending or considering the career fair`];
 $('insight').textContent=insights[insightIndex%insights.length];
}
async function poll(){
 try{
  const snapshot=await fetchSnapshot(DATA_ENDPOINT,{lastGenerated,timeout:REQUEST_TIMEOUT});
  lastGenerated=snapshot.generated;isLive=true;update(snapshot.people);
  $('plot-empty').querySelector('strong').textContent='The room is waiting for you.';
  $('plot-empty').querySelector('p').textContent='Submit the form to add the first dot.';
  $('data-status').textContent='Live data';$('data-status').style.background='#e6f3ed';$('data-status').style.color='#38856c';
  $('sync-time').textContent=`Updated ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;$('warning').hidden=true;
 }catch(error){if(!isLive)update(DEMO());$('warning').textContent=isLive?'Couldn’t refresh the room. Showing the last successful live data; retrying automatically.':'Couldn’t connect to the form yet. Showing demo data; retrying automatically.';$('warning').hidden=false;$('data-status').textContent=isLive?'Live data · offline':'Demo data';$('sync-time').textContent='Connection interrupted';console.warn('Room refresh:',error.message);}
 finally{setTimeout(poll,POLL_INTERVAL);}
}
$('search').addEventListener('input',search);$('search').addEventListener('focus',search);
$('search').addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();$('search-results').querySelector('button')?.focus()}if(event.key==='Enter'){event.preventDefault();$('search-results').querySelector('button')?.click()}});
$('search-results').addEventListener('keydown',event=>{const buttons=[...$('search-results').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();buttons[(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()}});
addEventListener('pointerdown',event=>{if(!event.target.closest('.search-wrap')){$('search-results').hidden=true;$('search').setAttribute('aria-expanded','false')}});
addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('search').focus()}if(event.key==='Escape'){$('search-results').hidden=true;$('search').setAttribute('aria-expanded','false');}});
$('color-by').onchange=()=>{colorBy=$('color-by').value;recolor()};
$('reset').onclick=()=>scene?.reset();
$('rotate').setAttribute('aria-pressed',String(!reduced));$('rotate').textContent=reduced?'▷':'Ⅱ';
$('rotate').onclick=()=>{const rotating=scene?.toggleRotate();$('rotate').setAttribute('aria-pressed',String(rotating));$('rotate').textContent=rotating?'Ⅱ':'▷';$('rotate').title=$('rotate').ariaLabel=rotating?'Pause rotation':'Resume rotation'};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.room').requestFullscreen()}catch{$('fullscreen').title='Fullscreen unavailable; use your browser’s fullscreen command.'}};
if(!document.fullscreenEnabled)$('fullscreen').hidden=true;
if(DATA_ENDPOINT){
 update([]);
 $('data-status').textContent='Connecting…';
 $('sync-time').textContent='Fetching form responses';
 $('plot-empty').querySelector('strong').textContent='Connecting to the room…';
 $('plot-empty').querySelector('p').textContent='Fetching the latest form responses.';
 poll();
}else{
 update(DEMO());
 $('data-status').textContent='Demo data';
 $('sync-time').textContent='Make yourself at home.';
}
setInterval(()=>{insightIndex++;renderInsight()},9000);
// Optional progressive enhancement: the same selection action, exposed to supported agents.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'select_attendee',description:'Select an attendee by exact name and display their original-vector nearest neighbors. Duplicate names require an occurrence number.',inputSchema:{type:'object',properties:{name:{type:'string'},occurrence:{type:'integer',minimum:1}},required:['name'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input.name!=='string'||(input.occurrence!==undefined&&(!Number.isInteger(input.occurrence)||input.occurrence<1)))throw new Error('Provide a name and optional positive occurrence number.');const matches=people.filter(p=>p.name.toLowerCase()===input.name.toLowerCase());if(matches.length>1&&!input.occurrence)throw new Error('Multiple attendees have this name. Specify occurrence.');const p=matches[(input.occurrence||1)-1];if(!p)throw new Error('Attendee not found.');select(p.id);return {selected:p.name,neighbors:nearest(people,vectors,p.id).map(n=>({name:n.person.name,similarity:Math.round(n.score*100)}))};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
