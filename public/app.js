/* ============================================================
   AUTH / TOKEN
============================================================ */
const TOKEN_KEY = 'ovoworks_token';
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

const API = '/api';
async function apiGet(path){
  const r = await fetch(API+path, { headers: authHeaders() });
  if(r.status===401) return handleUnauthorized();
  if(!r.ok) throw new Error('GET '+path+' failed: '+r.status);
  return r.json();
}
async function apiSend(method, path, body){
  const r = await fetch(API+path, {
    method, headers: { 'Content-Type':'application/json', ...authHeaders() },
    body: body!==undefined ? JSON.stringify(body) : undefined
  });
  if(r.status===401) return handleUnauthorized();
  if(!r.ok){
    let payload = null;
    try{ payload = await r.json(); }catch(e){ /* not JSON */ }
    const err = new Error((payload && (payload.error || payload.message)) || (method+' '+path+' failed: '+r.status));
    err.status = r.status;
    err.payload = payload;
    throw err;
  }
  return r.json();
}
function authHeaders(){
  const t = getToken();
  return t ? { 'Authorization': 'Bearer '+t } : {};
}
function handleUnauthorized(){
  clearToken();
  showAuthScreen();
  throw new Error('Session expired — please log in again.');
}
const apiPost = (path,body)=>apiSend('POST',path,body);
const apiPut = (path,body)=>apiSend('PUT',path,body);
const apiDelete = (path)=>apiSend('DELETE',path);

let CURRENT_USER = null;

function showAuthScreen(){
  document.getElementById('authScreen').style.display = 'block';
  document.getElementById('appRoot').style.display = 'none';
}
function showAppRoot(){
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
}
function initials(user){
  const source = (user && (user.name || user.email)) || '?';
  return source.charAt(0).toUpperCase();
}
function renderAccountBar(user){
  CURRENT_USER = user;
  document.getElementById('accountEmail').textContent = user ? (user.name || user.email) : '';
  const img = document.getElementById('accountAvatar');
  const placeholder = document.getElementById('accountAvatarPlaceholder');
  if(user && user.profilePicture){
    img.src = user.profilePicture; img.style.display = 'block'; placeholder.style.display = 'none';
  } else {
    img.style.display = 'none'; placeholder.style.display = 'flex'; placeholder.textContent = initials(user);
  }
}
function renderProfileCard(user){
  const nameInput = document.getElementById('st-name');
  if(nameInput) nameInput.value = (user && user.name) || '';
  const img = document.getElementById('profileAvatarPreview');
  const placeholder = document.getElementById('profileAvatarPlaceholder');
  if(!img || !placeholder) return;
  if(user && user.profilePicture){
    img.src = user.profilePicture; img.style.display = 'block'; placeholder.style.display = 'none';
  } else {
    img.style.display = 'none'; placeholder.style.display = 'flex'; placeholder.textContent = initials(user);
  }
}

/* ---- Google Sign-In ---- */
async function initGoogleSignIn(){
  try{
    const cfg = await fetch(API+'/auth/config').then(r=>r.json());
    if(!cfg.googleEnabled || !cfg.googleClientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: handleGoogleCredential });
      google.accounts.id.renderButton(document.getElementById('googleSignInBtn'), { theme:'outline', size:'large', width: 320 });
      document.getElementById('googleSignInWrap').style.display = 'block';
    };
    document.head.appendChild(script);
  }catch(e){ /* Google button just won't show — non-fatal */ }
}
async function handleGoogleCredential(response){
  try{
    const data = await apiSend('POST','/auth/google', { idToken: response.credential });
    setToken(data.token);
    await bootApp(data.user);
  }catch(err){
    showAuthError('Could not sign in with Google.');
  }
}
function showAuthTab(which){
  document.getElementById('authTab-login').classList.toggle('active', which==='login');
  document.getElementById('authTab-register').classList.toggle('active', which==='register');
  document.getElementById('authForm-login').style.display = which==='login' ? 'block' : 'none';
  document.getElementById('authForm-register').style.display = which==='register' ? 'block' : 'none';
  document.getElementById('authError').style.display = 'none';
}
function showAuthError(msg){
  const box = document.getElementById('authError');
  box.textContent = msg;
  box.style.display = 'block';
}

async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if(!email || !password){ showAuthError('Enter your email and password.'); return; }
  try{
    const data = await apiSend('POST','/auth/login',{ email, password });
    setToken(data.token);
    await bootApp(data.user);
  }catch(err){
    showAuthError((err.payload && err.payload.error) || 'Could not log in.');
  }
}
async function doRegister(){
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  if(!email || !password){ showAuthError('Enter an email and password.'); return; }
  try{
    const data = await apiSend('POST','/auth/register',{ email, password, name });
    setToken(data.token);
    await bootApp(data.user);
  }catch(err){
    showAuthError((err.payload && err.payload.error) || 'Could not create account.');
  }
}
function doLogout(){
  clearToken();
  showAuthScreen();
  toast('Logged out');
}

async function bootApp(user){
  showAppRoot();
  renderAccountBar(user);
  renderNav();
  document.getElementById('biasDate').value = todayStr();
  try{
    await loadPlans();
  }catch(e){ console.error('Could not load plans', e); toast('Could not load your plans: '+e.message); }
  renderPlatforms();
  setCalcMode('crypto');
  calc(); calcPairs();
  renderMedLog();
}

