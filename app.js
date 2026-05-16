const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentPage = 'receipts';
let uploadedImageBase64 = null;
let uploadedMediaType = null;
let ocrResult = null;

// Auth

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0) === (tab === 'login'));
  });
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) errEl.textContent = error.message;
}

async function register() {
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';
  const { error } = await sb.auth.signUp({ email, password });
  if (error) errEl.textContent = error.message;
  else { errEl.style.color = 'green'; errEl.textContent = '註冊成功！請確認 Email 後登入'; }
}

async function logout() {
  await sb.auth.signOut();
}

sb.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    navigate('receipts');
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

// Navigation

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const pages = { receipts: renderReceipts, upload: renderUpload, stats: renderStats, groups: renderGroups };
  pages[page]?.();
}

// Receipts

async function renderReceipts() {
  document.getElementById('page-title').textContent = '帳單';
  document.getElementById('topbar-action').style.display = 'none';
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>載入中...</div>';

  const { data: receipts, error } = await sb
    .from('receipts')
    .select('*, receipt_items(*), groups(name)')
    .order('receipt_date', { ascending: false })
    .order('receipt_time', { ascending: false });

  if (error) { content.innerHTML = `<div class="error">${error.message}</div>`; return; }
  if (!receipts.length) {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>還沒有帳單<br>點下方📸拍照開始記帳</p></div>';
    return;
  }
  content.innerHTML = receipts.map(r => receiptCard(r)).join('');
}

function receiptCard(r) {
  const groupName = r.groups?.name;
  const splitAmt = r.is_split ? (r.total_amount / 2).toFixed(2) : null;
  return `
  <div class="card" onclick="showReceiptDetail('${r.id}')">
    <div class="card-header">
      <div>
        <div class="card-title">${r.merchant_name || '未知商家'}</div>
        <div class="card-meta">${r.receipt_date} ${r.receipt_time?.slice(0,5) || ''}</div>
      </div>
      <div style="text-align:right">
        ${r.is_split ? '<span class="badge badge-split">平分</span>' : ''}
        ${groupName ? `<span class="badge badge-group">👥 ${groupName}</span>` : '<span class="badge badge-personal">個人</span>'}
      </div>
    </div>
    <div class="amount">${r.currency} ${Number(r.total_amount).toLocaleString()}</div>
    ${splitAmt ? `<div class="amount-small">平分各付 ${r.currency} ${Number(splitAmt).toLocaleString()}</div>` : ''}
  </div>`;
}

async function showReceiptDetail(id) {
  const { data: r } = await sb
    .from('receipts')
    .select('*, receipt_items(*), groups(name)')
    .eq('id', id)
    .single();

  const isOwn = r.user_id === currentUser.id;
  const splitAmt = r.is_split ? (r.total_amount / 2).toFixed(2) : null;
  const items = r.receipt_items || [];

  showModal(`
    <div class="modal-header">
      <div class="modal-title">${r.merchant_name || '未知商家'}</div>
      <button class="close-btn" onclick="closeModal()">✕</button>
    </div>
    <div class="receipt-detail-header">
      ${r.is_split ? '<span class="badge badge-split">平分帳單</span>' : ''}
      ${r.groups?.name ? `<span class="badge badge-group">👥 ${r.groups.name}</span>` : '<span class="badge badge-personal">個人</span>'}
    </div>
    <div class="detail-field">日期：<span>${r.receipt_date}</span></div>
    <div class="detail-field">時間：<span>${r.receipt_time?.slice(0,5) || '-'}</span></div>
    <div class="detail-field">貨幣：<span>${r.currency}</span></div>
    ${r.notes ? `<div class="detail-field">備註：<span>${r.notes}</span></div>` : ''}
    <div class="divider"></div>
    ${items.length ? `
    <div class="section-title">品項明細</div>
    <div class="items-list">
      ${items.map(it => `
        <div class="item-row">
          <span class="item-name">${it.name}</span>
          <span class="item-amount">${r.currency} ${Number(it.amount).toLocaleString()}</span>
        </div>`).join('')}
      <div class="total-row">
        <span>合計</span>
        <span>${r.currency} ${Number(r.total_amount).toLocaleString()}</span>
      </div>
      ${splitAmt ? `<div class="split-row"><span>÷2 各付</span><span>${r.currency} ${Number(splitAmt).toLocaleString()}</span></div>` : ''}
    </div>` : `
    <div class="total-row" style="border-radius:12px;border:1px solid var(--border)">
      <span>合計</span><span>${r.currency} ${Number(r.total_amount).toLocaleString()}</span>
    </div>
    ${splitAmt ? `<div class="split-row" style="border-radius:0 0 12px 12px;border:1px solid #fde68a;border-top:none"><span>÷2 各付</span><span>${r.currency} ${Number(splitAmt).toLocaleString()}</span></div>` : ''}`}
    ${r.image_url ? `<img src="${await getImageUrl(r.image_url)}" style="width:100%;border-radius:12px;margin-top:12px">` : ''}
    ${isOwn ? `
    <div class="divider"></div>
    <button class="btn btn-danger btn-sm" onclick="deleteReceipt('${r.id}')">🗑 刪除此帳單</button>` : ''}
  `);
}

