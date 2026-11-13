/* Local, deterministic assistance. No AI, network requests or background record writes. */
(() => {
 'use strict';
 const values=o=>Object.values(o||{}).filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
 const arr=x=>Array.isArray(x)?x:[];
 const office=()=>currentRole()!=='tech';
 const ownTech=()=>window.GSBackend?.membership?.tech_id||myId();
 const accessible=j=>!!j&&(office()||!!ownTech()&&onJob(j,ownTech()));
 const jobs=()=>values(S.jobs).filter(accessible);
 const unitName=u=>u?.tag?'Unit '+u.tag:u?.location||u?.id||'Equipment';
 const resolved=d=>['resolved','fixed'].includes(d.status);
 const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const txt=x=>String(x??'');
 const empty=()=>({jobId:'',mode:'handoff',draft:'',stamp:'',category:'all',query:'',limit:60});
 let identity='', state=empty(), storageOK=true;
 function saveDraft(){try{sessionStorage.setItem('gs-smart:'+identity,JSON.stringify(state));storageOK=true;}catch(_){if(storageOK)toast('This browser could not retain the draft. Copy it before refreshing.');storageOK=false;}}
 function context(){return [window.GS_CONFIG?.supabaseUrl,window.GSBackend?.companyId,window.GSBackend?.user?.id,currentRole(),ownTech()].join('|');}
 function ensure(){if(identity!==context()){identity=context();state=empty();try{const saved=JSON.parse(sessionStorage.getItem('gs-smart:'+identity)||'null');if(saved)for(const k of ['jobId','mode','draft','stamp','category','query'])if(typeof saved[k]==='string')state[k]=saved[k];}catch(_){}if(!['handoff','prep','customer','repair','office'].includes(state.mode)||!office()&&state.mode==='office')state.mode='handoff';}if(state.jobId&&S.jobs[state.jobId]&&!accessible(S.jobs[state.jobId])){state.jobId='';state.draft='';}}
 function checks(j){
  if(!accessible(j))return [];
  const out=[];const add=(code,detail)=>out.push({code,detail});
  const ids=arr(j.unitIds),us=ids.map(id=>S.units[id]).filter(Boolean);
  if(!ids.length)add('equipment','No equipment is attached to this job.');
  if(new Set(ids).size!==ids.length)add('duplicate-unit','The equipment list contains duplicate record IDs.');
  for(const id of new Set(ids))if(!S.units[id])add('missing-unit','An equipment record is missing: '+id);
  if(!S.customers[j.customerId])add('customer','The customer record is missing.');
  if(!S.sites[j.siteId])add('site','The site record is missing.');
  else if(S.sites[j.siteId].customerId!==j.customerId)add('customer-site','The selected site belongs to a different customer record.');
  for(const u of us){
   const label=unitName(u),r=j.results?.[u.id];
   if(u.siteId!==j.siteId)add('unit-site',label+': equipment belongs to a different site record.');
   if(u.retired)add('retired',label+': retired equipment is still on this job; verify it is intentional.');
   if(routeNeedsInspection(j,u.id))add('answers',label+': inspection answers are incomplete.');
   if(r?.outcome==='fail'&&u.kind==='ext'&&!isMonthly(j)&&!arr(r.reasons).length)add('reason',label+': a failure reason is not recorded.');
   const defs=arr(j.deficiencies).filter(d=>d.unitId===u.id);
   if(r?.outcome==='fail'&&!defs.length)add('deficiency',label+': failed result has no deficiency record yet.');
   if(r?.corrected&&defs.some(d=>!resolved(d)))add('correction',label+': marked corrected while a deficiency is still unresolved.');
   if(r?.outcome==='pass'&&Object.values(r.checks||{}).includes('fail'))add('conflict',label+': recorded outcome is Pass but a checklist answer is Fail. Review the existing inspection result.');
  }
  missingPhotos(j).forEach(p=>add('photos',unitName(p.u)+': missing '+p.label+' evidence.'));
  arr(j.deficiencies).filter(resolved).forEach(d=>{
   if(!txt(d.resolution||d.action).trim())add('repair-note','Resolved finding has no corrective-work description: '+txt(d.desc||d.id));
   if(d.checkKey&&!arr(d.afterPhotos).length)add('repair-photo','Resolved checklist finding has no after-photo recorded: '+txt(d.desc||d.id)+'. Review evidence; this is not an additional completion requirement.');
  });
  if(!j.signature&&!j.noSignature)add('signature','No saved signature or customer-unavailable acknowledgment yet.');
  if(j.signature&&!txt(j.signerName).trim())add('signer','A signature is saved without a signer name.');
  return out;
 }
 function reviewItems(){
  const out=[];const add=(category,key,title,detail,action,a,b='',rank=2)=>out.push({category,key,title:txt(title||'Unnamed record'),detail:txt(detail),action,a,b,rank});
  const list=jobs(),today=todayISO();
  for(const j of list){
   if(j.status==='cancelled')continue;
   const title=txt(j.number||'Job')+' · '+txt(cust(j.customerId)?.name||'Missing customer');
   try{
    if(['onsite','paused','completed','invoiced'].includes(j.status)){
     const gaps=checks(j);if(gaps.length)add('inspection','check:'+j.id,title,gaps.length+' paperwork/evidence item(s) to review. '+gaps[0].detail,'check',j.id,'',1);
    }
    const open=arr(j.deficiencies).filter(d=>!resolved(d));
    if(open.length)add('repairs','def:'+j.id,title,open.length+' unresolved finding(s); '+open.filter(d=>d.status==='open').length+' marked open. Existing quote/scheduling statuses are preserved.','job',j.id,'',open.some(d=>d.severity==='critical')?0:2);
    if(office()&&can('schedule')&&!isDone(j)){
     if(!jobTechs(j).some(id=>S.techs[id]))add('schedule','crew:'+j.id,title,'No valid technician is assigned.','job',j.id);
     if(!dateOK(j.date))add('schedule','date:'+j.id,title,'A valid scheduled date is missing.','job',j.id);
     else if(j.date<today)add('schedule','overdue:'+j.id,title,'Scheduled date '+j.date+' is past and the job is not completed.','job',j.id,'',1);
    }
    if(office()&&can('billingDocs')&&j.status==='completed'&&!values(S.invoices).some(i=>i.jobId===j.id&&i.status!=='void'))add('billing','invoice:'+j.id,title,'Completed job has no non-void invoice. Review the job in the existing invoice workflow.','job',j.id);
   }catch(_){add('records','invalid:'+j.id,title,'This record could not be fully checked. Open it and review its saved data.','job',j.id,'',0);}
  }
  if(office()){
   if(can('schedule')){
    const slots=new Map();for(const j of list.filter(j=>!isDone(j)&&j.status!=='cancelled'&&dateOK(j.date)&&j.date>=today&&/^([01]\d|2[0-3]):[0-5]\d$/.test(j.time||''))){for(const id of new Set(jobTechs(j))){const k=[j.date,j.time,id].join('|');const others=slots.get(k)||[];others.push(j);slots.set(k,others);}}
    for(const [key,group] of slots)if(group.length>1)add('schedule','slot:'+key,'Same-time assignments',group.map(j=>j.number||j.id).join(', ')+' share a technician and exact start time. Check availability; duration/travel overlaps are not calculated.','schedule','','',1);
    for(const s of values(S.sites))try{const d=siteDueSummary(s.id);if((d.overdue||d.soon)&&!openJobForSite(s.id))add('service','due:'+s.id,cust(s.customerId)?.name||s.name,d.overdue+' overdue and '+d.soon+' due-soon equipment record(s), with no open job for this site. Based on your configured service intervals.','customer',s.customerId);}catch(_){add('records','site:'+s.id,s.name||'Site','Service dates could not be checked. Review equipment history.','customer',s.customerId);}
   }
   if(can('billingDocs'))for(const [col,docs] of [['quotes',values(S.quotes)],['invoices',values(S.invoices)]])for(const d of docs){
    const title=txt(d.number||'Document')+' · '+txt(cust(d.customerId)?.name||'Missing customer');
    if(d.status==='draft')add('billing',col+':draft:'+d.id,title,'Draft is awaiting review; it has not been automatically sent.','doc',col,d.id);
    if(col==='quotes'&&d.status==='approved'&&(!d.repairJobId||!S.jobs[d.repairJobId]))add('billing','approved:'+d.id,title,'Approved quote has no linked repair job on this device. Check before creating another job.','doc',col,d.id,1);
    if(col==='quotes'&&d.status==='sent'&&dateOK(d.validUntil)&&d.validUntil<today)add('billing','expired:'+d.id,title,'Quote validity date has passed. Review before following up.','doc',col,d.id);
    if(col==='invoices'&&d.status==='sent'&&dateOK(d.dueDate)&&d.dueDate<today){const pending=invPayments(d).some(p=>p.status==='pending');add('billing','late:'+d.id,title,pending?'Past due date with an unconfirmed payment. Verify payment before contacting the customer.':'Past due date and still marked sent. Verify payment records before following up.','doc',col,d.id,1);}
   }
   if(can('fieldAddUnits')){
    const serials=new Map();for(const u of values(S.units).filter(u=>!u.retired)){
     const serial=txt(u.serial).trim().toUpperCase(),mfr=txt(u.mfr).trim().toUpperCase();
     if(serial&&mfr&&!['UNKNOWN','N/A','NA','NONE','0','-'].includes(serial)){const k=mfr+'|'+serial;const group=serials.get(k)||[];group.push(u);serials.set(k,group);}
    }
    for(const [key,group] of serials)if(group.length>1)add('records','serial:'+key,'Possible duplicate equipment',group.length+' active records share manufacturer and serial '+txt(group[0].serial)+'. Review; no records will be merged automatically.','customer',S.sites[group[0].siteId]?.customerId||'');
   }
  }
  return out.sort((a,b)=>a.rank-b.rank||a.title.localeCompare(b.title)||a.key.localeCompare(b.key));
 }
 function fingerprint(j){return JSON.stringify([j,arr(j?.unitIds).map(id=>S.units[id]),S.sites[j?.siteId],S.customers[j?.customerId]]);}
 function draft(j,mode){
  if(mode==='office'){
   if(!office())return '';
   const list=reviewItems(),cats=[['inspection','Inspection paperwork'],['repairs','Unresolved findings'],['schedule','Scheduling'],['service','Due-service follow-up'],['billing','Billing follow-up'],['records','Record integrity']];
   return 'OFFICE BRIEFING — '+todayISO()+'\nBased on records currently available on this device.\n\n'+cats.map(([k,l])=>l+': '+list.filter(x=>x.category===k).length+' review item(s)').join('\n')+'\n\n'+list.slice(0,30).map(x=>'• '+x.title+': '+x.detail).join('\n')+(list.length>30?'\nShowing the first 30 items; open Smart assistance for the full list.':'')+'\n\nReview current records before acting. No records were changed or messages sent.';
  }
  if(!accessible(j))return '';
  const s=site(j.siteId),c=cust(j.customerId),units=jobUnits(j),defs=arr(j.deficiencies);
  const lines=['Job '+txt(j.number||j.id)+' · '+txt(c?.name||'Customer not recorded'),'Site: '+txt(s?.name||'Not recorded'),'Recorded job status: '+txt(JOB_STATUS[j.status]?.[0]||j.status)];
  if(mode==='prep'){
   lines.push('Scheduled: '+(dateOK(j.date)?j.date:'Not recorded')+(j.time?' at '+j.time:''),'Address: '+txt(s?.address||'Not recorded'),'Access notes: '+txt(s?.access||'Not recorded'),'Assigned crew: '+(crewNames(j)||'Not recorded'),'Equipment records: '+units.length,'Office job notes: '+txt(j.notes||'None recorded'));
   const history=siteHistory(j.siteId,j.id).filter(accessible).slice(0,3);lines.push('\nRecent accessible completed visits:',...history.map(x=>txt(x.number)+' · '+txt(dayOf(x.completedAt)||x.date)+' · '+txt(typeOf(x))));if(!history.length)lines.push('No prior completed visits available for your account on this device.');
  }else if(mode==='repair'){
   lines.push('\nREPAIR SCOPE DRAFT — no price or compatibility assumptions');const open=defs.filter(d=>!resolved(d));
   if(!open.length)lines.push('No unresolved deficiencies are recorded for this job.');
   open.forEach(d=>lines.push('• '+unitName(S.units[d.unitId])+': '+txt(d.desc||'Description missing'),'  Recorded status: '+txt(d.status||'Not recorded'),'  Recorded corrective action: '+txt(d.action||'Not recorded — technician/office must specify.')));
   lines.push('\nVerify scope, parts compatibility, quantities and prices in the existing quote workflow.');
  }else{
   if(mode==='customer')lines.unshift('CUSTOMER UPDATE DRAFT — review before sharing\n');else lines.unshift('INSPECTION HANDOFF — recorded facts\n');
   lines.push('\nEquipment results:');
   for(const u of units){const r=j.results?.[u.id];const outcome=finalInspectionOutcome(r,j,u.id);lines.push('• '+unitName(u)+': '+(routeNeedsInspection(j,u.id)?'Incomplete':outcome==='pass'?'Pass recorded':outcome==='fail'?'Fail recorded':outcome==='na'?'N/A recorded':'Incomplete')+(r?.outcome==='fail'&&outcome==='pass'?' (original failure retained; correction recorded)':''));if(r?.notes)lines.push('  Recorded notes: '+r.notes);}
   if(!units.length)lines.push('No equipment records attached.');
   lines.push('\nFindings:');if(!defs.length)lines.push('No deficiency records entered. This does not certify that no deficiencies exist.');
   defs.forEach(d=>{lines.push('• '+txt(d.desc||'Description missing')+' — '+txt(d.status||'Status not recorded'));if(d.resolution)lines.push('  Recorded resolution: '+d.resolution);});
   if(mode==='handoff'){const gaps=checks(j);lines.push('\nPaperwork review:',...(gaps.length?gaps.map(g=>'• '+g.detail):['No gaps detected by these checks.']));}
  }
  lines.push('\nPrepared from saved records on this device. Verify accuracy before use. This summary does not certify equipment safety or change the inspection result.');return lines.join('\n');
 }
 const labels={all:'All',inspection:'Inspection',repairs:'Repairs',schedule:'Schedule',service:'Due service',billing:'Office',records:'Records'};
 function status(){return navigator.onLine?'Works on this device · no AI service or per-request charges. Shared updates follow the normal sync status.':'Offline · Smart assistance remains available using this device’s saved records. Shared updates and online services need a restored connection.';}
 function view(){
  ensure();const all=reviewItems(),query=state.query.trim().toLowerCase();const filtered=all.filter(x=>(state.category==='all'||x.category===state.category)&&(!query||(x.title+' '+x.detail).toLowerCase().includes(query)));
  const selected=jobs().find(j=>j.id===state.jobId);const stale=state.draft&&state.mode!=='office'&&selected&&state.stamp!==fingerprint(selected);
  const modes=[['handoff','Inspection handoff'],['prep','Visit preparation'],['customer','Customer update'],['repair','Repair scope'],...(office()?[['office','Office briefing']]:[])];
  return `${pageHead('Smart assistance','Automatic checks and factual drafts from your existing records.')}<section class="panel panel-b gs-smart"><p id="gs-smart-status" role="status">${esc(status())}</p><p class="small muted">Checks are advisory. Your approved inspection, repair, quote, invoice and scheduling workflows stay in control. Missing information is flagged rather than guessed.</p><div class="row"><button class="btn" data-smart="refresh">Refresh checks</button><button class="btn" data-act="go" data-a="${UI.mode==='field'?'field-guide':'guides'}">Search existing guides</button></div><div class="gs-smart-grid"><label class="fld"><span>Filter review items</span><select id="gs-smart-category" class="in">${Object.entries(labels).filter(([k])=>k==='all'||k===state.category||all.some(x=>x.category===k)).map(([k,l])=>opt(k,l+' ('+(k==='all'?all.length:all.filter(x=>x.category===k).length)+')',state.category)).join('')}</select></label><label class="fld"><span>Find a job, customer or issue</span><input id="gs-smart-query" class="in" value="${esc(state.query)}" maxlength="200" placeholder="Search review items"></label></div><p class="small" role="status">${filtered.length} review item(s) · ${Math.min(filtered.length,state.limit)} shown</p><div class="gs-smart-list">${filtered.slice(0,state.limit).map(x=>`<article class="gs-smart-item"><div><span class="pill">${esc(labels[x.category])}</span><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p></div><button class="btn" data-smart="item" data-key="${esc(x.key)}">${x.action==='check'?'Review checks':'Open existing record'}</button></article>`).join('')||'<p>No matching review items. This is not a safety or compliance certification.</p>'}</div>${filtered.length>state.limit?'<button class="btn" data-smart="more">Show more</button>':''}</section><section class="panel panel-b gs-smart" id="gs-smart-drafts"><h2>Prepare a factual draft</h2><div class="gs-smart-grid"><label class="fld"><span>Job</span><select id="gs-smart-job" class="in"><option value="">Select a job</option>${state.jobId&&!selected?opt(state.jobId,'Saved job not available yet',state.jobId):''}${jobs().map(j=>opt(j.id,txt(j.number)+' · '+txt(cust(j.customerId)?.name||'Customer'),state.jobId)).join('')}</select></label><label class="fld"><span>Draft type</span><select id="gs-smart-mode" class="in">${modes.map(([k,l])=>opt(k,l,state.mode)).join('')}</select></label></div><div class="row"><button class="btn primary" data-smart="draft" ${!selected&&state.mode!=='office'?'disabled':''}>Prepare draft · works offline</button><button class="btn" data-smart="check" ${!selected?'disabled':''}>Check selected inspection</button></div>${stale?'<p class="banner" role="alert">The saved record changed after this draft was prepared. Regenerate and review it before use.</p>':''}<label class="fld"><span>Review and edit before use</span><textarea id="gs-smart-draft" class="in" rows="12">${esc(state.draft)}</textarea></label><div class="row"><button class="btn" data-smart="copy" ${!state.draft?'disabled':''}>Copy draft</button><button class="btn" data-smart="clear">Clear draft</button>${selected&&state.mode==='handoff'&&state.draft&&!isLocked(selected)?'<label class="gs-smart-review"><input type="checkbox" id="gs-smart-reviewed"> I reviewed this handoff</label><button class="btn" data-smart="append">Append to technician notes</button>':''}</div><p class="small muted">Nothing is sent, scheduled, invoiced or marked passed by these tools. ${storageOK?'Draft text is retained in this browser tab across refreshes, separately for each account. Closing the tab may clear it.':'This browser could not retain the draft. Copy it before refreshing or closing this tab.'}</p></section>`;
 }
 function refresh(){if(['smart-assist','field-assist'].includes(UI.view)){document.activeElement?.blur();render();}}
 VIEWS['smart-assist']=view;VIEWS['field-assist']=view;
 OFFICE_VIEWS.push(['smart-assist','Smart assistance','fact_check']);FIELD_VIEWS.push(['field-assist','Assist','fact_check']);VALID.add('smart-assist');VALID.add('field-assist');
 const oldField=fieldWork;fieldWork=function(j){return oldField(j)+`<section class="panel panel-b"><button class="btn" data-smart="job" data-job="${esc(j.id)}">Check paperwork & prepare handoff</button><p class="small muted">Works offline · review only · existing completion rules apply.</p></section>`;};
 const oldToday=VIEWS.today;VIEWS.today=()=>oldToday()+`<section class="panel panel-b"><h2>Smart assistance</h2><p>Review inspection gaps, scheduling conflicts and office follow-ups together. No AI service required.</p><button class="btn" data-act="go" data-a="smart-assist">Open automatic checks</button></section>`;
 function openJob(j){if(!accessible(j))return;if(currentRole()==='tech')A.work(j.id);else A.openJob(j.id);}
 document.addEventListener('change',e=>{if(!['gs-smart-category','gs-smart-job','gs-smart-mode'].includes(e.target.id))return;ensure();if(e.target.id==='gs-smart-category'){state.category=e.target.value;state.limit=60;}if(e.target.id==='gs-smart-job'){state.jobId=e.target.value;state.draft='';}if(e.target.id==='gs-smart-mode'){state.mode=e.target.value;state.draft='';}saveDraft();refresh();});
 let queryTimer;
 document.addEventListener('input',e=>{if(e.target.id==='gs-smart-draft'){state.draft=e.target.value;const review=document.getElementById('gs-smart-reviewed');if(review)review.checked=false;saveDraft();}if(e.target.id==='gs-smart-query'){state.query=e.target.value;state.limit=60;saveDraft();clearTimeout(queryTimer);queryTimer=setTimeout(()=>{if(!['smart-assist','field-assist'].includes(UI.view))return;const pos=document.getElementById('gs-smart-query')?.selectionStart;refresh();const q=document.getElementById('gs-smart-query');if(q){q.focus();q.setSelectionRange(pos,pos);}},350);}});
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-smart]');if(!b)return;ensure();try{const selected=S.jobs[state.jobId];
  if(b.dataset.smart==='refresh'){dropIdx();refresh();}
  if(b.dataset.smart==='more'){state.limit+=60;refresh();}
  if(b.dataset.smart==='job'){if(!accessible(S.jobs[b.dataset.job]))return;state.jobId=b.dataset.job;state.draft='';go(UI.mode==='field'?'field-assist':'smart-assist');}
  if(b.dataset.smart==='draft'){state.draft=draft(selected,state.mode);state.stamp=fingerprint(selected);refresh();}
  if(b.dataset.smart==='check'){if(!accessible(selected))return;state.mode='handoff';state.draft='PAPERWORK CHECK — '+txt(selected.number)+'\n'+checks(selected).map(x=>'• '+x.detail).join('\n')+'\n\nSaved records only; unsaved form/signature entries are not included. This is not a safety determination.';state.stamp=fingerprint(selected);refresh();}
  if(b.dataset.smart==='clear'){state.draft='';refresh();}
  if(b.dataset.smart==='copy'){try{await navigator.clipboard.writeText(state.draft);toast('Draft copied. Review before sharing.');}catch(_){const text=document.getElementById('gs-smart-draft');text?.focus();text?.select();toast('Draft selected. Use your device’s Copy command.');}}
  if(b.dataset.smart==='append'){
   if(!accessible(selected)||isLocked(selected)||state.mode!=='handoff'||!state.draft.trim())return;
   if(!document.getElementById('gs-smart-reviewed')?.checked)return toast('Review this handoff and tick the confirmation first.');
   if(state.stamp!==fingerprint(selected)){toast('The record changed. Regenerate and review this handoff before saving.');refresh();return;}
   if(txt(selected.techNotes).includes(state.draft.trim()))return toast('This handoff is already in the technician notes.');
   mutateJob(selected.id,j=>{j.techNotes=[j.techNotes,state.draft.trim()].filter(Boolean).join('\n\n');});state.draft='';refresh();toast('Reviewed handoff appended. Normal sync applies.');
  }
  if(b.dataset.smart==='item'){
   const item=reviewItems().find(x=>x.key===b.dataset.key);if(!item)return toast('This item changed. Refresh the checks.');
   if(item.action==='check'){state.jobId=item.a;state.draft='PAPERWORK CHECK\n'+checks(S.jobs[item.a]).map(x=>'• '+x.detail).join('\n');state.mode='handoff';state.stamp=fingerprint(S.jobs[item.a]);refresh();document.getElementById('gs-smart-drafts')?.scrollIntoView({block:'start',behavior:'smooth'});}
   else if(item.action==='job')openJob(S.jobs[item.a]);
   else if(item.action==='doc'&&office()&&can('billingDocs'))A.openDoc(item.a,item.b);
   else if(item.action==='schedule'&&office()&&can('schedule'))go('schedule');
   else if(item.action==='customer'&&office()&&item.a)A.openCustomer(item.a);
  }
  saveDraft();
  }catch(_){toast('This saved record could not be checked. Review it in the existing workflow.');}
 });
 const network=()=>{const el=document.getElementById('gs-smart-status');if(el)el.textContent=status();};
 window.addEventListener('online',network);window.addEventListener('offline',network);
 window.GSSmartAssist=Object.freeze({checks,reviewItems,draft});
 renderNav();if(['#smart-assist','#field-assist'].includes(location.hash))route();
})();
