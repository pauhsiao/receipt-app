const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: window.localStorage,
  }
});

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

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  const opening = menu.style.display === 'none';
  menu.style.display = opening ? 'block' : 'none';
  if (opening) {
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!document.getElementById('user-btn').contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }
}

async function logout() {
  document.getElementById('user-menu').style.display = 'none';
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
    closeFabMenu();
    const fab = document.getElementById('fab-add');
    if (fab) fab.style.display = 'none';
  }
});

// Navigation

function navigate(page) {
  currentPage = page;
  closeFabMenu();
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const fab = document.getElementById('fab-add');
  if (fab) fab.style.display = page === 'receipts' ? 'flex' : 'none';
  const pages = { receipts: renderReceipts, upload: renderUpload, stats: renderStats, groups: renderGroups };
  pages[page]?.();
}

function toggleFabMenu() {
  const menu = document.getElementById('fab-menu');
  const backdrop = document.getElementById('fab-backdrop');
  const fab = document.getElementById('fab-add');
  const isOpen = menu.style.display !== 'none' && menu.style.display !== '';
  if (isOpen) {
    closeFabMenu();
  } else {
    menu.style.display = 'flex';
    backdrop.style.display = 'block';
    fab.textContent = '✕';
    fab.style.transform = 'rotate(45deg)';
  }
}

function closeFabMenu() {
  const menu = document.getElementById('fab-menu');
  const backdrop = document.getElementById('fab-backdrop');
  const fab = document.getElementById('fab-add');
  if (menu) menu.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
  if (fab) { fab.textContent = '+'; fab.style.transform = ''; }
}

function fabHandleFile(e) {
  navigate('upload');
  setTimeout(() => handleFiles(e.target.files), 50);
  e.target.value = '';
}

function showManualEntry() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const timeNow = now.toTimeString().slice(0, 5);
  const currencies = ['TWD','USD','EUR','JPY','KRW','CNY','HKD','GBP','CZK','SGD'];

  showModal(`
    <div class="modal-header">
      <div class="modal-title">✏️ 手動輸入帳單</div>
      <button class="close-btn" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label>商家名稱</label>
      <input type="text" id="m-merchant" placeholder="例：全家便利商店">
    </div>
    <div style="display:flex;gap:12px">
      <div class="form-group" style="flex:1">
        <label>📅 日期</label>
        <input type="date" id="m-date" value="${today}">
      </div>
      <div class="form-group" style="flex:1">
        <label>🕐 時間</label>
        <input type="time" id="m-time" value="${timeNow}">
      </div>
    </div>
    <div class="form-group">
      <label>貨幣</label>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="m-currency-select" style="flex:2;padding:12px 10px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:#FFFEF5;color:var(--text);outline:none" onchange="document.getElementById('m-currency').value=this.value==='OTHER'?'':this.value">
          ${currencies.map(c => `<option value="${c}"${c==='TWD'?' selected':''}>${c}${c==='TWD'?' 新台幣':c==='USD'?' 美元':c==='EUR'?' 歐元':c==='JPY'?' 日圓':c==='KRW'?' 韓元':c==='CNY'?' 人民幣':c==='HKD'?' 港幣':c==='GBP'?' 英鎊':c==='CZK'?' 捷克克朗':' 新加坡元'}</option>`).join('')}
          <option value="OTHER">其他...</option>
        </select>
        <input type="text" id="m-currency" value="TWD" placeholder="自訂" style="flex:1;min-width:64px">
      </div>
    </div>
    <div class="form-group">
      <label>總金額</label>
      <input type="number" id="m-total" placeholder="0" step="0.01" min="0">
    </div>
    <div class="toggle-row">
      <span style="font-weight:500">平分帳單</span>
      <label class="toggle">
        <input type="checkbox" id="m-split">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div id="m-split-info" style="display:none;color:#854d0e;font-size:13px;margin-bottom:12px">
      ÷2 各付 <span id="m-split-amt"></span>
    </div>
    <div class="form-group">
      <label>加入群組（選填）</label>
      <select id="m-group">
        <option value="">個人帳單（不加入群組）</option>
      </select>
    </div>
    <div class="form-group">
      <label>備註（選填）</label>
      <textarea id="m-notes" rows="2" placeholder="輸入備註..."></textarea>
    </div>
    <button class="btn btn-primary" onclick="saveManualReceipt()">💾 儲存帳單</button>
    <div id="m-error" class="error"></div>
  `);

  // Split preview
  const totalInput = document.getElementById('m-total');
  const splitInfo = document.getElementById('m-split-info');
  const splitAmt = document.getElementById('m-split-amt');
  document.getElementById('m-split').addEventListener('change', e => {
    splitInfo.style.display = e.target.checked ? 'block' : 'none';
    const t = parseFloat(totalInput.value) || 0;
    splitAmt.textContent = `${document.getElementById('m-currency').value} ${(t / 2).toFixed(2)}`;
  });
  totalInput.addEventListener('input', () => {
    const t = parseFloat(totalInput.value) || 0;
    splitAmt.textContent = `${document.getElementById('m-currency').value} ${(t / 2).toFixed(2)}`;
  });

  // Load groups
  sb.rpc('get_my_groups').then(({ data }) => {
    const sel = document.getElementById('m-group');
    if (sel && data) data.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = `👥 ${g.name}`;
      sel.appendChild(opt);
    });
  });
}