async function getImageUrl(path) {
  const { data } = await sb.storage.from('receipts').createSignedUrl(path, 3600);
  return data?.signedUrl || '';
}

async function deleteReceipt(id) {
  if (!confirm('確定要刪除這筆帳單嗎？')) return;
  await sb.from('receipt_items').delete().eq('receipt_id', id);
  await sb.from('receipts').delete().eq('id', id);
  closeModal();
  renderReceipts();
}

// Upload

function renderUpload() {
  document.getElementById('page-title').textContent = '拍照記帳';
  document.getElementById('topbar-action').style.display = 'none';
  uploadedImageBase64 = null;
  ocrResult = null;
  document.getElementById('page-content').innerHTML = `
    <div class="upload-area" onclick="document.getElementById('file-input').click()" id="upload-area">
      <div class="upload-icon">📷</div>
      <div class="upload-text">點擊拍照或選擇照片</div>
      <div class="upload-text" style="font-size:12px;margin-top:4px">支援 8 種語言帳單識別</div>
    </div>
    <input type="file" id="file-input" accept="image/*" capture="environment" style="display:none" onchange="handleFileSelect(event)">
    <div id="ocr-section"></div>
  `;

  const ua = document.getElementById('upload-area');
  ua.addEventListener('dragover', e => { e.preventDefault(); ua.classList.add('dragover'); });
  ua.addEventListener('dragleave', () => ua.classList.remove('dragover'));
  ua.addEventListener('drop', e => { e.preventDefault(); ua.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
}

function handleFileSelect(e) { handleFiles(e.target.files); }

function handleFiles(files) {
  const file = files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      uploadedImageBase64 = compressed.split(',')[1];
      uploadedMediaType = 'image/jpeg';
      document.getElementById('upload-area').innerHTML = `<img src="${compressed}" class="preview-img">`;
      startOCR(uploadedImageBase64, 'image/jpeg');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function startOCR(base64, mediaType) {
  const section = document.getElementById('ocr-section');
  section.innerHTML = '<div class="loading"><div class="spinner"></div>AI 識別帳單中...</div>';

  try {
    const session = await sb.auth.getSession();
    const token = session.data.session?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(OCR_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ image_base64: base64, media_type: mediaType })
    });
    const data = await res.json();
    if (data.error) { section.innerHTML = `<div class="error">識別失敗：${data.error}</div>`; return; }
    ocrResult = data;
    renderOCRResult(data);
  } catch (e) {
    section.innerHTML = `<div class="error">連線失敗：${e.message}</div>`;
  }
}

