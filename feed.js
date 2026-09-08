import {parsePayload} from './data.js';
// Validate a complete snapshot before the caller replaces any existing room state.
export async function fetchSnapshot(endpoint,{fetcher=fetch,now=Date.now(),lastGenerated=0,timeout=10000}={}){
 const url=new URL(endpoint);if(url.protocol!=='https:')throw new Error('Use an HTTPS web app URL.');
 const response=await fetcher(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw new Error(`Endpoint returned ${response.status}`);
 const payload=await response.json();
 let generated=lastGenerated;
 if(payload?.generatedAt!==undefined){generated=Date.parse(payload.generatedAt);if(!Number.isFinite(generated)||now-generated>120000||generated>now+120000||generated<lastGenerated)throw new Error('Endpoint returned an outdated response.');}
 return {people:parsePayload(payload),generated};
}