async function saveManualReceipt() {
  const errEl = document.getElementById('m-error');
  const btn = document.querySelector('#modal-content .btn-primary');
  const merchant = document.getElementById('m-merchant').value.trim();
  const date = document.getElementById('m-date').value;
  const time = document.getElementById('m-time').value;
  const currency = document.getElementById('m-currency').value.trim() || 'TWD';
  const total = parseFloat(document.getElementById('m-total').value);
  const isSplit = document.getElementById('m-split').checked;
  const groupId = document.getElementById('m-group').value || null;
  const notes = document.getElementById('m-notes').value.trim();

  if (!date || !total) { errEl.textContent = '請填寫日期和金額'; return; }

  if (btn) { btn.disabled = true; btn.textContent = '儲存中...'; }

  const { error } = await sb.from('receipts').insert({
    user_id: currentUser.id,
    group_id: groupId,
    receipt_date: date,
    receipt_time: time ? time + ':00' : '00:00:00',
    merchant_name: merchant || null,
    total_amount: total,
    currency,
    is_split: isSplit,
    notes: notes || null,
  });

  if (error) {
    errEl.textContent = error.message;
    if (btn) { btn.disabled = false; btn.textContent = '💾 儲存帳單'; }
    return;
  }
  closeModal();
  navigate('receipts');
}

// Receipts

const PIKA_IMG = '<img style="width:28px;height:28px;object-fit:contain;vertical-align:middle" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" alt="" onerror="this.style.display=\'none\'">';

async function renderReceipts() {
  document.getElementById('page-title').innerHTML = `${PIKA_IMG} 帳單`;
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
    content.innerHTML = `
      <div class="pika-banner">
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" alt="Pikachu">
        <div class="pika-banner-text">
          <h3>還沒有帳單！</h3>
          <p>⚡ 點下方 📸 拍照開始記帳吧</p>
        </div>
      </div>
      <div class="empty-state" style="padding-top:16px">
        <div class="empty-icon">🧾</div>
        <p>帳單會顯示在這裡</p>
      </div>`;
    return;
  }
  content.innerHTML = receipts.map(r => receiptCard(r)).join('');
  setupSwipeHandlers();
}

function receiptCard(r) {
  const groupName = r.groups?.name;
  const splitAmt = r.is_split ? (r.total_amount / 2).toFixed(2) : null;
  return `
  <div class="swipe-wrapper" id="wrap-${r.id}">
    <div class="swipe-delete-bg" onclick="swipeDelete('${r.id}')">🗑 刪除</div>
    <div class="swipe-card" data-id="${r.id}">
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
    </div>
  </div>`;
}

let _swipeState = null;