function renderOCRResult(data) {
  const section = document.getElementById('ocr-section');
  const items = data.items || [];
  section.innerHTML = `
    <div class="card">
      <div class="section-title">識別結果</div>
      <div class="form-group">
        <label>商家名稱</label>
        <input type="text" id="r-merchant" value="${data.merchant_name || ''}">
      </div>
      <div style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label>日期</label>
          <input type="text" id="r-date" value="${data.date || ''}">
        </div>
        <div class="form-group" style="flex:1">
          <label>時間</label>
          <input type="text" id="r-time" value="${data.time || ''}">
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label>貨幣</label>
          <input type="text" id="r-currency" value="${data.currency || 'TWD'}">
        </div>
        <div class="form-group" style="flex:1">
          <label>總金額</label>
          <input type="number" id="r-total" value="${data.total || 0}" step="0.01">
        </div>
      </div>
      ${items.length ? `
      <div class="section-title">品項明細</div>
      <div class="items-list" id="items-container">
        ${items.map((it, i) => `
          <div class="item-row">
            <input type="text" value="${it.name}" style="flex:1;border:none;background:none;font-size:14px;padding:0" onchange="ocrResult.items[${i}].name=this.value">
            <input type="number" value="${it.amount}" style="width:90px;border:none;background:none;text-align:right;font-size:14px;font-weight:500;padding:0" step="0.01" onchange="ocrResult.items[${i}].amount=parseFloat(this.value)">
          </div>`).join('')}
      </div>` : ''}
      <div class="toggle-row">
        <span style="font-weight:500">平分帳單</span>
        <label class="toggle">
          <input type="checkbox" id="r-split">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div id="split-info" style="display:none;color:#854d0e;font-size:13px;margin-bottom:12px">
        ÷2 各付 <span id="split-amt"></span>
      </div>
    </div>
    <div class="card">
      <div class="section-title">加入群組（選填）</div>
      <select id="r-group">
        <option value="">個人帳單（不加入群組）</option>
      </select>
    </div>
    <div class="form-group">
      <label>備註（選填）</label>
      <textarea id="r-notes" rows="2" placeholder="輸入備註..."></textarea>
    </div>
    <button class="btn btn-primary" onclick="saveReceipt()">💾 儲存帳單</button>
    <div id="save-error" class="error"></div>
  `;

  const totalInput = document.getElementById('r-total');
  const splitInfo = document.getElementById('split-info');
  const splitAmt = document.getElementById('split-amt');
  const updateSplit = () => {
    const total = parseFloat(totalInput.value) || 0;
    const currency = document.getElementById('r-currency').value;
    splitAmt.textContent = `${currency} ${(total / 2).toFixed(2)}`;
  };
  document.getElementById('r-split').addEventListener('change', e => {
    splitInfo.style.display = e.target.checked ? 'block' : 'none';
    updateSplit();
  });
  totalInput.addEventListener('input', updateSplit);

  loadGroupsForSelect();
}

async function loadGroupsForSelect() {
  const { data } = await sb.from('group_members')
    .select('groups(id, name)')
    .eq('user_id', currentUser.id);
  const select = document.getElementById('r-group');
  if (!select || !data) return;
  data.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.groups.id;
    opt.textContent = `👥 ${m.groups.name}`;
    select.appendChild(opt);
  });
}

