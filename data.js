// All data crossing into the app is reduced to these eight fields.
export const OPTIONS = {
 classification:['Freshman','Sophomore','Junior','Senior','Masters','PhD'],
 work:['I like to talk ideas out loud','I like structure + splitting tasks','I prefer to listen first, then contribute','I’m flexible'],
 comfort:['New to this','Some familiarity','Comfortable','Very Comfortable'],
 activity:['Coffee / boba person','Gym / sports person','Gamer','Music/Concerts','Movies / shows','Outdoors','Foodie / cooking'],
 fair:['Yes','Maybe','No'], goal:['Learn','Research','Internship','Startup','Build projects','Just curious']
};
export const LABELS={classification:'Classification',major:'Major',work:'Work style',comfort:'AI comfort',activity:'Favorite activity',fair:'Career fair',goal:'Goal'};
export const WEIGHTS={classification:0.5,major:1,work:1.2,comfort:0.8,activity:1,fair:0.5,goal:1.4};
export const HEADERS={name:"What's your full name?",classification:"What's your classification?",major:"What's your major? (4 letter code, CSCE, DAEN, STAT, etc.)",work:'How do you like to work?',comfort:'Self-rating: comfort with the topic today (Pick 1)',activity:'Pick your favorite activity out of this list',fair:'Are you going to the SEC Career Fair?',goal:"What's your goal right now?"};
export const keyOf = value => String(value??'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]/g,'');
export function fieldFor(header){
 const key=keyOf(header);
 for(const [field,exact] of Object.entries(HEADERS)) if(key===keyOf(exact))return field;
 const aliases={name:['name','fullname','whatsyourname'],classification:['classification','class','year','classyear'],major:['major','whatsyourmajor'],work:['work','workstyle','workingstyle'],comfort:['comfort','aicomfort','topiccomfort','selfrating'],activity:['activity','favoriteactivity','favouriteactivity','interest'],fair:['fair','careerfair','seccareerfair'],goal:['goal','currentgoal']};
 return Object.keys(aliases).find(field=>aliases[field].includes(key));
}
export function normalizePerson(raw){
 const person={};
 for(const [header,value] of Object.entries(raw)){
  const field=fieldFor(header);
  if(field && ['string','number'].includes(typeof value))person[field]=String(value).trim().slice(0,160);
 }
 if(!person.name)return null;
 person.major=(person.major||'Not shared').toUpperCase();
 if(person.major==='NOT SHARED')person.major='Not shared';
 for(const [field,options] of Object.entries(OPTIONS))person[field]=options.find(option=>keyOf(option)===keyOf(person[field]))||'Not shared';
 return person;
}
export function parsePayload(payload){
 if(payload?.error)throw new Error('The sheet endpoint returned an error.');
 const headers=payload?.headers;
 const source=Array.isArray(payload)?payload:payload?.rows??payload?.data??payload?.responses;
 if(!Array.isArray(source))throw new Error('Expected a list of form responses.');
 if(headers!==undefined && (!Array.isArray(headers)||headers.some(h=>typeof h!=='string')))throw new Error('Invalid sheet headers.');
 if(Array.isArray(headers) && !headers.some(h=>fieldFor(h)==='name'))throw new Error('The full name column was not found.');
 const counts=new Map();
 const people=source.flatMap(row=>{
  if(!row || typeof row!=='object')return [];
  if(Array.isArray(row) && !headers)return [];
  const raw=Array.isArray(row)?Object.fromEntries(headers.map((h,i)=>[h,row[i]])):row;
  const person=normalizePerson(raw);if(!person)return [];
  // Name + occurrence remains stable for normal append-only Google Form rows.
  // Duplicate names get independent nodes; never key the scene by name alone.
  const base=person.name.toLocaleLowerCase();const occurrence=(counts.get(base)||0)+1;counts.set(base,occurrence);
  return [{...person,id:JSON.stringify([base,occurrence])}];
 });
 if(source.length && !people.length && source.some(row=>row && typeof row==='object' && Object.values(row).some(v=>v!==''&&v!=null)))throw new Error('No readable attendee responses were found.');
 return people;
}
export const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const unit=a=>{const norm=Math.hypot(...a);return a.map(x=>norm?x/norm:0)};
export function featureVectors(people){
 const majors=[...new Set(people.map(p=>p.major).filter(v=>v!=='Not shared'))].sort();
 return people.map(person=>{
  const vector=[];
  for(const [field,weight] of Object.entries(WEIGHTS)){
   const value=person[field];let block;
   if(['classification','comfort','fair'].includes(field)){
    const v=field==='fair'?({Yes:1,Maybe:.5,No:0}[value]):OPTIONS[field].indexOf(value)/(OPTIONS[field].length-1);
    // Paired ordinal encoding preserves closeness at BOTH ends (including zero).
    // Missing answers contribute zero; observed groups all have equal norm.
    block=value==='Not shared'?[0,0]:unit([1-v,v]);
   }else block=(field==='major'?majors:OPTIONS[field]).map(option=>Number(option===value));
   // sqrt(weight) makes each group's dot-product contribution equal its weight.
   vector.push(...block.map(x=>x*Math.sqrt(weight)));
  }
  return unit(vector);
 });
}
export function nearest(people,vectors,id){
 const index=people.findIndex(p=>p.id===id);if(index<0)return [];
 return people.flatMap((person,i)=>i===index?[]:[{person,score:Math.max(0,Math.min(1,dot(vectors[index],vectors[i])))}]).sort((a,b)=>b.score-a.score||a.person.id.localeCompare(b.person.id)).slice(0,3);
}
export function reasons(a,b){
 const result=[];
 if(a.goal===b.goal&&a.goal!=='Not shared')result.push(`Same goal: ${a.goal}`);
 if(a.activity===b.activity&&a.activity!=='Not shared')result.push(a.activity==='Gamer'?'Both gamers':`Both enjoy ${a.activity.replace(' person','').toLowerCase()}`);
 if(a.major===b.major&&a.major!=='Not shared')result.push(`Both in ${a.major}`);
 if(a.work===b.work&&a.work!=='Not shared')result.push('Same work style');
 if(a.comfort!=='Not shared'&&b.comfort!=='Not shared'&&Math.abs(OPTIONS.comfort.indexOf(a.comfort)-OPTIONS.comfort.indexOf(b.comfort))<=1)result.push('Similar AI comfort');
 return result.slice(0,2);
}
// Symmetric Jacobi eigensolver: deterministic PCA, no math/CDN dependency.
// Center, but do not z-score: z-scoring would undo group weights and amplify rare majors.
export function pca(matrix){
 if(!matrix.length)return [];
 const n=matrix.length,d=matrix[0].length;
 const mean=Array.from({length:d},(_,j)=>matrix.reduce((s,row)=>s+row[j],0)/n);
 const centered=matrix.map(row=>row.map((v,j)=>v-mean[j]));
 const cov=Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>centered.reduce((s,row)=>s+row[i]*row[j],0)/Math.max(1,n-1)));
 const basis=Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>Number(i===j)));
 for(let iter=0;iter<d*d*30;iter++){
  let a=0,b=1,max=0;
  for(let i=0;i<d;i++)for(let j=i+1;j<d;j++)if(Math.abs(cov[i][j])>max){max=Math.abs(cov[i][j]);a=i;b=j}
  if(max<1e-11)break;
  const angle=.5*Math.atan2(2*cov[a][b],cov[b][b]-cov[a][a]),c=Math.cos(angle),s=Math.sin(angle);
  const aa=cov[a][a],bb=cov[b][b],ab=cov[a][b];
  for(let k=0;k<d;k++)if(k!==a&&k!==b){const ka=cov[k][a],kb=cov[k][b];cov[k][a]=cov[a][k]=c*ka-s*kb;cov[k][b]=cov[b][k]=s*ka+c*kb}
  cov[a][a]=c*c*aa-2*s*c*ab+s*s*bb;cov[b][b]=s*s*aa+2*s*c*ab+c*c*bb;cov[a][b]=cov[b][a]=0;
  for(let k=0;k<d;k++){const ka=basis[k][a],kb=basis[k][b];basis[k][a]=c*ka-s*kb;basis[k][b]=s*ka+c*kb}
 }
 const axes=Array.from({length:d},(_,i)=>i).sort((a,b)=>cov[b][b]-cov[a][a]).slice(0,3);
 return centered.map(row=>Array.from({length:3},(_,k)=>axes[k]===undefined?0:row.reduce((s,x,j)=>s+x*basis[j][axes[k]],0)));
}
export function project(people,vectors,previous=new Map()){
 let coords=pca(vectors);if(!coords.length)return [];
 // Resolve PCA sign flips and axis swaps against existing attendees, before tweening.
 const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
 const scale=4.1/Math.max(.1,...coords.map(v=>Math.hypot(...v)));
 coords=coords.map(v=>v.map(x=>x*scale));
 let best=coords,bestError=Infinity;
 if(previous.size)for(const perm of permutations)for(let mask=0;mask<8;mask++){
  const trial=coords.map(v=>perm.map((axis,k)=>v[axis]*(mask&(1<<k)?-1:1)));
  const error=people.reduce((sum,p,i)=>sum+(previous.has(p.id)?trial[i].reduce((s,x,k)=>s+(x-previous.get(p.id)[k])**2,0):0),0);
  if(error<bestError){bestError=error;best=trial}
 }
 return best.map((v,i)=>{
  const overlaps=best.map((p,j)=>({p,j})).filter(({p})=>Math.hypot(...p.map((x,k)=>x-v[k]))<.08);
  if(overlaps.length<2)return v;
  const rank=overlaps.findIndex(({j})=>j===i),angle=rank*2.39996323,z=1-2*(rank+.5)/overlaps.length,r=.18*Math.cbrt(overlaps.length);
  return [v[0]+r*Math.sqrt(1-z*z)*Math.cos(angle),v[1]+r*Math.sqrt(1-z*z)*Math.sin(angle),v[2]+r*z];
 });
}
const seeds=[
 ['Maya Patel',1,'CSCE',0,1,2,0,2],['Ethan Williams',2,'DAEN',0,2,2,0,2],['Sofia Rodriguez',0,'STAT',2,0,0,1,0],['Alex Chen',1,'CSCE',0,1,2,0,4],['Jordan Brooks',3,'MEEN',1,1,1,0,2],['Aisha Ahmed',2,'STAT',2,2,3,1,1],['Noah Thompson',0,'CSCE',3,0,2,1,0],['Isabella Garcia',1,'DAEN',0,1,0,0,2],['Liam O’Connor',3,'ECEN',1,3,5,0,4],['Priya Shah',4,'CSCE',2,3,0,2,1],['Marcus Johnson',2,'ISEN',3,1,1,0,2],['Emma Wilson',0,'MATH',2,0,4,1,5],['Daniel Kim',1,'CSCE',1,2,2,0,4],['Fatima Hassan',4,'STAT',2,3,3,2,1],['Oliver Davis',2,'BUAD',0,1,6,0,3],['Chloe Nguyen',1,'DAEN',1,1,0,0,2],['Mateo Martinez',0,'ECEN',3,0,1,1,0],['Zara Ali',3,'CSCE',0,2,3,0,3],['Ben Anderson',2,'MEEN',1,1,5,1,4],['Grace Park',5,'STAT',2,3,4,2,1],['Amara Okafor',0,'DAEN',3,0,6,1,5],['Lucas Wright',1,'MATH',3,1,2,0,0],['Valentina Rossi',3,'ISEN',1,2,6,0,2],['Arjun Mehta',4,'ECEN',2,3,5,1,1]
];
export const DEMO=()=>parsePayload(seeds.map(([name,c,major,w,t,a,f,g])=>({name,classification:OPTIONS.classification[c],major,work:OPTIONS.work[w],comfort:OPTIONS.comfort[t],activity:OPTIONS.activity[a],fair:OPTIONS.fair[f],goal:OPTIONS.goal[g]})));
