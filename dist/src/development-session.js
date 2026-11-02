// Development builds deliberately discard ONLY this application's known test
// storage families. Never inspect values, clear the whole origin or guess at
// another application's namespaces. This runs before any live model is created.
export const SPACE_TEST_STORAGE_FAMILIES=Object.freeze(['space-project:industry','space-project:surface','space-project:administration']);
export const isSpaceProjectTestKey=key=>typeof key==='string'&&SPACE_TEST_STORAGE_FAMILIES.some(prefix=>key===prefix||key.startsWith(prefix+':'));
export function resetDevelopmentStorage(getStorage){
 const result={available:false,removed:[],failed:[]};let storage;
 try{storage=getStorage();if(!storage)return result;const keys=[];for(let i=0,n=storage.length;i<n;i++){const key=storage.key(i);if(isSpaceProjectTestKey(key))keys.push(key);}result.available=true;
  // Collect first: removal changes the index of subsequent Storage keys.
  for(const key of keys){try{storage.removeItem(key);result.removed.push(key);}catch{result.failed.push(key);}}
 }catch{/* Blocked storage never prevents a fresh in-memory game. */}
 return result;
}