async function saveReceipt() {
  const errEl = document.getElementById('save-error');
  errEl.textContent = '';
  const merchant = document.getElementById('r-merchant').value.trim();
  const date = document.getElementById('r-date').value.trim();
  const time = document.getElementById('r-time').value.trim();
  const currency = document.getElementById('r-currency').value.trim() || 'TWD';
  const total = parseFloat(document.getElementById('r-total').value);
  const isSplit = document.getElementById('r-split').checked;
  const groupId = document.getElementById('r-group').value || null;
  const notes = document.getElementById('r-notes').value.trim();

  if (!date || !total) { errEl.textContent = '請填寫日期和金額'; return; }

  let imageUrl = null;
  if (uploadedImageBase64) {
    const blob = base64ToBlob(uploadedImageBase64, uploadedMediaType);
    const fileName = `${currentUser.id}/${Date.now()}.jpg`;
    const { error: upErr } = await sb.storage.from('receipts').upload(fileName, blob);
    if (!upErr) imageUrl = fileName;
  }

  const { data: receipt, error } = await sb.from('receipts').insert({
    user_id: currentUser.id,
    group_id: groupId,
    image_url: imageUrl,
    receipt_date: date,
    receipt_time: time || '00:00:00',
    merchant_name: merchant,
    total_amount: total,
    currency,
    is_split: isSplit,
    notes: notes || null,
  }).select().single();

  if (error) { errEl.textContent = error.message; return; }

  const items = ocrResult?.items || [];
  if (items.length) {
    await sb.from('receipt_items').insert(
      items.map(it => ({ receipt_id: receipt.id, name: it.name, amount: it.amount }))
    );
  }

  navigate('receipts');
}

function base64ToBlob(base64, type) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}

// Stats

let statsPeriod = 'month';

async function renderStats() {
  document.getElementById('page-title').textContent = '統計';
  document.getElementById('topbar-action').style.display = 'none';
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="period-tabs">
      <button class="period-tab ${statsPeriod === 'day' ? 'active' : ''}" onclick="setStatsPeriod('day')">今日</button>
      <button class="period-tab ${statsPeriod === 'week' ? 'active' : ''}" onclick="setStatsPeriod('week')">本週</button>
      <button class="period-tab ${statsPeriod === 'month' ? 'active' : ''}" onclick="setStatsPeriod('month')">本月</button>
    </div>
    <div id="stats-content"><div class="loading"><div class="spinner"></div>計算中...</div></div>
  `;
  loadStats();
}

function setStatsPeriod(p) { statsPeriod = p; renderStats(); }

async function loadStats() {
  const now = new Date();
  let from;
  if (statsPeriod === 'day') from = now.toISOString().split('T')[0];
  else if (statsPeriod === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay());
    from = d.toISOString().split('T')[0];
  } else {
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  const { data } = await sb.from('receipts')
    .select('total_amount, currency, is_split, group_id')
    .eq('user_id', currentUser.id)
    .gte('receipt_date', from);

  if (!data) return;

  const total = data.reduce((s, r) => s + Number(r.total_amount), 0);
  const splitTotal = data.filter(r => r.is_split).reduce((s, r) => s + Number(r.total_amount) / 2, 0);
  const splitCount = data.filter(r => r.is_split).length;
  const personalTotal = data.filter(r => !r.group_id).reduce((s, r) => s + Number(r.total_amount), 0);
  const groupTotal = data.filter(r => r.group_id).reduce((s, r) => s + Number(r.total_amount), 0);
  const label = statsPeriod === 'day' ? '今日' : statsPeriod === 'week' ? '本週' : '本月';

  document.getElementById('stats-content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">${label}總花費</div>
        <div class="stat-value">${total.toLocaleString()}</div>
        <div class="stat-sub">${data.length} 筆帳單</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">平分帳單合計</div>
        <div class="stat-value">${splitTotal.toLocaleString()}</div>
        <div class="stat-sub">共 ${splitCount} 筆（你付一半）</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">個人帳單</div>
        <div class="stat-value">${personalTotal.toLocaleString()}</div>
        <div class="stat-sub">不含群組</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">群組帳單</div>
        <div class="stat-value">${groupTotal.toLocaleString()}</div>
        <div class="stat-sub">群組消費</div>
      </div>
    </div>
    ${data.length === 0 ? '<div class="empty-state"><div class="empty-icon">📊</div><p>此時段尚無記錄</p></div>' : ''}
  `;
}

// Groups