function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(window._toastT); window._toastT=setTimeout(()=>t.classList.remove('show'),1800);
}
function fmtDate(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function todayStr(){ return fmtDate(new Date()); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ============================================================
   NAV
============================================================ */
const NAV_TABS = [
  {id:'plans',label:'Plans'},
  {id:'bias',label:'Daily Bias'},
  {id:'journal',label:'Journal'},
  {id:'reviews',label:'Reviews'},
  {id:'insights',label:'Equity & News'},
  {id:'med',label:'Meditation'},
  {id:'calc',label:'Calculator'},
  {id:'learn',label:'Learn'},
  {id:'settings',label:'Settings'},
];
function renderNav(){
  document.getElementById('mainNav').innerHTML = NAV_TABS.map(t=>
    `<button class="navbtn ${t.id==='plans'?'active':''}" id="nav-${t.id}" onclick="showPanel('${t.id}')">${t.label}</button>`
  ).join('');
}
function toggleMobileNav(){
  document.getElementById('navbarWrap').classList.toggle('open');
}
function showPanel(id){
  NAV_TABS.forEach(t=>{
    document.getElementById('panel-'+t.id).classList.toggle('active', t.id===id);
    document.getElementById('nav-'+t.id).classList.toggle('active', t.id===id);
  });
  document.getElementById('navbarWrap').classList.remove('open'); // auto-close the mobile drawer after picking a tab
  if(id==='bias') loadBias();
  if(id==='journal') renderCalendar();
  if(id==='reviews'){
    document.getElementById('review-editor').style.display = 'block';
    document.getElementById('review-history').style.display = 'none';
    document.querySelectorAll('#panel-reviews .subtab').forEach((el,i)=>el.classList.toggle('active', i===0));
    renderReview();
  }
  if(id==='calc'){ renderPlatforms(); calc(); calcPip(); calcPairs(); }
  if(id==='settings') loadSettings();
  if(id==='insights'){ loadEquityCurve(); loadNews(); }
}

/* ============================================================
   PLANS
============================================================ */
let PLANS = [];
let ACTIVE_PLAN_ID = null;

const TF_PRESETS = {
  scalp:{label:'Scalp', htf:'Daily', mtf:'4H, 1H', ltf:'15m'},
  day:{label:'Day Trading', htf:'4H', mtf:'1H, 15m', ltf:'5m'},
  swing:{label:'Swing Trading', htf:'1H', mtf:'15m', ltf:'5m'},
  custom:{label:'Custom', htf:'', mtf:'', ltf:''}
};

async function loadPlans(){
  PLANS = await apiGet('/plans');
  if(PLANS.length && !ACTIVE_PLAN_ID) ACTIVE_PLAN_ID = PLANS[0]._id;
  renderPlanChips(); renderPlanEditor();
}

async function createPlan(){
  try{
    const p = await apiPost('/plans', { name: 'New Plan '+(PLANS.length+1), market: 'crypto' });
    PLANS.push(p); ACTIVE_PLAN_ID = p._id;
    renderPlanChips(); renderPlanEditor(); toast('Plan created');
  }catch(err){
    console.error('createPlan failed', err);
    toast('Could not create plan: '+err.message);
  }
}
async function deletePlan(id){
  if(!confirm('Delete this plan? This cannot be undone.')) return;
  try{
    await apiDelete('/plans/'+id);
    PLANS = PLANS.filter(p=>p._id!==id);
    if(ACTIVE_PLAN_ID===id) ACTIVE_PLAN_ID = PLANS.length? PLANS[0]._id : null;
    renderPlanChips(); renderPlanEditor(); toast('Plan deleted');
  }catch(err){
    console.error('deletePlan failed', err);
    toast('Could not delete plan: '+err.message);
  }
}
async function duplicatePlan(id){
  const src = PLANS.find(p=>p._id===id); if(!src) return;
  try{
    const copy = JSON.parse(JSON.stringify(src));
    delete copy._id; delete copy.createdAt; delete copy.updatedAt; delete copy.__v; delete copy.userId;
    copy.name = src.name+' (copy)';
    const created = await apiPost('/plans', copy);
    PLANS.push(created); ACTIVE_PLAN_ID = created._id;
    renderPlanChips(); renderPlanEditor(); toast('Plan duplicated');
  }catch(err){
    console.error('duplicatePlan failed', err);
    toast('Could not duplicate plan: '+err.message);
  }
}
function selectPlan(id){ ACTIVE_PLAN_ID = id; renderPlanChips(); renderPlanEditor(); }

function renderPlanChips(){
  const wrap = document.getElementById('planChips');
  if(!PLANS.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = PLANS.map(p=>
    `<div class="plan-chip ${p._id===ACTIVE_PLAN_ID?'active':''}" onclick="selectPlan('${p._id}')">
      ${escapeHtml(p.name)} <span class="mk">${p.market}</span>
    </div>`
  ).join('');
}

function activePlan(){ return PLANS.find(p=>p._id===ACTIVE_PLAN_ID); }

async function persistActivePlan(){
  const p = activePlan(); if(!p) return;
  const body = { ...p };
  delete body._id; delete body.createdAt; delete body.updatedAt; delete body.__v; delete body.userId;
  try{
    const updated = await apiPut('/plans/'+p._id, body);
    const idx = PLANS.findIndex(pl=>pl._id===p._id);
    PLANS[idx] = updated;
  }catch(err){
    console.error('persistActivePlan failed', err);
    toast('Could not save plan: '+err.message);
  }
}

function renderPlanEditor(){
  const wrap = document.getElementById('planEditorWrap');
  const plan = activePlan();
  if(!plan){
    wrap.innerHTML = `<div class="card"><div class="empty-state"><div class="big">📋</div>
      <h3>No plan yet</h3><p class="hint">Create your first trading plan to define your charting process, entry model, and exit rules.</p></div></div>`;
    return;
  }
  const tf = plan.tfStyle==='custom' ? plan.customTf : TF_PRESETS[plan.tfStyle];

  wrap.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.8rem;">
        <div style="flex:1;min-width:220px;">
          <label>Plan Name</label>
          <input type="text" value="${escapeHtml(plan.name)}" onblur="updatePlanField('name', this.value)"/>
        </div>
        <div style="width:220px;">
          <label>Market</label>
          <select onchange="updatePlanField('market', this.value)">
            <option value="crypto" ${plan.market==='crypto'?'selected':''}>Crypto / RWA Futures (Position Size)</option>
            <option value="forex" ${plan.market==='forex'?'selected':''}>Forex (PIP)</option>
            <option value="commodities" ${plan.market==='commodities'?'selected':''}>Commodities (Position Size)</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap;">
        <button class="btn ghost sm" onclick="duplicatePlan('${plan._id}')">Duplicate</button>
        <button class="btn danger sm" onclick="deletePlan('${plan._id}')">Delete Plan</button>
      </div>
    </div>

    <div class="card">
      <h2><span class="eyebrow">STEP 1–5</span> Charting Process</h2>
      ${plan.chartingProcess.map((c,i)=>`
        <div class="check-row">
          <span class="num">${i+1}</span>
          <input type="checkbox" class="toggle-dot" ${c.checked?'checked':''} onchange="toggleChecklistItem('chartingProcess',${i},this.checked)"/>
          <span class="lbl" contenteditable="true" onblur="updateChecklistLabel('chartingProcess',${i},this.innerText)">${escapeHtml(c.label)}</span>
        </div>`).join('')}
      <button class="btn ghost sm" style="margin-top:.8rem;" onclick="resetChecklist('chartingProcess')">Reset checklist</button>
    </div>

    <div class="card">
      <h2><span class="eyebrow">POI</span> Entry Criteria</h2>
      <p class="hint">Both must confirm within the Point of Interest before entry.</p>
      ${plan.poi.map((c,i)=>`
        <div class="check-row">
          <span class="num">${i+1}</span>
          <input type="checkbox" class="toggle-dot" ${c.checked?'checked':''} onchange="toggleChecklistItem('poi',${i},this.checked)"/>
          <span class="lbl" contenteditable="true" onblur="updateChecklistLabel('poi',${i},this.innerText)">${escapeHtml(c.label)}</span>
        </div>`).join('')}
      <button class="btn ghost sm" style="margin-top:.8rem;" onclick="resetChecklist('poi')">Reset checklist</button>
    </div>

    <div class="card">
      <h2><span class="eyebrow">MODEL</span> Entry Model</h2>
      <div class="radio-cards">
        <div class="radio-card ${plan.entryModel==='aggressive'?'selected':''}" onclick="setEntryModel('aggressive')">
          <div class="rc-head"><input type="radio" name="entryModel" ${plan.entryModel==='aggressive'?'checked':''} onclick="event.stopPropagation();setEntryModel('aggressive')"/> Aggressive</div>
          <textarea onclick="event.stopPropagation()" onblur="updateEntryModelNote('aggressive', this.value)">${escapeHtml(plan.entryModelNotes.aggressive)}</textarea>
        </div>
        <div class="radio-card ${plan.entryModel==='conservative'?'selected':''}" onclick="setEntryModel('conservative')">
          <div class="rc-head"><input type="radio" name="entryModel" ${plan.entryModel==='conservative'?'checked':''} onclick="event.stopPropagation();setEntryModel('conservative')"/> Conservative</div>
          <textarea onclick="event.stopPropagation()" onblur="updateEntryModelNote('conservative', this.value)">${escapeHtml(plan.entryModelNotes.conservative)}</textarea>
        </div>
      </div>
    </div>

    <div class="card">
      <h2><span class="eyebrow">EXIT</span> Exit Criteria</h2>
      <label>Stop Loss Rule</label>
      <textarea onblur="updateExitField('sl', this.value)">${escapeHtml(plan.exit.sl)}</textarea>
      <label style="margin-top:.6rem;">Take Profit Rule</label>
      <textarea onblur="updateExitField('tp', this.value)">${escapeHtml(plan.exit.tp)}</textarea>
    </div>

    <div class="card">
      <h2><span class="eyebrow">MGMT</span> Trade Management</h2>
      ${plan.tradeMgmt.map((m,i)=>`
        <div class="switch-row">
          <span class="lbl">${escapeHtml(m.label)}</span>
          <label class="switch"><input type="checkbox" ${m.enabled?'checked':''} onchange="toggleTradeMgmt(${i}, this.checked)"/><span class="track"></span></label>
        </div>`).join('')}
    </div>

    <div class="card">
      <h2><span class="eyebrow">TF</span> Timeframe Mapping</h2>
      <div class="pill-row">
        ${Object.keys(TF_PRESETS).map(k=>`<button class="pill ${plan.tfStyle===k?'active':''}" onclick="setTfStyle('${k}')">${TF_PRESETS[k].label}</button>`).join('')}
      </div>
      ${plan.tfStyle==='custom' ? `
        <div class="grid3">
          <div><label>HTF</label><input type="text" value="${escapeHtml(plan.customTf.htf)}" onblur="updateCustomTf('htf', this.value)"/></div>
          <div><label>MTF</label><input type="text" value="${escapeHtml(plan.customTf.mtf)}" onblur="updateCustomTf('mtf', this.value)"/></div>
          <div><label>LTF</label><input type="text" value="${escapeHtml(plan.customTf.ltf)}" onblur="updateCustomTf('ltf', this.value)"/></div>
        </div>
      ` : `
        <div class="grid3">
          <div class="result-box"><div class="result-val blue">${tf.htf}</div><div class="result-label">HTF</div></div>
          <div class="result-box"><div class="result-val blue">${tf.mtf}</div><div class="result-label">MTF</div></div>
          <div class="result-box"><div class="result-val blue">${tf.ltf}</div><div class="result-label">LTF</div></div>
        </div>
      `}
    </div>
  `;
}

async function updatePlanField(field, val){
  const p=activePlan(); if(!p) return;
  if(field==='name' && !val.trim()){ toast('Plan name can\'t be empty'); renderPlanEditor(); return; }
  p[field]=val; await persistActivePlan(); renderPlanChips();
}
async function toggleChecklistItem(section, i, checked){ const p=activePlan(); if(!p) return; p[section][i].checked=checked; await persistActivePlan(); }
async function updateChecklistLabel(section, i, text){ const p=activePlan(); if(!p) return; p[section][i].label=text.trim(); await persistActivePlan(); }
async function resetChecklist(section){ const p=activePlan(); if(!p) return; p[section].forEach(i=>i.checked=false); await persistActivePlan(); renderPlanEditor(); toast('Checklist reset'); }
async function setEntryModel(model){ const p=activePlan(); if(!p) return; p.entryModel=model; await persistActivePlan(); renderPlanEditor(); }
async function updateEntryModelNote(model, val){ const p=activePlan(); if(!p) return; p.entryModelNotes[model]=val; await persistActivePlan(); }
async function updateExitField(field, val){ const p=activePlan(); if(!p) return; p.exit[field]=val; await persistActivePlan(); }
async function toggleTradeMgmt(i, enabled){ const p=activePlan(); if(!p) return; p.tradeMgmt[i].enabled=enabled; await persistActivePlan(); }
async function setTfStyle(style){ const p=activePlan(); if(!p) return; p.tfStyle=style; await persistActivePlan(); renderPlanEditor(); }
async function updateCustomTf(field, val){ const p=activePlan(); if(!p) return; p.customTf[field]=val; await persistActivePlan(); }

/* ============================================================
   DAILY BIAS
============================================================ */
async function loadBias(){
  const dateInput = document.getElementById('biasDate');
  if(!dateInput.value) dateInput.value = todayStr();
  const date = dateInput.value;
  try{
    const data = await apiGet('/bias/'+date);
    document.getElementById('b-trend').value = data?.trend || 'Bullish';
    document.getElementById('b-position').value = data?.position || 'middle';
    document.getElementById('b-ydhigh').value = data?.ydHigh || '';
    document.getElementById('b-ydlow').value = data?.ydLow || '';
    document.getElementById('b-liqnotes').value = data?.liqNotes || '';
    document.getElementById('b-scenario').value = data?.scenario || 'continuation';
    document.getElementById('b-tp').value = data?.tp || '';
    document.getElementById('b-invLevel').value = data?.invLevel || '';
    document.getElementById('b-invalidated').checked = !!data?.invalidated;
  }catch(err){
    console.error('Could not load bias for', date, err);
    toast('Could not load bias entry: '+err.message);
  }
  renderBiasLog();
}
async function saveBias(){
  const date = document.getElementById('biasDate').value || todayStr();
  const data = {
    trend: document.getElementById('b-trend').value,
    position: document.getElementById('b-position').value,
    ydHigh: document.getElementById('b-ydhigh').value,
    ydLow: document.getElementById('b-ydlow').value,
    liqNotes: document.getElementById('b-liqnotes').value,
    scenario: document.getElementById('b-scenario').value,
    tp: document.getElementById('b-tp').value,
    invLevel: document.getElementById('b-invLevel').value,
    invalidated: document.getElementById('b-invalidated').checked,
  };
  await apiPut('/bias/'+date, data);
  toast('Bias saved for '+date);
  renderBiasLog();
}
async function renderBiasLog(){
  const box = document.getElementById('biasLog');
  try{
    const list = await apiGet('/bias?limit=14');
    if(!list.length){ box.innerHTML = `<p class="hint">No bias entries yet.</p>`; return; }
    box.innerHTML = `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Trend</th><th>Position</th><th>Scenario</th><th>Status</th></tr></thead><tbody>
      ${list.map(b=>`<tr>
        <td>${b.date}</td>
        <td>${escapeHtml(b.trend||'')}</td>
        <td><span class="tag ${b.position==='premium'?'tag-r':b.position==='discount'?'tag-g':'tag-y'}">${escapeHtml(b.position||'')}</span></td>
        <td>${escapeHtml(b.scenario||'')}</td>
        <td>${b.invalidated? '<span class="tag tag-r">Invalidated</span>':'<span class="tag tag-g">Held</span>'}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }catch(err){
    console.error('Could not load bias log', err);
    box.innerHTML = `<p class="hint">Could not load bias log: ${escapeHtml(err.message)}</p>`;
  }
}

/* ============================================================
   JOURNAL — CALENDAR
============================================================ */
let CAL_DATE = new Date();
let SELECTED_DAY = null;

function showJournalSub(which){
  document.querySelectorAll('.jsub').forEach(el=>el.style.display='none');
  document.getElementById('journal-'+which).style.display='block';
  document.querySelectorAll('#panel-journal .subtab').forEach(el=>el.classList.remove('active'));
  event.target.classList.add('active');
}

function calShift(dir){ CAL_DATE.setMonth(CAL_DATE.getMonth()+dir); renderCalendar(); }

async function renderCalendar(){
  const y = CAL_DATE.getFullYear(), m = CAL_DATE.getMonth();
  document.getElementById('calLabel').textContent = CAL_DATE.toLocaleString('default',{month:'long',year:'numeric'});
  const firstDow = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const monthStart = fmtDate(new Date(y,m,1));
  const monthEnd = fmtDate(new Date(y,m,daysInMonth));

  // Render the day numbers immediately, independent of any API call - so the
  // calendar is never blank even if fetching trades/bias markers fails.
  function buildCells(tradesByDay, biasDays){
    let cells = ['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dow">${d}</div>`).join('');
    for(let i=0;i<firstDow;i++) cells += `<div class="cal-day empty"></div>`;
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = fmtDate(new Date(y,m,d));
      const isToday = dateStr===todayStr();
      const isSelected = dateStr===SELECTED_DAY;
      let statHtml = '';
      const dayTrades = tradesByDay ? tradesByDay[dateStr] : null;
      if(dayTrades && dayTrades.length){
        const wins = dayTrades.filter(t=>t.outcome==='win').length;
        const losses = dayTrades.filter(t=>t.outcome==='loss').length;
        const cls = wins>losses?'win':losses>wins?'loss':'mix';
        statHtml = `<span class="dstat ${cls}">${dayTrades.length} trade${dayTrades.length>1?'s':''}</span>`;
      }
      const hasBias = biasDays ? biasDays.has(dateStr) : false;
      const marks = `<div class="dmarks">${hasBias?'<span class="dot bias" title="Bias logged"></span>':''}</div>`;
      cells += `<div class="cal-day ${isToday?'today':''} ${isSelected?'selected':''}" onclick="openDay('${dateStr}')">
        <div class="dnum">${d}</div>${statHtml}${marks}
      </div>`;
    }
    return cells;
  }

  // First paint: dates only, so the grid is visible right away.
  document.getElementById('calGrid').innerHTML = buildCells(null, null);

  // Then layer in trade/bias markers - if this fails, the dates stay visible,
  // we just show a toast instead of losing the whole calendar.
  try{
    const [trades, biasList] = await Promise.all([
      apiGet(`/trades?start=${monthStart}&end=${monthEnd}`),
      apiGet(`/bias?start=${monthStart}&end=${monthEnd}`)
    ]);
    const tradesByDay = {};
    trades.forEach(t=>{ (tradesByDay[t.date] = tradesByDay[t.date]||[]).push(t); });
    const biasDays = new Set(biasList.map(b=>b.date));
    document.getElementById('calGrid').innerHTML = buildCells(tradesByDay, biasDays);
  }catch(err){
    console.error('Could not load calendar markers', err);
    toast('Calendar loaded, but trade/bias markers failed: '+err.message);
  }
}

async function openDay(dateStr){
  SELECTED_DAY = dateStr;
  renderCalendar();
  const [survey, trades] = await Promise.all([
    apiGet('/surveys/'+dateStr),
    apiGet('/trades?date='+dateStr)
  ]);
  const sv = survey || {};
  const wrap = document.getElementById('dayDetail');
  wrap.innerHTML = `
    <div class="card">
      <h2 style="margin:0;"><span class="eyebrow">SURVEY</span> Daily Reflection — ${dateStr}</h2>
      <label style="margin-top:.8rem;">Did you follow your trade plan?</label>
      <select id="sv-followed"><option value="yes" ${sv.followed==='yes'?'selected':''}>Yes</option><option value="no" ${sv.followed==='no'?'selected':''}>No</option><option value="partial" ${sv.followed==='partial'?'selected':''}>Partially</option></select>
      <label style="margin-top:.6rem;">What was your result today?</label>
      <input type="text" id="sv-result" placeholder="e.g. +$45 / -$20 / breakeven" value="${escapeHtml(sv.result||'')}"/>
      <div class="grid2" style="margin-top:.6rem;">
        <div><label>Win Rate Today (%)</label><input type="number" id="sv-winrate" value="${sv.winRate??''}"/></div>
        <div><label>Trades Taken Today</label><input type="number" id="sv-tradecount" value="${sv.tradeCount??''}"/></div>
      </div>
      <div class="grid2" style="margin-top:.6rem;">
        <div><label>Wins</label><input type="number" id="sv-wins" value="${sv.wins??''}"/></div>
        <div><label>Losses</label><input type="number" id="sv-losses" value="${sv.losses??''}"/></div>
      </div>
      <label style="margin-top:.6rem;">Did you violate any trade rule?</label>
      <textarea id="sv-violation" placeholder="Describe any rule violation, or write 'none'">${escapeHtml(sv.violation||'')}</textarea>
      <button class="btn block" style="margin-top:.8rem;" onclick="saveSurvey('${dateStr}')">Save Daily Reflection</button>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;"><span class="eyebrow">TRADES</span> Trade Entries</h2>
        <button class="btn sm" onclick="openTradeForm('${dateStr}')">+ Add Trade</button>
      </div>
      <div id="tradesList" style="margin-top:.8rem;">
        ${trades.length? trades.map(t=>renderTradeCard(t)).join('') : '<p class="hint">No trades logged for this day yet.</p>'}
      </div>
      <div id="tradeFormWrap"></div>
    </div>
  `;
}

// Renders a chart URL as an actual image thumbnail (click to enlarge).
// If the URL doesn't load as an image (e.g. a TradingView share page rather
// than a direct image link), falls back to a plain "open link" pill instead
// of showing a broken image icon.
function chartThumb(url, label){
  if(!url) return '';
  const safe = escapeHtml(url);
  return `
    <div style="text-align:center;">
      <img src="${safe}" alt="${label} chart" loading="lazy"
        style="width:110px;height:74px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer;display:block;"
        onclick="openLightbox('${safe}')"
        onerror="this.replaceWith(Object.assign(document.createElement('a'),{href:'${safe}',target:'_blank',rel:'noopener',textContent:'Open ${label} link',className:'hint'}))"/>
      <div style="font-size:.72rem;color:var(--dim);margin-top:.2rem;font-weight:700;">${label}</div>
    </div>`;
}
function openLightbox(url){
  let box = document.getElementById('lightbox');
  if(!box){
    box = document.createElement('div');
    box.id = 'lightbox';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(11,24,38,.88);display:flex;align-items:center;justify-content:center;z-index:1000;cursor:zoom-out;padding:2rem;';
    box.onclick = () => box.remove();
    document.body.appendChild(box);
  }
  box.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5);"/>`;
}

function renderTradeCard(t){
  return `<div class="trade-entry-card">
    <div class="te-top">
      <strong>${t.pair?escapeHtml(t.pair)+' · ':''}${escapeHtml(t.planName||'No plan')}</strong>
      <span class="tag ${t.outcome==='win'?'tag-g':t.outcome==='loss'?'tag-r':'tag-y'}">${t.outcome} ${t.pnl!==''&&t.pnl!==undefined?('· $'+t.pnl):''} ${t.rMultiple?('· '+t.rMultiple+'R'):''}</span>
    </div>
    <p class="hint">Followed plan: ${t.followedPlan?'Yes':'No'} · Rule broken: ${t.ruleBroken?'Yes':'No'} · FOMO: ${t.fomoTrade?'Yes':'No'} · Entry emotion: ${escapeHtml(t.entryEmotion||'—')} · Exit emotion: ${escapeHtml(t.exitEmotion||'—')}</p>
    ${t.confluences? `<p class="hint"><strong>Confluences:</strong> ${escapeHtml(t.confluences)}</p>`:''}
    ${t.mistakes? `<p class="hint"><strong>Mistakes:</strong> ${escapeHtml(t.mistakes)}</p>`:''}
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.6rem;">
      ${chartThumb(t.htfLink,'HTF')}
      ${chartThumb(t.mtfLink,'MTF')}
      ${chartThumb(t.ltfLink,'LTF')}
    </div>
    <div style="display:flex;gap:.5rem;margin-top:.6rem;">
      <button class="btn ghost sm" onclick="openTradeForm('${t.date}','${t._id}')">Edit</button>
      <button class="btn danger sm" onclick="deleteTrade('${t.date}','${t._id}')">Delete</button>
    </div>
  </div>`;
}

function guardrailBannerHtml(status){
  if(!status || !status.enabled) return '';
  if(status.blocked){
    return `<div class="danger-box">
      <strong>Guardrail triggered — new trades are blocked:</strong>
      <ul style="margin:.4rem 0 0 1.1rem;">${status.reasons.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>
      <p style="margin-top:.5rem;">You can still save deliberately with the override checkbox below — that's a decision, not an accident.</p>
    </div>`;
  }
  return `<div class="tip">
    Guardrails OK — ${status.todayTradeCount}/${status.maxTradesPerDay} trades today · today's P/L $${status.todayPnl}
    (loss limit -$${Math.abs(status.maxDailyLoss)}, profit target $${status.maxDailyProfit}) ·
    drawdown $${status.currentDrawdown} of $${status.maxDrawdownAmount} (${status.drawdownPct}%) ·
    suggested risk this trade: $${status.suggestedRiskAmount} (${status.riskPerTradePct}% of $${status.accountCapital})
  </div>`;
}

async function openTradeForm(dateStr, tradeId){
  let t = {planId:'', pair:'', outcome:'win', pnl:'', riskAmount:'', followedPlan:true, ruleBroken:false, ruleBrokenNotes:'',
    fomoTrade:false, missedSetup:false, confluences:'', tradeMgmtNotes:'', mistakes:'', entryEmotion:'', exitEmotion:'',
    htfLink:'', mtfLink:'', ltfLink:''};
  if(tradeId){ t = await apiGet('/trades/'+tradeId); }

  let guardrailStatus = null;
  if(!tradeId){
    try{ guardrailStatus = await apiGet('/guardrails/status?date='+dateStr); }catch(e){ /* non-fatal */ }
  }

  document.getElementById('tradeFormWrap').innerHTML = `
    <div class="card soft" style="margin-top:1rem;">
      <h3 style="margin-top:0;">${tradeId?'Edit Trade':'New Trade'} — ${dateStr}</h3>
      ${!tradeId ? guardrailBannerHtml(guardrailStatus) : ''}
      ${(!tradeId && guardrailStatus && guardrailStatus.blocked) ? `
        <div class="switch-row" style="border:none;margin-top:.4rem;">
          <span class="lbl">Override guardrails and log this trade anyway</span>
          <label class="switch"><input type="checkbox" id="tf-override"/><span class="track"></span></label>
        </div>` : ''}
      <div class="grid2">
        <div>
          <label>Pair / Symbol Traded</label>
          <input type="text" id="tf-pair" placeholder="e.g. BTC/USD, EUR/USD, AAPL" value="${escapeHtml(t.pair)}"/>
        </div>
        <div>
          <label>Plan Used</label>
          <select id="tf-plan">
            <option value="">— none —</option>
            ${PLANS.map(p=>`<option value="${p._id}" ${t.planId===p._id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid2" style="margin-top:.6rem;">
        <div>
          <label>Outcome</label>
          <select id="tf-outcome">
            <option value="win" ${t.outcome==='win'?'selected':''}>Win</option>
            <option value="loss" ${t.outcome==='loss'?'selected':''}>Loss</option>
            <option value="breakeven" ${t.outcome==='breakeven'?'selected':''}>Breakeven</option>
          </select>
        </div>
        <div><label>P/L ($) — enter the amount, sign is set from Outcome above</label><input type="number" id="tf-pnl" value="${t.pnl}"/></div>
      </div>
      <div class="grid2" style="margin-top:.6rem;">
        <div><label>Risk Amount ($) — used to compute R</label><input type="number" id="tf-risk" value="${t.riskAmount}"/></div>
      </div>
      <div class="grid2" style="margin-top:.6rem;">
        <div class="switch-row" style="border:none;"><span class="lbl">Followed my trade plan</span>
          <label class="switch"><input type="checkbox" id="tf-followed" ${t.followedPlan?'checked':''}/><span class="track"></span></label></div>
        <div class="switch-row" style="border:none;"><span class="lbl">Rule broken</span>
          <label class="switch"><input type="checkbox" id="tf-rulebroken" ${t.ruleBroken?'checked':''}/><span class="track"></span></label></div>
      </div>
      <div class="grid2" style="margin-top:.2rem;">
        <div class="switch-row" style="border:none;"><span class="lbl">FOMO trade</span>
          <label class="switch"><input type="checkbox" id="tf-fomo" ${t.fomoTrade?'checked':''}/><span class="track"></span></label></div>
        <div class="switch-row" style="border:none;"><span class="lbl">This was a missed/skipped setup</span>
          <label class="switch"><input type="checkbox" id="tf-missed" ${t.missedSetup?'checked':''}/><span class="track"></span></label></div>
      </div>

      <p class="hint" style="margin-top:.6rem;">Paste a <strong>direct image URL</strong> (ends in .png/.jpg, e.g. from Imgur, Postimages, or a TradingView "Copy image link") so it shows as a thumbnail below. A TradingView share <em>page</em> link (tradingview.com/x/...) will still save and open fine, but won't preview as an image.</p>
      <label style="margin-top:.6rem;">HTF Screenshot — Image URL</label>
      <input type="url" id="tf-htf" placeholder="https://i.imgur.com/xxxxx.png" value="${escapeHtml(t.htfLink)}"/>
      <label style="margin-top:.5rem;">MTF Screenshot — Image URL</label>
      <input type="url" id="tf-mtf" placeholder="https://i.imgur.com/xxxxx.png" value="${escapeHtml(t.mtfLink)}"/>
      <label style="margin-top:.5rem;">LTF Screenshot — Image URL</label>
      <input type="url" id="tf-ltf" placeholder="https://i.imgur.com/xxxxx.png" value="${escapeHtml(t.ltfLink)}"/>

      <label style="margin-top:.6rem;">Confluences That Led To This Trade</label>
      <textarea id="tf-confluences">${escapeHtml(t.confluences)}</textarea>
      <label style="margin-top:.5rem;">Trade Management Setup Used</label>
      <textarea id="tf-mgmt">${escapeHtml(t.tradeMgmtNotes)}</textarea>
      <label style="margin-top:.5rem;">Mistakes Made</label>
      <textarea id="tf-mistakes">${escapeHtml(t.mistakes)}</textarea>
      <label style="margin-top:.5rem;">Rule Broken Notes</label>
      <textarea id="tf-rulebrokennotes">${escapeHtml(t.ruleBrokenNotes)}</textarea>

      <div class="grid2" style="margin-top:.6rem;">
        <div><label>Entry Emotion</label><input type="text" id="tf-entryEmotion" placeholder="e.g. calm, confident" value="${escapeHtml(t.entryEmotion)}"/></div>
        <div><label>Exit Emotion</label><input type="text" id="tf-exitEmotion" placeholder="e.g. relieved, frustrated" value="${escapeHtml(t.exitEmotion)}"/></div>
      </div>

      <div style="display:flex;gap:.6rem;margin-top:1rem;">
        <button class="btn" onclick="saveTrade('${dateStr}','${tradeId||''}')">Save Trade</button>
        <button class="btn ghost" onclick="document.getElementById('tradeFormWrap').innerHTML=''">Cancel</button>
      </div>
    </div>
  `;
}

async function saveTrade(dateStr, tradeId){
  const planSel = document.getElementById('tf-plan');
  const plan = PLANS.find(p=>p._id===planSel.value);
  const data = {
    date: dateStr,
    pair: document.getElementById('tf-pair').value.trim(),
    planId: planSel.value || null, planName: plan? plan.name : '',
    outcome: document.getElementById('tf-outcome').value,
    pnl: document.getElementById('tf-pnl').value,
    riskAmount: document.getElementById('tf-risk').value,
    followedPlan: document.getElementById('tf-followed').checked,
    ruleBroken: document.getElementById('tf-rulebroken').checked,
    ruleBrokenNotes: document.getElementById('tf-rulebrokennotes').value,
    fomoTrade: document.getElementById('tf-fomo').checked,
    missedSetup: document.getElementById('tf-missed').checked,
    htfLink: document.getElementById('tf-htf').value,
    mtfLink: document.getElementById('tf-mtf').value,
    ltfLink: document.getElementById('tf-ltf').value,
    confluences: document.getElementById('tf-confluences').value,
    tradeMgmtNotes: document.getElementById('tf-mgmt').value,
    mistakes: document.getElementById('tf-mistakes').value,
    entryEmotion: document.getElementById('tf-entryEmotion').value,
    exitEmotion: document.getElementById('tf-exitEmotion').value,
  };
  if(tradeId){
    await apiPut('/trades/'+tradeId, data);
  } else {
    const overrideEl = document.getElementById('tf-override');
    data.overrideGuardrails = overrideEl ? overrideEl.checked : false;
    try{
      await apiPost('/trades', data);
    } catch(err){
      if(err.status===403 && err.payload){
        toast('Blocked by guardrails — check the override box if you really want to log this');
        openTradeForm(dateStr); // re-render with fresh guardrail status
        return;
      }
      throw err;
    }
  }
  toast('Trade saved');
  openDay(dateStr);
  renderCalendar();
}
async function deleteTrade(dateStr, tradeId){
  if(!confirm('Delete this trade entry?')) return;
  await apiDelete('/trades/'+tradeId);
  toast('Trade deleted');
  openDay(dateStr);
  renderCalendar();
}
async function saveSurvey(dateStr){
  const data = {
    followed: document.getElementById('sv-followed').value,
    result: document.getElementById('sv-result').value,
    winRate: document.getElementById('sv-winrate').value || null,
    tradeCount: document.getElementById('sv-tradecount').value || null,
    wins: document.getElementById('sv-wins').value || null,
    losses: document.getElementById('sv-losses').value || null,
    violation: document.getElementById('sv-violation').value,
  };
  await apiPut('/surveys/'+dateStr, data);
  toast('Daily reflection saved');
}

/* ============================================================
   REVIEWS — Weekly / Monthly / Quarterly / Annual
============================================================ */
let REVIEW_PERIOD = 'weekly';
let REVIEW_ANCHOR = new Date();

function showReviewSub(which){
  document.querySelectorAll('#panel-reviews .subtab').forEach(el=>el.classList.remove('active'));
  event.target.classList.add('active');

  if(which==='history'){
    document.getElementById('review-editor').style.display = 'none';
    document.getElementById('review-history').style.display = 'block';
    loadReviewHistory();
    return;
  }

  document.getElementById('review-editor').style.display = 'block';
  document.getElementById('review-history').style.display = 'none';
  REVIEW_PERIOD = which;
  renderReview();
}
function reviewShift(dir){
  const d = new Date(REVIEW_ANCHOR);
  if(REVIEW_PERIOD==='weekly') d.setDate(d.getDate()+dir*7);
  else if(REVIEW_PERIOD==='monthly') d.setMonth(d.getMonth()+dir);
  else if(REVIEW_PERIOD==='quarterly') d.setMonth(d.getMonth()+dir*3);
  else d.setFullYear(d.getFullYear()+dir);
  REVIEW_ANCHOR = d;
  renderReview();
}
function sundayOf(d){ const x=new Date(d); x.setDate(x.getDate()-x.getDay()); return x; }
function quarterOf(d){ return Math.floor(d.getMonth()/3)+1; }

function statsGridHtml(stats){
  return `
    <div class="result-box"><div class="result-val blue">${stats.totalTrades}</div><div class="result-label">Total Trades</div></div>
    <div class="result-box profit"><div class="result-val green">${stats.wins}</div><div class="result-label">Wins</div></div>
    <div class="result-box loss"><div class="result-val red">${stats.losses}</div><div class="result-label">Losses</div></div>
    <div class="result-box"><div class="result-val blue">${stats.breakeven}</div><div class="result-label">Breakeven</div></div>
    <div class="result-box warn"><div class="result-val yellow">${stats.winRate}%</div><div class="result-label">Win Rate</div></div>
    <div class="result-box ${stats.netPnl>=0?'profit':'loss'}"><div class="result-val ${stats.netPnl>=0?'green':'red'}">$${stats.netPnl}</div><div class="result-label">Net PnL</div></div>
    <div class="result-box ${stats.netR>=0?'profit':'loss'}"><div class="result-val ${stats.netR>=0?'green':'red'}">${stats.netR}R</div><div class="result-label">Net R</div></div>
    <div class="result-box profit"><div class="result-val green">$${stats.avgWinPnl} / ${stats.avgWinR}R</div><div class="result-label">Avg Win</div></div>
    <div class="result-box loss"><div class="result-val red">$${stats.avgLossPnl} / ${stats.avgLossR}R</div><div class="result-label">Avg Loss</div></div>
    <div class="result-box loss"><div class="result-val red">$${stats.maxDrawdown}</div><div class="result-label">Max Drawdown</div></div>
    <div class="result-box warn"><div class="result-val yellow">${stats.ruleBreakCount}</div><div class="result-label">Rule Breaks</div></div>
    <div class="result-box warn"><div class="result-val yellow">${stats.complianceRate}%</div><div class="result-label">Compliance Rate</div></div>
  `;
}

function bestWorstNote(suggestion){
  if(!suggestion) return '<p class="hint">No trade found for this period yet.</p>';
  return `<p class="hint">${suggestion.date}${suggestion.pair?(' · '+escapeHtml(suggestion.pair)):''} · ${escapeHtml(suggestion.planName||'No plan')} · $${suggestion.pnl} ${suggestion.rMultiple?('· '+suggestion.rMultiple+'R'):''}${suggestion.confluences?(' · '+escapeHtml(suggestion.confluences)):''}</p>`;
}

async function renderReview(){
  const label = document.getElementById('reviewPeriodLabel');
  const statsBox = document.getElementById('reviewStats');
  const formWrap = document.getElementById('reviewFormWrap');

  try{

  if(REVIEW_PERIOD==='weekly'){
    const weekStart = fmtDate(sundayOf(REVIEW_ANCHOR));
    const data = await apiGet('/reviews/weekly/'+weekStart);
    label.textContent = `${data.range.start} → ${data.range.end}`;
    statsBox.innerHTML = statsGridHtml(data.stats);
    const r = data.review || {};
    const qa = r.qa || {};
    const refl = r.reflection || {};
    formWrap.innerHTML = `
      <div class="card">
        <h2><span class="eyebrow">Q&amp;A</span> Weekly Q&amp;A</h2>
        <label>Compliance Rate</label>
        <div class="tip">${data.stats.complianceRate}% of trades followed your plan this week (auto-calculated from the journal).</div>
        <label style="margin-top:.6rem;">How many setups did you miss?</label>
        <input type="number" id="rv-missed" value="${qa.missedSetupsCount ?? ''}"/>
        <label style="margin-top:.6rem;">Best trade this week (auto-suggested — edit the note)</label>
        ${bestWorstNote(data.suggestions.best)}
        <textarea id="rv-bestnote" placeholder="What did you do right here, so you repeat it?">${escapeHtml(qa.bestTradeNote||'')}</textarea>
        <label style="margin-top:.6rem;">Worst trade this week (auto-suggested — edit the note)</label>
        ${bestWorstNote(data.suggestions.worst)}
        <textarea id="rv-worstnote" placeholder="What went wrong, so you don't repeat it?">${escapeHtml(qa.worstTradeNote||'')}</textarea>
      </div>
      <div class="card">
        <h2><span class="eyebrow">REFLECT</span> Weekly Reflection</h2>
        <label>What went well this week?</label>
        <textarea id="rv-wentwell">${escapeHtml(refl.wentWell||'')}</textarea>
        <label style="margin-top:.6rem;">What were your mistakes or weaknesses?</label>
        <textarea id="rv-mistakes">${escapeHtml(refl.mistakesWeaknesses||'')}</textarea>
        <label style="margin-top:.6rem;">What patterns did you notice?</label>
        <textarea id="rv-patterns">${escapeHtml(refl.patternsNoticed||'')}</textarea>
        <label style="margin-top:.6rem;">Single focus going into next week</label>
        <textarea id="rv-focus">${escapeHtml(refl.singleFocusNextWeek||'')}</textarea>
        <button class="btn block" style="margin-top:1rem;" onclick="saveWeeklyReview('${weekStart}')">Save Weekly Review</button>
      </div>`;

  } else if(REVIEW_PERIOD==='monthly'){
    const y = REVIEW_ANCHOR.getFullYear(), m = REVIEW_ANCHOR.getMonth()+1;
    const data = await apiGet(`/reviews/monthly/${y}/${m}`);
    label.textContent = REVIEW_ANCHOR.toLocaleString('default',{month:'long',year:'numeric'});
    statsBox.innerHTML = statsGridHtml(data.stats);
    const r = data.review || {};
    const refl = r.reflection || {};
    const qa = r.qa || {};
    formWrap.innerHTML = `
      <div class="card">
        <h2><span class="eyebrow">WEEKS</span> Weekly Reviews This Month</h2>
        ${data.weeklyReviews.length ? `<div class="table-scroll"><table><thead><tr><th>Week</th><th>Focus Set</th></tr></thead><tbody>
          ${data.weeklyReviews.map(w=>`<tr><td>${w.weekStart} → ${w.weekEnd}</td><td>${escapeHtml(w.reflection?.singleFocusNextWeek||'—')}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="hint">No weekly reviews logged in this month yet.</p>'}
      </div>
      <div class="card">
        <h2><span class="eyebrow">SCORE</span> Monthly Process Scoring</h2>
        <label>Process Score (0–10) — did you execute your plan, not just your PnL?</label>
        <input type="number" id="rv-score" min="0" max="10" value="${r.processScore ?? ''}"/>
        <label style="margin-top:.6rem;">Score notes</label>
        <textarea id="rv-scorenotes">${escapeHtml(r.processScoreNotes||'')}</textarea>
        <label style="margin-top:.6rem;">How many setups did you miss this month?</label>
        <input type="number" id="rv-missed" value="${qa.missedSetupsCount ?? ''}"/>
      </div>
      <div class="card">
        <h2><span class="eyebrow">REFLECT</span> Monthly Reflection</h2>
        <label>The one trade that hit different this month — WIN</label>
        ${bestWorstNote(data.suggestions.best)}
        <textarea id="rv-bestwinnote">${escapeHtml(refl.bestTradeWinNote||'')}</textarea>
        <label style="margin-top:.6rem;">The one trade that hit different this month — LOSS</label>
        ${bestWorstNote(data.suggestions.worst)}
        <textarea id="rv-bestlossnote">${escapeHtml(refl.bestTradeLossNote||'')}</textarea>
        <label style="margin-top:.6rem;">What mental barrier showed up the most this month?</label>
        <textarea id="rv-barrier">${escapeHtml(refl.mentalBarrier||'')}</textarea>
        <label style="margin-top:.6rem;">What's your fix plan?</label>
        <textarea id="rv-fixplan">${escapeHtml(refl.fixPlan||'')}</textarea>
        <label style="margin-top:.6rem;">What are you most proud of this month, process over report?</label>
        <textarea id="rv-proud">${escapeHtml(refl.mostProud||'')}</textarea>
        <label style="margin-top:.6rem;">Single focus going into next month</label>
        <textarea id="rv-focus">${escapeHtml(refl.singleFocusNextMonth||'')}</textarea>
        <button class="btn block" style="margin-top:1rem;" onclick="saveMonthlyReview(${y},${m})">Save Monthly Review</button>
      </div>`;

  } else if(REVIEW_PERIOD==='quarterly'){
    const y = REVIEW_ANCHOR.getFullYear(), q = quarterOf(REVIEW_ANCHOR);
    const data = await apiGet(`/reviews/quarterly/${y}/${q}`);
    label.textContent = `Q${q} ${y}`;
    statsBox.innerHTML = statsGridHtml(data.stats);
    const r = data.review || {};
    const refl = r.reflection || {};
    formWrap.innerHTML = `
      <div class="card">
        <h2><span class="eyebrow">MONTHS</span> Monthly Reviews This Quarter</h2>
        ${data.monthlyReviews.length ? `<div class="table-scroll"><table><thead><tr><th>Month</th><th>Process Score</th><th>Focus Set</th></tr></thead><tbody>
          ${data.monthlyReviews.map(mo=>`<tr><td>${mo.year}-${String(mo.month).padStart(2,'0')}</td><td>${mo.processScore ?? '—'}</td><td>${escapeHtml(mo.reflection?.singleFocusNextMonth||'—')}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="hint">No monthly reviews logged in this quarter yet.</p>'}
        <p class="hint" style="margin-top:.6rem;">Quarters run calendar-aligned: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec.</p>
      </div>
      <div class="card">
        <h2><span class="eyebrow">REFLECT</span> Quarterly Reflection</h2>
        <label>What went well this quarter?</label>
        <textarea id="rv-wentwell">${escapeHtml(refl.wentWell||'')}</textarea>
        <label style="margin-top:.6rem;">What were your mistakes?</label>
        <textarea id="rv-mistakes">${escapeHtml(refl.mistakes||'')}</textarea>
        <label style="margin-top:.6rem;">What patterns did you notice across the quarter?</label>
        <textarea id="rv-patterns">${escapeHtml(refl.patterns||'')}</textarea>
        <label style="margin-top:.6rem;">Biggest lesson</label>
        <textarea id="rv-lesson">${escapeHtml(refl.biggestLesson||'')}</textarea>
        <label style="margin-top:.6rem;">Single focus going into next quarter</label>
        <textarea id="rv-focus">${escapeHtml(refl.singleFocusNextQuarter||'')}</textarea>
        <button class="btn block" style="margin-top:1rem;" onclick="saveQuarterlyReview(${y},${q})">Save Quarterly Review</button>
      </div>`;

  } else { // annual
    const y = REVIEW_ANCHOR.getFullYear();
    const data = await apiGet(`/reviews/annual/${y}`);
    label.textContent = String(y);
    statsBox.innerHTML = statsGridHtml(data.stats);
    const r = data.review || {};
    const dr = r.deepReflection || {};
    formWrap.innerHTML = `
      <div class="card">
        <h2><span class="eyebrow">YEAR</span> Quarters &amp; Months Recap</h2>
        ${data.quarterlyReviews.length ? `<div class="table-scroll"><table><thead><tr><th>Quarter</th><th>Focus Set</th></tr></thead><tbody>
          ${data.quarterlyReviews.map(q=>`<tr><td>Q${q.quarter} ${q.year}</td><td>${escapeHtml(q.reflection?.singleFocusNextQuarter||'—')}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="hint">No quarterly reviews logged this year yet.</p>'}
      </div>
      <div class="card">
        <h2><span class="eyebrow">DEEP</span> Annual Deep Reflection</h2>
        <p class="hint">Block out a whole day for this one. No rush.</p>
        <label>Biggest win trade this year</label>
        ${bestWorstNote(data.suggestions.best)}
        <textarea id="rv-winnote">${escapeHtml(dr.biggestWinNote||'')}</textarea>
        <label style="margin-top:.6rem;">Biggest loss trade this year</label>
        ${bestWorstNote(data.suggestions.worst)}
        <textarea id="rv-lossnote">${escapeHtml(dr.biggestLossNote||'')}</textarea>
        <label style="margin-top:.6rem;">Growth areas</label>
        <textarea id="rv-growth">${escapeHtml(dr.growthAreas||'')}</textarea>
        <label style="margin-top:.6rem;">How did your mental game evolve this year?</label>
        <textarea id="rv-mental">${escapeHtml(dr.mentalGameEvolution||'')}</textarea>
        <label style="margin-top:.6rem;">Systems / process improvements made</label>
        <textarea id="rv-systems">${escapeHtml(dr.systemsImprovements||'')}</textarea>
        <label style="margin-top:.6rem;">What are you most proud of?</label>
        <textarea id="rv-proud">${escapeHtml(dr.mostProud||'')}</textarea>
        <label style="margin-top:.6rem;">Gratitude</label>
        <textarea id="rv-gratitude">${escapeHtml(dr.gratitude||'')}</textarea>
        <label style="margin-top:.6rem;">Vision for next year</label>
        <textarea id="rv-vision">${escapeHtml(dr.nextYearVision||'')}</textarea>
        <label style="margin-top:.6rem;">Single focus going into next year</label>
        <textarea id="rv-focus">${escapeHtml(dr.singleFocusNextYear||'')}</textarea>
        <label style="margin-top:.6rem;">Freeform notes</label>
        <textarea id="rv-freeform" style="min-height:140px;">${escapeHtml(dr.freeform||'')}</textarea>
        <button class="btn block" style="margin-top:1rem;" onclick="saveAnnualReview(${y})">Save Annual Review</button>
      </div>`;
  }

  }catch(err){
    console.error('Could not load review', err);
    statsBox.innerHTML = '';
    formWrap.innerHTML = `<div class="danger-box">Could not load this review: ${escapeHtml(err.message)}</div>`;
  }
}

async function saveWeeklyReview(weekStart){
  const body = {
    qa: { missedSetupsCount: document.getElementById('rv-missed').value || null,
      bestTradeNote: document.getElementById('rv-bestnote').value,
      worstTradeNote: document.getElementById('rv-worstnote').value },
    reflection: {
      wentWell: document.getElementById('rv-wentwell').value,
      mistakesWeaknesses: document.getElementById('rv-mistakes').value,
      patternsNoticed: document.getElementById('rv-patterns').value,
      singleFocusNextWeek: document.getElementById('rv-focus').value,
    }
  };
  await apiPut('/reviews/weekly/'+weekStart, body);
  toast('Weekly review saved');
}
async function saveMonthlyReview(y,m){
  const body = {
    processScore: document.getElementById('rv-score').value || null,
    processScoreNotes: document.getElementById('rv-scorenotes').value,
    qa: { missedSetupsCount: document.getElementById('rv-missed').value || null },
    reflection: {
      bestTradeWinNote: document.getElementById('rv-bestwinnote').value,
      bestTradeLossNote: document.getElementById('rv-bestlossnote').value,
      mentalBarrier: document.getElementById('rv-barrier').value,
      fixPlan: document.getElementById('rv-fixplan').value,
      mostProud: document.getElementById('rv-proud').value,
      singleFocusNextMonth: document.getElementById('rv-focus').value,
    }
  };
  await apiPut(`/reviews/monthly/${y}/${m}`, body);
  toast('Monthly review saved');
}
async function saveQuarterlyReview(y,q){
  const body = {
    reflection: {
      wentWell: document.getElementById('rv-wentwell').value,
      mistakes: document.getElementById('rv-mistakes').value,
      patterns: document.getElementById('rv-patterns').value,
      biggestLesson: document.getElementById('rv-lesson').value,
      singleFocusNextQuarter: document.getElementById('rv-focus').value,
    }
  };
  await apiPut(`/reviews/quarterly/${y}/${q}`, body);
  toast('Quarterly review saved');
}
async function saveAnnualReview(y){
  const body = {
    deepReflection: {
      biggestWinNote: document.getElementById('rv-winnote').value,
      biggestLossNote: document.getElementById('rv-lossnote').value,
      growthAreas: document.getElementById('rv-growth').value,
      mentalGameEvolution: document.getElementById('rv-mental').value,
      systemsImprovements: document.getElementById('rv-systems').value,
      mostProud: document.getElementById('rv-proud').value,
      gratitude: document.getElementById('rv-gratitude').value,
      nextYearVision: document.getElementById('rv-vision').value,
      singleFocusNextYear: document.getElementById('rv-focus').value,
      freeform: document.getElementById('rv-freeform').value,
    }
  };
  await apiPut(`/reviews/annual/${y}`, body);
  toast('Annual review saved');
}

/* ============================================================
   REVIEWS — HISTORY (browse everything already saved)
============================================================ */
function monthName(m){
  return new Date(2000, m-1, 1).toLocaleString('default', { month: 'long' });
}
function historyField(label, value){
  if(!value) return '';
  return `<p class="hint" style="margin-top:.5rem;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}
function toggleHistoryItem(id){
  const el = document.getElementById(id);
  if(!el) return;
  const opening = el.style.display === 'none';
  el.style.display = opening ? 'block' : 'none';
  const row = document.getElementById(id+'-row');
  if(row) row.classList.toggle('open', opening);
}
function weeklyReviewCard(r){
  const qa = r.qa||{}, refl = r.reflection||{};
  return `<div class="card soft">
    ${historyField('Missed setups', qa.missedSetupsCount)}
    ${historyField('Best trade note', qa.bestTradeNote)}
    ${historyField('Worst trade note', qa.worstTradeNote)}
    ${historyField('What went well', refl.wentWell)}
    ${historyField('Mistakes / weaknesses', refl.mistakesWeaknesses)}
    ${historyField('Patterns noticed', refl.patternsNoticed)}
    ${historyField('Focus for next week', refl.singleFocusNextWeek)}
  </div>`;
}
function monthlyReviewCard(r){
  const qa = r.qa||{}, refl = r.reflection||{};
  return `<div class="card soft">
    ${historyField('Process score', r.processScore!=null ? r.processScore+'/10' : '')}
    ${historyField('Score notes', r.processScoreNotes)}
    ${historyField('Missed setups', qa.missedSetupsCount)}
    ${historyField('Standout win note', refl.bestTradeWinNote)}
    ${historyField('Standout loss note', refl.bestTradeLossNote)}
    ${historyField('Mental barrier', refl.mentalBarrier)}
    ${historyField('Fix plan', refl.fixPlan)}
    ${historyField('Most proud of', refl.mostProud)}
    ${historyField('Focus for next month', refl.singleFocusNextMonth)}
  </div>`;
}
function quarterlyReviewCard(r){
  const refl = r.reflection||{};
  return `<div class="card soft">
    ${historyField('What went well', refl.wentWell)}
    ${historyField('Mistakes', refl.mistakes)}
    ${historyField('Patterns', refl.patterns)}
    ${historyField('Biggest lesson', refl.biggestLesson)}
    ${historyField('Focus for next quarter', refl.singleFocusNextQuarter)}
  </div>`;
}
function annualReviewCard(r){
  const dr = r.deepReflection||{};
  return `<div class="card soft">
    ${historyField('Biggest win note', dr.biggestWinNote)}
    ${historyField('Biggest loss note', dr.biggestLossNote)}
    ${historyField('Growth areas', dr.growthAreas)}
    ${historyField('Mental game evolution', dr.mentalGameEvolution)}
    ${historyField('Systems improvements', dr.systemsImprovements)}
    ${historyField('Most proud of', dr.mostProud)}
    ${historyField('Gratitude', dr.gratitude)}
    ${historyField('Vision for next year', dr.nextYearVision)}
    ${historyField('Focus for next year', dr.singleFocusNextYear)}
    ${historyField('Freeform notes', dr.freeform)}
  </div>`;
}

// One clickable row for a saved review - collapsed by default, expands the
// full card in place when clicked. `preview` is a short one-line hint shown
// on the row itself (e.g. a focus note) so you don't have to open it to get
// a sense of what's inside.
function historyRow(id, dateLabel, preview, cardHtml){
  return `
    <div class="history-row" id="${id}-row" onclick="toggleHistoryItem('${id}')">
      <span class="history-row-date">${escapeHtml(dateLabel)}</span>
      <span class="hint" style="margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${escapeHtml(preview||'')}</span>
    </div>
    <div id="${id}" style="display:none;">${cardHtml}</div>
  `;
}

function groupAndSortDesc(list, keyFn){
  const groups = {};
  list.forEach(item=>{
    const k = keyFn(item);
    (groups[k] = groups[k]||[]).push(item);
  });
  return Object.keys(groups).sort().reverse().map(k=>({ key:k, items: groups[k] }));
}

function weeklyHistoryList(list){
  if(!list.length) return '<p class="hint" style="margin:0 0 1rem;">No weekly reviews saved yet.</p>';
  const groups = groupAndSortDesc(list, r=>r.weekStart.slice(0,7)); // group by YYYY-MM
  return groups.map(g=>{
    const [y,m] = g.key.split('-');
    const rows = g.items.map(r=>{
      const id = 'wk-'+r.weekStart;
      const preview = r.reflection?.singleFocusNextWeek || '';
      return historyRow(id, `${r.weekStart} → ${r.weekEnd}`, preview, weeklyReviewCard(r));
    }).join('');
    return `<div class="card"><h3 style="margin-top:0;">${monthName(parseInt(m,10))} ${y}</h3>${rows}</div>`;
  }).join('');
}
function monthlyHistoryList(list){
  if(!list.length) return '<p class="hint" style="margin:0 0 1rem;">No monthly reviews saved yet.</p>';
  const groups = groupAndSortDesc(list, r=>String(r.year));
  return groups.map(g=>{
    const rows = g.items.map(r=>{
      const id = 'mo-'+r.year+'-'+r.month;
      const preview = r.processScore!=null ? ('Score '+r.processScore+'/10') : (r.reflection?.singleFocusNextMonth||'');
      return historyRow(id, `${monthName(r.month)} ${r.year}`, preview, monthlyReviewCard(r));
    }).join('');
    return `<div class="card"><h3 style="margin-top:0;">${g.key}</h3>${rows}</div>`;
  }).join('');
}
function quarterlyHistoryList(list){
  if(!list.length) return '<p class="hint" style="margin:0 0 1rem;">No quarterly reviews saved yet.</p>';
  const groups = groupAndSortDesc(list, r=>String(r.year));
  return groups.map(g=>{
    const rows = g.items.map(r=>{
      const id = 'qt-'+r.year+'-'+r.quarter;
      const preview = r.reflection?.singleFocusNextQuarter || '';
      return historyRow(id, `Q${r.quarter} ${r.year}`, preview, quarterlyReviewCard(r));
    }).join('');
    return `<div class="card"><h3 style="margin-top:0;">${g.key}</h3>${rows}</div>`;
  }).join('');
}
function annualHistoryList(list){
  if(!list.length) return '<p class="hint" style="margin:0 0 1rem;">No annual reviews saved yet.</p>';
  const rows = list.map(r=>{
    const id = 'yr-'+r.year;
    const preview = r.deepReflection?.singleFocusNextYear || '';
    return historyRow(id, String(r.year), preview, annualReviewCard(r));
  }).join('');
  return `<div class="card"><h3 style="margin-top:0;">All Years</h3>${rows}</div>`;
}

async function loadReviewHistory(){
  const wrap = document.getElementById('review-history');
  wrap.innerHTML = '<p class="hint">Loading your saved reviews...</p>';
  try{
    const [weekly, monthly, quarterly, annual] = await Promise.all([
      apiGet('/reviews/weekly'),
      apiGet('/reviews/monthly'),
      apiGet('/reviews/quarterly'),
      apiGet('/reviews/annual'),
    ]);

    wrap.innerHTML = `
      <div class="card">
        <h2 style="margin:0;"><span class="eyebrow">WEEKLY</span> Saved Weekly Reviews</h2>
        <p class="hint" style="margin-top:.4rem;">Grouped by month — click a week to open it.</p>
      </div>
      ${weeklyHistoryList(weekly)}

      <div class="card">
        <h2 style="margin:0;"><span class="eyebrow">MONTHLY</span> Saved Monthly Reviews</h2>
        <p class="hint" style="margin-top:.4rem;">Grouped by year — click a month to open it.</p>
      </div>
      ${monthlyHistoryList(monthly)}

      <div class="card">
        <h2 style="margin:0;"><span class="eyebrow">QUARTERLY</span> Saved Quarterly Reviews</h2>
      </div>
      ${quarterlyHistoryList(quarterly)}

      <div class="card">
        <h2 style="margin:0;"><span class="eyebrow">ANNUAL</span> Saved Annual Reviews</h2>
      </div>
      ${annualHistoryList(annual)}
    `;
  }catch(err){
    console.error('Could not load review history', err);
    wrap.innerHTML = `<div class="danger-box">Could not load your review history: ${escapeHtml(err.message)}</div>`;
  }
}

/* ============================================================
   MEDITATION
============================================================ */
let MED_DURATION = 3*60, MED_REMAINING = 3*60, MED_TICK = null, MED_BREATH = null;

function setMedDuration(min, el){
  MED_DURATION = min*60; MED_REMAINING = MED_DURATION;
  document.querySelectorAll('#panel-med .pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  updateMedTimerDisplay();
}
function updateMedTimerDisplay(){
  const m = String(Math.floor(MED_REMAINING/60)).padStart(2,'0');
  const s = String(MED_REMAINING%60).padStart(2,'0');
  document.getElementById('medTimer').textContent = `${m}:${s}`;
}
function startMeditation(){
  const btn = document.getElementById('medStartBtn');
  const circle = document.getElementById('breathCircle');
  btn.disabled = true; btn.textContent = 'Session in progress...';
  MED_REMAINING = MED_DURATION;
  updateMedTimerDisplay();
  let breathIn = true;
  circle.textContent = 'Breathe in';
  circle.classList.add('inhale');
  MED_BREATH = setInterval(()=>{
    breathIn = !breathIn;
    circle.classList.toggle('inhale', breathIn);
    circle.classList.toggle('exhale', !breathIn);
    circle.textContent = breathIn ? 'Breathe in' : 'Breathe out';
  }, 4000);
  MED_TICK = setInterval(()=>{
    MED_REMAINING--;
    updateMedTimerDisplay();
    if(MED_REMAINING<=0) endMeditation();
  }, 1000);
}
function endMeditation(){
  clearInterval(MED_TICK); clearInterval(MED_BREATH);
  const circle = document.getElementById('breathCircle');
  circle.classList.remove('inhale','exhale');
  circle.textContent = 'Complete';
  document.getElementById('medStartBtn').disabled = false;
  document.getElementById('medStartBtn').textContent = 'Begin Session';
  document.getElementById('medPostCard').style.display = 'block';
  document.getElementById('medPostCard').scrollIntoView({behavior:'smooth', block:'center'});
}
async function saveMeditation(){
  await apiPost('/meditation', {
    date: todayStr(),
    time: new Date().toTimeString().slice(0,5),
    durationMin: MED_DURATION/60,
    pre: document.getElementById('medPre').value,
    moodBefore: document.getElementById('medMoodBefore').value,
    moodAfter: document.getElementById('medMoodAfter').value,
    post: document.getElementById('medPost').value,
  });
  document.getElementById('medPostCard').style.display = 'none';
  document.getElementById('medPre').value=''; document.getElementById('medPost').value='';
  document.getElementById('breathCircle').textContent = 'Ready';
  toast('Session saved');
  renderMedLog();
}
async function renderMedLog(){
  const log = await apiGet('/meditation?limit=10');
  const box = document.getElementById('medLog');
  if(!log.length){ box.innerHTML = `<p class="hint">No sessions logged yet.</p>`; return; }
  box.innerHTML = `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Duration</th><th>Mood Before → After</th><th>Note</th></tr></thead><tbody>
    ${log.map(s=>`<tr><td>${s.date} ${s.time||''}</td><td>${s.durationMin} min</td><td>${s.moodBefore} → ${s.moodAfter}</td><td>${escapeHtml(s.post||s.pre||'—')}</td></tr>`).join('')}
  </tbody></table></div>`;
}

/* ============================================================
   CALCULATOR — CRYPTO / POSITION MODE
============================================================ */
let CALC_MODE = 'crypto';
const PLATFORMS = [
  {name:'Variational', maker:0, taker:0},
  {name:'Extended', maker:0, taker:0.02},
  {name:'Hibachi', maker:0.02, taker:0.05},
  {name:'Nado', maker:0.02, taker:0.05},
  {name:'Binance', maker:0.02, taker:0.05},
  {name:'Custom', maker:0.1, taker:0.1},
];
function renderPlatforms(){
  document.getElementById('platformGrid').innerHTML = PLATFORMS.map((p,i)=>`
    <div class="radio-card ${i===0?'selected':''}" style="text-align:center;padding:.8rem;" id="plat-${i}" onclick="setPlatform(${i})">
      <div style="font-weight:700;">${p.name}</div>
      <div style="font-size:.8rem;color:var(--teal-deep);margin-top:.2rem;">${p.maker}% / ${p.taker}%</div>
    </div>`).join('');
}
function setPlatform(i){
  document.querySelectorAll('#platformGrid .radio-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('plat-'+i).classList.add('selected');
  document.getElementById('makerFee').value = PLATFORMS[i].maker;
  document.getElementById('takerFee').value = PLATFORMS[i].taker;
  calc();
}
function setCalcMode(mode){
  CALC_MODE = mode;
  document.getElementById('modeBtn-crypto').classList.toggle('active', mode==='crypto');
  document.getElementById('modeBtn-forex').classList.toggle('active', mode==='forex');
  document.getElementById('cryptoCalc').style.display = mode==='crypto' ? 'block':'none';
  document.getElementById('forexCalc').style.display = mode==='forex' ? 'block':'none';
  document.getElementById('modeHint').textContent = mode==='crypto'
    ? 'Position-size style calculation: leverage, funding, maker/taker fees on notional size.'
    : 'PIP-style calculation: risk % of account converted into lot size based on stop-loss distance.';
}
function calc(){
  const capital = parseFloat(document.getElementById('capital').value)||0;
  const leverage = parseFloat(document.getElementById('leverage').value)||1;
  const makerFee = parseFloat(document.getElementById('makerFee').value)||0;
  const takerFee = parseFloat(document.getElementById('takerFee').value)||0;
  const orderType = document.getElementById('orderType').value;
  const fundingRate = parseFloat(document.getElementById('fundingRate').value)||0;
  const holdHours = parseFloat(document.getElementById('holdHours').value)||0;
  const targetProfit = parseFloat(document.getElementById('targetProfit').value)||0;

  const positionSize = capital*leverage;
  const feeRate = orderType==='taker'?takerFee:makerFee;
  const openFee = positionSize*(feeRate/100);
  const closeFee = positionSize*(feeRate/100);
  const fundingPeriods = Math.floor(holdHours/8);
  const fundingFee = positionSize*(fundingRate/100)*fundingPeriods;
  const totalFees = openFee+closeFee+fundingFee;
  const grossProfit = positionSize*(targetProfit/100);
  const netProfit = grossProfit-totalFees;
  const breakeven = (totalFees/positionSize)*100;
  const roi = (netProfit/capital)*100;

  document.getElementById('feeBreakdown').innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Position Size</span><span>$${positionSize.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Opening Fee (${feeRate}%)</span><span>$${openFee.toFixed(4)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Closing Fee (${feeRate}%)</span><span>$${closeFee.toFixed(4)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Funding Fee (${fundingPeriods} periods)</span><span>$${fundingFee.toFixed(4)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-weight:700;"><span>Total Fees</span><span style="color:var(--coral);">$${totalFees.toFixed(4)}</span></div>
  `;
  document.getElementById('results').innerHTML = `
    <div class="result-box ${netProfit>0?'profit':'loss'}"><div class="result-val ${netProfit>0?'green':'red'}">$${netProfit.toFixed(2)}</div><div class="result-label">Net Profit</div></div>
    <div class="result-box ${roi>0?'profit':'loss'}"><div class="result-val ${roi>0?'green':'red'}">${roi.toFixed(2)}%</div><div class="result-label">ROI on Capital</div></div>
    <div class="result-box warn"><div class="result-val yellow">${breakeven.toFixed(4)}%</div><div class="result-label">Breakeven Move</div></div>
    <div class="result-box"><div class="result-val blue">$${totalFees.toFixed(4)}</div><div class="result-label">Total Fees</div></div>
  `;
}

/* ============================================================
   CALCULATOR — FOREX / PIP MODE
============================================================ */
function calcPip(){
  const capital = parseFloat(document.getElementById('fx-capital').value)||0;
  const riskPct = parseFloat(document.getElementById('fx-risk').value)||0;
  const slPips = parseFloat(document.getElementById('fx-sl').value)||1;
  const pipValue = parseFloat(document.getElementById('fx-pipval').value)||10;
  const tpPips = parseFloat(document.getElementById('fx-tp').value)||0;
  const pair = document.getElementById('fx-pair').value || 'Pair';

  const riskAmount = capital*(riskPct/100);
  const lots = slPips>0 && pipValue>0 ? riskAmount/(slPips*pipValue) : 0;
  const units = lots*100000;
  const rewardAmount = lots*tpPips*pipValue;
  const rr = riskAmount>0 ? (rewardAmount/riskAmount) : 0;

  document.getElementById('fxBreakdown').innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Pair</span><span>${escapeHtml(pair)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Risk Amount</span><span>$${riskAmount.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Position Size (lots)</span><span>${lots.toFixed(3)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Units</span><span>${units.toFixed(0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-weight:700;"><span>Potential Reward</span><span style="color:var(--mint);">$${rewardAmount.toFixed(2)}</span></div>
  `;
  document.getElementById('fxResults').innerHTML = `
    <div class="result-box loss"><div class="result-val red">$${riskAmount.toFixed(2)}</div><div class="result-label">Risking This Trade</div></div>
    <div class="result-box profit"><div class="result-val green">$${rewardAmount.toFixed(2)}</div><div class="result-label">Target Reward</div></div>
    <div class="result-box"><div class="result-val blue">${lots.toFixed(3)}</div><div class="result-label">Lot Size</div></div>
    <div class="result-box warn"><div class="result-val yellow">1 : ${rr.toFixed(2)}</div><div class="result-label">Risk / Reward</div></div>
  `;
}

/* ============================================================
   CALCULATOR — PAIRS TRADE
============================================================ */
function showCalcSub(which){
  document.querySelectorAll('.csub').forEach(el=>el.style.display='none');
  document.getElementById('calc-'+which).style.display='block';
  document.querySelectorAll('#panel-calc .subtabs .subtab').forEach(el=>el.classList.remove('active'));
  event.target.classList.add('active');
}
function calcPairs(){
  const capital = parseFloat(document.getElementById('p-capital').value)||100;
  const leverage = parseFloat(document.getElementById('p-leverage').value)||2;
  const aEntry = parseFloat(document.getElementById('p-btc-entry').value)||0;
  const bEntry = parseFloat(document.getElementById('p-eth-entry').value)||0;
  const aExit = parseFloat(document.getElementById('p-btc-exit').value)||0;
  const bExit = parseFloat(document.getElementById('p-eth-exit').value)||0;
  const feeRate = parseFloat(document.getElementById('p-fee').value)||0;
  const funding = parseFloat(document.getElementById('p-funding').value)||0;
  const hours = parseFloat(document.getElementById('p-hours').value)||24;

  const legSize = (capital/2)*leverage;
  const aPnl = aEntry ? ((aExit-aEntry)/aEntry)*legSize : 0;
  const bPnl = bEntry ? -((bExit-bEntry)/bEntry)*legSize : 0;
  const totalFees = legSize*2*(feeRate/100)*2;
  const fundPeriods = Math.floor(hours/8);
  const fundFee = legSize*2*(funding/100)*fundPeriods;
  const grossPnl = aPnl+bPnl;
  const netPnl = grossPnl-totalFees-fundFee;
  const roi = (netPnl/capital)*100;

  document.getElementById('pairs-breakdown').innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Long Asset A leg size</span><span>$${legSize.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Short Asset B leg size</span><span>$${legSize.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Asset A PnL</span><span style="color:${aPnl>=0?'var(--mint)':'var(--coral)'}">$${aPnl.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Asset B PnL (short)</span><span style="color:${bPnl>=0?'var(--mint)':'var(--coral)'}">$${bPnl.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Trading Fees</span><span style="color:var(--coral);">-$${totalFees.toFixed(4)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);"><span style="color:var(--dim);">Funding Fees (${fundPeriods} periods)</span><span style="color:var(--coral);">-$${fundFee.toFixed(4)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-weight:700;"><span>Net PnL</span><span style="color:${netPnl>=0?'var(--mint)':'var(--coral)'}">$${netPnl.toFixed(2)}</span></div>
  `;
  document.getElementById('pairs-results').innerHTML = `
    <div class="result-box ${netPnl>0?'profit':'loss'}"><div class="result-val ${netPnl>0?'green':'red'}">$${netPnl.toFixed(2)}</div><div class="result-label">Net Profit</div></div>
    <div class="result-box ${roi>0?'profit':'loss'}"><div class="result-val ${roi>0?'green':'red'}">${roi.toFixed(2)}%</div><div class="result-label">ROI on Capital</div></div>
  `;
  const verdict = document.getElementById('pairs-verdict');
  if(netPnl>0){
    verdict.textContent = `Trade is profitable after all fees. Net gain: $${netPnl.toFixed(2)} (${roi.toFixed(2)}% ROI)`;
    verdict.className='tip';
  } else {
    verdict.textContent = `Trade is not profitable after fees. Loss: $${Math.abs(netPnl).toFixed(2)}.`;
    verdict.className='danger-box';
  }
}

/* ============================================================
   LEARN SUBTABS
============================================================ */
function showLearnSub(which){
  document.querySelectorAll('.lsub').forEach(el=>el.style.display='none');
  document.getElementById('learn-'+which).style.display='block';
  document.querySelectorAll('#panel-learn .subtab').forEach(el=>el.classList.remove('active'));
  event.target.classList.add('active');
}

/* ============================================================
   SETTINGS
============================================================ */
let SETTINGS = null;

async function loadSettings(){
  renderProfileCard(CURRENT_USER);
  try{
    SETTINGS = await apiGet('/settings');
    document.getElementById('st-market').value = SETTINGS.preferences.defaultMarket;
    document.getElementById('st-tfstyle').value = SETTINGS.preferences.defaultTfStyle;
    document.getElementById('st-entrymodel').value = SETTINGS.preferences.defaultEntryModel;

    const g = SETTINGS.guardrails;
    document.getElementById('st-grd-enabled').checked = g.enabled;
    document.getElementById('st-grd-capital').value = g.accountCapital;
    document.getElementById('st-grd-riskpct').value = g.riskPerTradePct;
    document.getElementById('st-grd-maxtrades').value = g.maxTradesPerDay;
    document.getElementById('st-grd-maxdd').value = g.maxAccountDrawdownPct;
    document.getElementById('st-grd-maxdailyloss').value = g.maxDailyLossPct;
    document.getElementById('st-grd-maxdailyprofit').value = g.maxDailyProfitPct;

    updateRiskPreview();
  }catch(err){
    console.error('Could not load settings', err);
    toast('Could not load settings: '+err.message);
  }
}

function updateRiskPreview(){
  const capital = parseFloat(document.getElementById('st-grd-capital').value)||0;
  const riskPct = parseFloat(document.getElementById('st-grd-riskpct').value)||0;
  const riskAmount = (capital*riskPct/100).toFixed(2);
  document.getElementById('st-risk-preview').textContent =
    `At ${riskPct}% risk per trade on $${capital} capital, that's $${riskAmount} risked per trade — this is what the trade form will suggest.`;
}

async function saveSettings(){
  const body = {
    preferences: {
      defaultMarket: document.getElementById('st-market').value,
      defaultTfStyle: document.getElementById('st-tfstyle').value,
      defaultEntryModel: document.getElementById('st-entrymodel').value,
    },
    guardrails: {
      enabled: document.getElementById('st-grd-enabled').checked,
      accountCapital: parseFloat(document.getElementById('st-grd-capital').value)||0,
      riskPerTradePct: parseFloat(document.getElementById('st-grd-riskpct').value)||0,
      maxTradesPerDay: parseInt(document.getElementById('st-grd-maxtrades').value)||0,
      maxAccountDrawdownPct: parseFloat(document.getElementById('st-grd-maxdd').value)||0,
      maxDailyLossPct: parseFloat(document.getElementById('st-grd-maxdailyloss').value)||0,
      maxDailyProfitPct: parseFloat(document.getElementById('st-grd-maxdailyprofit').value)||0,
    }
  };
  SETTINGS = await apiPut('/settings', body);
  toast('Settings saved');
}

/* ============================================================
   PROFILE — display name + picture
============================================================ */
function resizeImageToDataUrl(file, maxDim, quality){
  maxDim = maxDim || 400; quality = quality || 0.85;
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w>h){ if(w>maxDim){ h = Math.round(h*maxDim/w); w = maxDim; } }
        else { if(h>maxDim){ w = Math.round(w*maxDim/h); h = maxDim; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = ()=>reject(new Error('Could not read that image'));
      img.src = e.target.result;
    };
    reader.onerror = ()=>reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

async function onProfilePicSelected(event){
  const file = event.target.files[0];
  event.target.value = '';
  if(!file) return;
  try{
    const dataUrl = await resizeImageToDataUrl(file);
    const data = await apiSend('PUT','/auth/profile-picture', { imageDataUrl: dataUrl });
    renderAccountBar(data.user);
    renderProfileCard(data.user);
    toast('Profile picture updated');
  }catch(err){
    toast('Could not update profile picture');
  }
}
async function removeProfilePicture(){
  try{
    const data = await apiSend('DELETE','/auth/profile-picture');
    renderAccountBar(data.user);
    renderProfileCard(data.user);
    toast('Profile picture removed');
  }catch(err){ toast('Could not remove picture'); }
}
async function saveProfileName(){
  const name = document.getElementById('st-name').value;
  const data = await apiSend('PUT','/auth/profile', { name });
  renderAccountBar(data.user);
  toast('Name saved');
}

/* ============================================================
   INSIGHTS — EQUITY CURVE
============================================================ */
async function loadEquityCurve(){
  const wrap = document.getElementById('equityChartWrap');
  try{
    const points = await apiGet('/stats/equity-curve');
    if(!points.length){ wrap.innerHTML = '<p class="hint">No trades logged yet — the equity curve fills in as you journal trades.</p>'; return; }
    const last = points[points.length-1];
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--dim);font-family:'JetBrains Mono',monospace;margin-bottom:.4rem;">
        <span>Start: $0</span>
        <span>Now: $${last.equity} · DD $${last.drawdown}</span>
      </div>
      ${renderEquitySvg(points)}
    `;
  }catch(err){
    console.error('Could not load equity curve', err);
    wrap.innerHTML = `<p class="hint">Could not load the equity curve: ${escapeHtml(err.message)}</p>`;
  }
}

function renderEquitySvg(points){
  const W = 900, H = 260, PAD = 20;
  const equities = points.map(p=>p.equity);
  const peaks = points.map(p=>p.peak);
  const minY = Math.min(0, ...equities);
  const maxY = Math.max(0, ...peaks, ...equities);
  const range = (maxY-minY) || 1;

  const xFor = i => PAD + (i/(Math.max(points.length-1,1))) * (W-2*PAD);
  const yFor = v => H-PAD - ((v-minY)/range) * (H-2*PAD);

  const equityPath = points.map((p,i)=> (i===0?'M':'L') + xFor(i).toFixed(1) + ' ' + yFor(p.equity).toFixed(1)).join(' ');
  const peakPath = points.map((p,i)=> (i===0?'M':'L') + xFor(i).toFixed(1) + ' ' + yFor(p.peak).toFixed(1)).join(' ');
  const zeroY = yFor(0).toFixed(1);

  const last = points[points.length-1];
  const lastX = xFor(points.length-1).toFixed(1);

  return `
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;" xmlns="http://www.w3.org/2000/svg">
    <line x1="${PAD}" y1="${zeroY}" x2="${W-PAD}" y2="${zeroY}" stroke="#DCE8F0" stroke-width="1"/>
    <path d="${peakPath}" fill="none" stroke="#FFB020" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>
    <path d="${equityPath}" fill="none" stroke="${last.equity>=0?'#0FB5AE':'#FF6B6B'}" stroke-width="2.5"/>
    <circle cx="${lastX}" cy="${yFor(last.equity).toFixed(1)}" r="4" fill="${last.equity>=0?'#0FB5AE':'#FF6B6B'}"/>
  </svg>`;
}

/* ============================================================
   INSIGHTS — NEWS / ECONOMIC CALENDAR
============================================================ */
async function loadNews(){
  const wrap = document.getElementById('newsWrap');
  wrap.innerHTML = '<p class="hint">Loading calendar...</p>';
  try{
    const data = await apiGet('/news/calendar');
    if(data.error){
      wrap.innerHTML = `<div class="warn-box">${escapeHtml(data.error)} Try refreshing in a bit.</div>`;
      return;
    }
    if(!data.events.length){
      wrap.innerHTML = '<p class="hint">No events returned right now.</p>';
      return;
    }
    wrap.innerHTML = `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Country</th><th>Event</th><th>Impact</th><th>Forecast</th><th>Previous</th></tr></thead><tbody>
      ${data.events.slice(0,40).map(e=>`<tr>
        <td>${escapeHtml(e.date)}</td>
        <td>${escapeHtml(e.country)}</td>
        <td>${escapeHtml(e.title)}</td>
        <td><span class="tag ${e.impact==='High'?'tag-r':e.impact==='Medium'?'tag-y':'tag-b'}">${escapeHtml(e.impact||'—')}</span></td>
        <td>${escapeHtml(String(e.forecast))}</td>
        <td>${escapeHtml(String(e.previous))}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  } catch(err){
    wrap.innerHTML = `<div class="warn-box">Could not load the calendar feed.</div>`;
  }
}

/* ============================================================
   INIT
============================================================ */
(async function init(){
  initGoogleSignIn(); // fire-and-forget - shows the Google button on the login screen if configured
  const token = getToken();
  if(!token){ showAuthScreen(); return; }
  try{
    const data = await apiGet('/auth/me');
    await bootApp(data.user);
  }catch(e){
    // apiGet already redirects to the auth screen on 401; anything else, play it safe and show login too
    showAuthScreen();
  }
})();