function setupSwipeHandlers() {
  document.querySelectorAll('.swipe-card').forEach(card => {
    card.addEventListener('touchstart', _onSwipeStart, { passive: true });
    card.addEventListener('touchmove', _onSwipeMove, { passive: false });
    card.addEventListener('touchend', _onSwipeEnd, { passive: true });
  });
}

function _onSwipeStart(e) {
  _swipeState = {
    card: this,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    moved: false,
    locked: false,
    isOpen: this.classList.contains('open'),
  };
}

function _onSwipeMove(e) {
  if (!_swipeState || _swipeState.card !== this || _swipeState.locked) return;
  const dx = e.touches[0].clientX - _swipeState.startX;
  const dy = e.touches[0].clientY - _swipeState.startY;
  if (!_swipeState.moved) {
    if (Math.abs(dy) > Math.abs(dx)) { _swipeState.locked = true; return; }
    if (Math.abs(dx) < 5) return;
    _swipeState.moved = true;
  }
  e.preventDefault();
  const base = _swipeState.isOpen ? -82 : 0;
  const clamped = Math.max(-82, Math.min(0, base + dx));
  this.style.transition = 'none';
  this.style.transform = `translateX(${clamped}px)`;
}

function _onSwipeEnd(e) {
  if (!_swipeState || _swipeState.card !== this) return;
  const dx = e.changedTouches[0].clientX - _swipeState.startX;
  const { card, moved, isOpen } = _swipeState;
  _swipeState = null;
  card.style.transition = '';

  if (!moved) {
    if (isOpen) {
      _closeSwipe(card);
    } else {
      showReceiptDetail(card.dataset.id);
    }
    return;
  }

  const offset = (isOpen ? -82 : 0) + dx;
  if (offset < -41) {
    _openSwipe(card);
  } else {
    _closeSwipe(card);
  }
}

function _openSwipe(card) {
  document.querySelectorAll('.swipe-card.open').forEach(c => { if (c !== card) _closeSwipe(c); });
  card.style.transform = '';
  card.classList.add('open');
}

function _closeSwipe(card) {
  card.style.transform = '';
  card.classList.remove('open');
}

