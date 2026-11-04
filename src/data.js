const KEY='gold-standard-platform-v1';
const empty={customers:[],sites:[],assets:[],jobs:[],inspections:[],inventory:[],deficiencies:[],quotes:[]};
export function loadData(){try{return {...empty,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return empty}}
export function saveData(data){localStorage.setItem(KEY,JSON.stringify(data))}
export function uid(prefix='GS'){return prefix+'-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()}
export function exportData(data){const blob=new Blob([JSON.stringify({app:'Gold Standard',version:1,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='gold-standard-backup.json';a.click();URL.revokeObjectURL(url)}
export function importData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(x.app!=='Gold Standard'||!x.data)throw Error('Unsupported backup');resolve({...empty,...x.data})}catch(e){reject(e)}};r.onerror=reject;r.readAsText(file)})}