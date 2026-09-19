const people = window.ER_PEOPLE || [];
const $ = (s, root=document) => root.querySelector(s);
const grid = $('#grid');
const search = $('#searchInput');
const dialog = $('#detailDialog');
const detail = $('#detail');
const loadMore = $('#loadMore');
let filter = 'all';
let sort = 'featured';
let limit = 32;
let current = [];

const normalize = value => (value || '').toLowerCase().normalize('NFKC').replace(/[“”'’·,，\s-]/g,'');
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function imageBlock(person, cls='') {
  const fallback = `<span class="monogram">${escapeHtml((person.zh || person.name).slice(0,1))}</span>`;
  if (!person.image) return `<div class="${cls}">${fallback}</div>`;
  return `<div class="${cls}"><img src="${escapeHtml(person.image)}" alt="${escapeHtml(person.zh)}" loading="lazy" onerror="this.replaceWith(this.nextElementSibling)">${fallback}</div>`;
}

function getFiltered() {
  const q = normalize(search.value);
  const terms = q ? q.split(/\s+/) : [];
  let list = people.filter(p => filter === 'all' || p.type === filter).filter(p => {
    const hay = normalize([p.zh,p.name,p.region,p.location,p.role,p.story].join(' '));
    return terms.every(t => hay.includes(t));
  });
  if (sort === 'az') list.sort((a,b) => a.name.localeCompare(b.name));
  if (sort === 'region') list.sort((a,b) => a.region.localeCompare(b.region,'zh-CN') || a.name.localeCompare(b.name));
  return list;
}

function render() {
  current = getFiltered();
  const shown = current.slice(0,limit);
  grid.innerHTML = shown.map((p,i) => `<article class="card" style="animation-delay:${Math.min(i,15)*22}ms">
    ${imageBlock(p,'portrait')}
    <span class="type-badge">${p.type === 'npc' ? '旅途人物' : '首领'}</span>
    <div class="card-body">
      <div class="card-location">${escapeHtml(p.region)} · ${escapeHtml(p.role)}</div>
      <button class="name-btn" data-id="${p.id}" aria-label="查看${escapeHtml(p.zh)}的故事">${escapeHtml(p.zh)}<span class="name-en">${escapeHtml(p.name)}</span></button>
      <span class="card-arrow" aria-hidden="true">›</span>
    </div>
  </article>`).join('');
  $('#resultCount').textContent = `找到 ${current.length} 位人物`;
  $('#empty').hidden = current.length !== 0;
  loadMore.hidden = current.length <= limit;
  loadMore.textContent = current.length > limit ? `继续展开（余 ${current.length-limit}）` : '';
}

function openPerson(id, pushHash=true) {
  const p = people.find(x => x.id === id);
  if (!p) return;
  const related = (p.related || []).map(rid => people.find(x => x.id === rid)).filter(Boolean);
  detail.innerHTML = `<div class="detail-hero">
    ${imageBlock(p,'detail-image')}
    <div class="detail-copy">
      <div class="detail-kicker">${p.type === 'npc' ? '旅途人物档案' : '首领档案'}</div>
      <h2 id="detailTitle">${escapeHtml(p.zh)}</h2>
      <div class="detail-en">${escapeHtml(p.name)}</div>
      <div class="detail-story">${escapeHtml(p.story)}</div>
      ${p.quote ? `<div class="quote">“${escapeHtml(p.quote)}”</div>` : ''}
      <div class="detail-meta"><div><small>身份</small><span>${escapeHtml(p.role)}</span></div><div><small>踪迹</small><span>${escapeHtml(p.location)}</span></div></div>
      ${p.drops?.length ? `<div class="drops"><b>战利品</b> · ${p.drops.map(escapeHtml).join(' / ')}</div>` : ''}
    </div>
  </div>
  <div class="relation-section"><div class="relation-title">命运交汇 · 关联人物</div><div class="relations">${related.length ? related.map(r => `<button class="relation" data-related="${r.id}">${escapeHtml(r.zh)} · ${escapeHtml(r.name)}</button>`).join('') : '<span class="detail-en">暂无明确关联记录</span>'}</div></div>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  if (pushHash) history.replaceState(null,'',`#person=${encodeURIComponent(id)}`);
}

grid.addEventListener('click', e => {
  const btn = e.target.closest('[data-id]');
  if (btn) openPerson(btn.dataset.id);
});
detail.addEventListener('click', e => {
  const btn = e.target.closest('[data-related]');
  if (btn) openPerson(btn.dataset.related);
});
$('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => history.replaceState(null,'',location.pathname + location.search));
search.addEventListener('input', () => { limit=32; render(); });
document.addEventListener('keydown', e => { if (e.key==='/' && document.activeElement!==search) { e.preventDefault(); search.focus(); } });
$('.tabs').addEventListener('click', e => {
  const btn=e.target.closest('[data-filter]'); if(!btn) return;
  filter=btn.dataset.filter; limit=32;
  document.querySelectorAll('[data-filter]').forEach(x => {x.classList.toggle('active',x===btn);x.setAttribute('aria-selected',x===btn)});
  render();
});
$('#sortSelect').addEventListener('change', e => {sort=e.target.value;render();});
loadMore.addEventListener('click', () => {limit += 32;render();});
$('#randomBtn').addEventListener('click', () => openPerson(people[Math.floor(Math.random()*people.length)].id));
$('#totalCount').textContent=people.length;
render();
const deepLink=new URLSearchParams(location.hash.replace(/^#/, '')).get('person');
if(deepLink) openPerson(deepLink,false);

// Expose the visible search and detail journey to browsers that support WebMCP.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  Promise.resolve(document.modelContext.registerTool({
    name:'search_characters', title:'搜索交界地人物',
    description:'按中文名、英文名、地点或故事关键词搜索人物，并同步更新页面结果。',
    inputSchema:{type:'object',properties:{query:{type:'string'},type:{type:'string',enum:['all','npc','boss']}},required:['query'],additionalProperties:false},
    annotations:{readOnlyHint:true,untrustedContentHint:false},
    execute(input){
      if(!input || typeof input.query!=='string') throw new Error('query 必须是字符串');
      search.value=input.query; filter=input.type||'all'; limit=32;
      document.querySelectorAll('[data-filter]').forEach(x=>{const on=x.dataset.filter===filter;x.classList.toggle('active',on);x.setAttribute('aria-selected',on)});
      render(); search.scrollIntoView({behavior:'smooth',block:'center'});
      return {count:current.length,characters:current.slice(0,10).map(p=>({id:p.id,name:p.zh,englishName:p.name}))};
    }
  },{signal:lifecycle.signal})).catch(()=>{});
  Promise.resolve(document.modelContext.registerTool({
    name:'open_character', title:'打开人物档案',
    description:'用精确人物 ID 打开该人物的故事与关联人物。',
    inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},
    annotations:{readOnlyHint:true,untrustedContentHint:false},
    execute(input){const p=people.find(x=>x.id===input?.id);if(!p)throw new Error('未找到该人物');openPerson(p.id);return {id:p.id,name:p.zh,relatedCount:(p.related||[]).length};}
  },{signal:lifecycle.signal})).catch(()=>{});
}