async function swipeDelete(id) {
  if (!confirm('確定要刪除這筆帳單嗎？')) return;
  await sb.from('receipt_items').delete().eq('receipt_id', id);
  const { error } = await sb.from('receipts').delete().eq('id', id);
  if (!error) {
    const wrapper = document.getElementById(`wrap-${id}`);
    if (wrapper) wrapper.remove();
  }
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
  document.getElementById('page-title').innerHTML = `${PIKA_IMG} 拍照記帳`;
  document.getElementById('topbar-action').style.display = 'none';
  uploadedImageBase64 = null;
  ocrResult = null;
  document.getElementById('page-content').innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <button class="btn btn-primary" style="flex:1" onclick="document.getElementById('file-camera').click()">📷 拍照</button>
      <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('file-library').click()">🖼️ 相簿</button>
    </div>
    <input type="file" id="file-camera" accept="image/*" capture="environment" style="display:none" onchange="handleFileSelect(event)">
    <input type="file" id="file-library" accept="image/*" style="display:none" onchange="handleFileSelect(event)">
    <div id="upload-area"></div>
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
      document.getElementById('upload-area').innerHTML = `<img src="${compressed}" class="preview-img" style="width:100%;border-radius:12px;margin-bottom:8px">`;
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

function toDateInput(str) {
  if (!str) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, '-');
  const d = new Date(str);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function toTimeInput(str) {
  if (!str) return '';
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2,'0')}:${m[2]}`;
  return '';
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
          <label>📅 日期</label>
          <input type="date" id="r-date" value="${toDateInput(data.date)}">
        </div>
        <div class="form-group" style="flex:1">
          <label>🕐 時間</label>
          <input type="time" id="r-time" value="${toTimeInput(data.time)}">
        </div>
      </div>
      <div class="form-group">
        <label>貨幣</label>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="r-currency-select" style="flex:2;padding:12px 10px;border:2px solid var(--border);border-radius:12px;font-size:15px;background:#FFFEF5;color:var(--text);outline:none" onchange="document.getElementById('r-currency').value=this.value==='OTHER'?'':this.value">
            <option value="TWD">TWD 新台幣</option>
            <option value="USD">USD 美元</option>
            <option value="EUR">EUR 歐元</option>
            <option value="JPY">JPY 日圓</option>
            <option value="KRW">KRW 韓元</option>
            <option value="CNY">CNY 人民幣</option>
            <option value="HKD">HKD 港幣</option>
            <option value="GBP">GBP 英鎊</option>
            <option value="CZK">CZK 捷克克朗</option>
            <option value="SGD">SGD 新加坡元</option>
            <option value="OTHER">其他...</option>
          </select>
          <input type="text" id="r-currency" placeholder="自訂" style="flex:1;min-width:64px" value="${data.currency || 'TWD'}">
        </div>
      </div>
      <div class="form-group">
        <label>總金額</label>
        <input type="number" id="r-total" value="${data.total || 0}" step="0.01">
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

  // Sync currency select with OCR-detected value
  const knownCurrencies = ['TWD','USD','EUR','JPY','KRW','CNY','HKD','GBP','CZK','SGD'];
  const detectedCurrency = (data.currency || 'TWD').toUpperCase();
  const currencySelect = document.getElementById('r-currency-select');
  currencySelect.value = knownCurrencies.includes(detectedCurrency) ? detectedCurrency : 'OTHER';

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
  const { data } = await sb.rpc('get_my_groups');
  const select = document.getElementById('r-group');
  if (!select || !data) return;
  data.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `👥 ${g.name}`;
    select.appendChild(opt);
  });
}

async function saveReceipt() {
  const errEl = document.getElementById('save-error');
  const btn = document.querySelector('#ocr-section .btn-primary') || document.querySelector('.btn-primary[onclick="saveReceipt()"]');
  errEl.textContent = '';

  if (btn) { btn.disabled = true; btn.textContent = '儲存中...'; }

  const merchant = document.getElementById('r-merchant').value.trim();
  const date = document.getElementById('r-date').value.trim();
  const time = document.getElementById('r-time').value.trim();
  const currency = document.getElementById('r-currency').value.trim() || 'TWD';
  const total = parseFloat(document.getElementById('r-total').value);
  const isSplit = document.getElementById('r-split').checked;
  const groupId = document.getElementById('r-group').value || null;
  const notes = document.getElementById('r-notes').value.trim();

  if (!date || !total) {
    errEl.textContent = '請填寫日期和金額';
    if (btn) { btn.disabled = false; btn.textContent = '💾 儲存帳單'; }
    return;
  }

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
    receipt_time: time ? (time.length === 5 ? time + ':00' : time) : '00:00:00',
    merchant_name: merchant,
    total_amount: total,
    currency,
    is_split: isSplit,
    notes: notes || null,
  }).select().single();

  if (error) {
    errEl.textContent = error.message;
    if (btn) { btn.disabled = false; btn.textContent = '💾 儲存帳單'; }
    return;
  }

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
let statsCurrency = 'TWD';
let _ratesCache = null;

async function fetchRates() {
  if (_ratesCache) return _ratesCache;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const json = await res.json();
    _ratesCache = json.rates;
  } catch {
    _ratesCache = { USD:1, TWD:32.5, EUR:0.93, JPY:155, KRW:1380, CNY:7.25, HKD:7.83, GBP:0.79, CZK:23.5, SGD:1.35 };
  }
  return _ratesCache;
}

function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (!rates || fromCurrency === toCurrency) return amount;
  const from = rates[fromCurrency] || 1;
  const to = rates[toCurrency] || 1;
  return amount * (to / from);
}

function fmtCurrency(amount, currency) {
  const noDecimals = ['JPY', 'KRW', 'CZK'];
  return noDecimals.includes(currency)
    ? Math.round(amount).toLocaleString()
    : Number(amount.toFixed(2)).toLocaleString();
}

async function renderStats() {
  document.getElementById('page-title').innerHTML = `${PIKA_IMG} 統計`;
  document.getElementById('topbar-action').style.display = 'none';
  const content = document.getElementById('page-content');
  const currencies = ['TWD','USD','EUR','JPY','KRW','CNY','HKD','GBP','CZK','SGD'];
  content.innerHTML = `
    <div class="period-tabs" style="margin-bottom:8px">
      <button class="period-tab ${statsPeriod==='day'?'active':''}" onclick="setStatsPeriod('day')">今日</button>
      <button class="period-tab ${statsPeriod==='week'?'active':''}" onclick="setStatsPeriod('week')">本週</button>
      <button class="period-tab ${statsPeriod==='month'?'active':''}" onclick="setStatsPeriod('month')">本月</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:14px">
      <span style="font-size:12px;font-weight:600;color:var(--muted)">換算幣別</span>
      <select id="stats-currency" onchange="setStatsCurrency(this.value)"
        style="padding:6px 8px;border:2px solid var(--border);border-radius:10px;font-size:14px;font-weight:700;background:#FFFEF5;color:var(--text);outline:none;width:80px">
        ${currencies.map(c => `<option value="${c}" ${c===statsCurrency?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div id="stats-content"><div class="loading"><div class="spinner"></div>計算中...</div></div>
  `;
  loadStats();
}

function setStatsPeriod(p) { statsPeriod = p; renderStats(); }
function setStatsCurrency(c) { statsCurrency = c; loadStats(); }

async function loadStats() {
  const rates = await fetchRates();
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

  const conv = r => convertAmount(Number(r.total_amount), r.currency || 'TWD', statsCurrency, rates);
  const total = data.reduce((s, r) => s + conv(r), 0);
  const splitTotal = data.filter(r => r.is_split).reduce((s, r) => s + conv(r) / 2, 0);
  const splitCount = data.filter(r => r.is_split).length;
  const personalTotal = data.filter(r => !r.group_id).reduce((s, r) => s + conv(r), 0);
  const groupTotal = data.filter(r => r.group_id).reduce((s, r) => s + conv(r), 0);
  const label = statsPeriod === 'day' ? '今日' : statsPeriod === 'week' ? '本週' : '本月';
  const sym = statsCurrency;

  document.getElementById('stats-content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">${label}總花費</div>
        <div class="stat-value">${sym} ${fmtCurrency(total, sym)}</div>
        <div class="stat-sub">${data.length} 筆帳單</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">平分合計（你付）</div>
        <div class="stat-value">${sym} ${fmtCurrency(splitTotal, sym)}</div>
        <div class="stat-sub">共 ${splitCount} 筆 ÷2</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">個人帳單</div>
        <div class="stat-value">${sym} ${fmtCurrency(personalTotal, sym)}</div>
        <div class="stat-sub">不含群組</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">群組帳單</div>
        <div class="stat-value">${sym} ${fmtCurrency(groupTotal, sym)}</div>
        <div class="stat-sub">群組消費</div>
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:4px">⚡ 匯率來源：open.er-api.com（即時）</div>
    ${data.length === 0 ? '<div class="empty-state"><div class="empty-icon">📊</div><p>此時段尚無記錄</p></div>' : ''}
  `;
}

// Groups

async function renderGroups() {
  document.getElementById('page-title').innerHTML = `${PIKA_IMG} 群組`;
  const btn = document.getElementById('topbar-action');
  btn.style.display = 'flex';
  btn.textContent = '➕';
  btn.onclick = showCreateGroup;

  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>載入中...</div>';

  const { data, error } = await sb.rpc('get_my_groups');

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
    ${data.map(g => {
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

  const { data, error } = await sb.rpc('create_group_for_me', { p_name: name });
  if (error) { err.textContent = error.message; return; }

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
  const code = document.getElementById('j-code').value.trim();
  const err = document.getElementById('j-error');
  if (code.length !== 8) { err.textContent = '請輸入 8 位邀請碼'; return; }

  const { data, error } = await sb.rpc('join_group_by_code', { p_code: code });
  if (error) {
    if (error.message.includes('找不到此邀請碼')) { err.textContent = '找不到此邀請碼'; return; }
    err.textContent = error.message;
    return;
  }

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