async function renderGroups() {
  document.getElementById('page-title').textContent = '群組';
  const btn = document.getElementById('topbar-action');
  btn.style.display = 'flex';
  btn.textContent = '➕';
  btn.onclick = showCreateGroup;

  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>載入中...</div>';

  const { data } = await sb.from('group_members')
    .select('groups(id, name, invite_code, created_by), joined_at')
    .eq('user_id', currentUser.id);

  if (!data?.length) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>還沒有群組<br>點右上角 ➕ 建立群組</p>
      </div>
      <button class="btn btn-outline" onclick="showJoinGroup()">🔑 用邀請碼加入群組</button>`;
    return;
  }

  content.innerHTML = `
    ${data.map(m => {
      const g = m.groups;
      const isOwner = g.created_by === currentUser.id;
      return `
      <div class="card">
        <div class="group-card">
          <div class="group-info">
            <div class="card-title">👥 ${g.name}</div>
            <div class="card-meta">邀請碼：<span class="invite-code">${g.invite_code}</span></div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline btn-sm" onclick="copyCode('${g.invite_code}')">複製</button>
            ${isOwner
              ? `<button class="btn btn-danger btn-sm" onclick="deleteGroup('${g.id}')">刪除</button>`
              : `<button class="btn btn-outline btn-sm" onclick="leaveGroup('${g.id}')">離開</button>`}
          </div>
        </div>
      </div>`;
    }).join('')}
    <button class="btn btn-outline" onclick="showJoinGroup()" style="margin-top:4px">🔑 用邀請碼加入群組</button>
  `;
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => alert(`已複製邀請碼：${code}`));
}

function showCreateGroup() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">建立群組</div>
      <button class="close-btn" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label>群組名稱</label>
      <input type="text" id="g-name" placeholder="例：日本旅遊 2026">
    </div>
    <button class="btn btn-primary" onclick="createGroup()">建立</button>
    <div id="g-error" class="error"></div>
  `);
}

async function createGroup() {
  const name = document.getElementById('g-name').value.trim();
  const err = document.getElementById('g-error');
  if (!name) { err.textContent = '請輸入群組名稱'; return; }

  const { data: group, error } = await sb.from('groups')
    .insert({ name, created_by: currentUser.id }).select().single();
  if (error) { err.textContent = error.message; return; }

  await sb.from('group_members').insert({ group_id: group.id, user_id: currentUser.id });
  closeModal();
  renderGroups();
}

function showJoinGroup() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">加入群組</div>
      <button class="close-btn" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label>邀請碼</label>
      <input type="text" id="j-code" placeholder="輸入 8 位邀請碼" maxlength="8" style="letter-spacing:2px;font-size:20px;text-align:center">
    </div>
    <button class="btn btn-primary" onclick="joinGroup()">加入</button>
    <div id="j-error" class="error"></div>
  `);
}

async function joinGroup() {
  const code = document.getElementById('j-code').value.trim().toLowerCase();
  const err = document.getElementById('j-error');
  if (code.length !== 8) { err.textContent = '請輸入 8 位邀請碼'; return; }

  const { data: group } = await sb.from('groups').select('id').eq('invite_code', code).single();
  if (!group) { err.textContent = '找不到此邀請碼'; return; }

  const { error } = await sb.from('group_members')
    .insert({ group_id: group.id, user_id: currentUser.id });
  if (error?.code === '23505') { err.textContent = '你已在此群組中'; return; }
  if (error) { err.textContent = error.message; return; }

  closeModal();
  renderGroups();
}

async function leaveGroup(groupId) {
  if (!confirm('確定要離開這個群組嗎？')) return;
  await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id);
  renderGroups();
}

async function deleteGroup(groupId) {
  if (!confirm('確定要刪除這個群組嗎？所有群組帳單將變成個人帳單。')) return;
  await sb.from('groups').delete().eq('id', groupId);
  renderGroups();
}

// Modal

function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
