document.addEventListener('DOMContentLoaded', () => {
    fetchHistory();
    setupEventListeners();
});

// History Logic
let historyDataCache = []; // Store for restoration

async function fetchHistory() {
    const listEl = document.getElementById('historyList');
    listEl.innerHTML = '<div class="empty-state">내역을 불러오는 중...</div>';

    try {
        const response = await fetch('/api/history');
        if (response.status === 401) window.location.href = '/login.html';
        const data = await response.json();
        historyDataCache = data; // Cache

        if (!data || data.length === 0) {
            listEl.innerHTML = '<div class="empty-state">최근 발행된 견적서가 없습니다.</div>';
            return;
        }

        listEl.innerHTML = '';
        data.forEach((item, index) => {
            const date = new Date(item.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const amount = new Intl.NumberFormat('ko-KR').format(item.totalAmount);
            const canRestore = item.customerInfo && item.products;

            const div = document.createElement('div');
            div.className = 'history-item';

            let loadBtnHtml = '';
            if (canRestore) {
                div.style.cursor = 'pointer';
                div.onclick = () => loadEstimate(index);
                loadBtnHtml = `<div style="font-size:11px; color:#3182F6; margin-top:4px;">불러오기 ></div>`;
            } else {
                div.style.cursor = 'default';
                div.onclick = null;
                // Optional: Indicate why
                loadBtnHtml = `<div style="font-size:11px; color:#b0b8c1; margin-top:4px;">불러오기 불가 (이전 내역)</div>`;
            }

            div.innerHTML = `
                <div class="h-info">
                    <div class="h-title">${item.customerName} - ${item.projectName}</div>
                    <div class="h-date">${date} • ${item.productCount}개 품목</div>
                </div>
                <div class="h-amount">
                    ${amount}원
                    ${loadBtnHtml}
                </div>
            `;
            listEl.appendChild(div);
        });
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state">내역을 불러오지 못했습니다.</div>';
    }
}

function loadEstimate(index) {
    const item = historyDataCache[index];
    if (!item || !item.customerInfo || !item.products) {
        showToast('이 내역은 상세 정보를 불러올 수 없습니다.');
        return;
    }

    // Fill Customer Info
    const c = item.customerInfo;
    document.getElementById('customer-name').value = c.customerName || '';
    document.getElementById('project-name').value = c.projectName || '';
    // We assume checkboxes are default/persistent or could be stored.
    // For now, only text fields were stored in recent update.
    // Wait, I stored full req.body.customerInfo.
    // Phase 9 implementation: stored full object.

    // Fill Products
    const container = document.getElementById('product-inputs');
    container.innerHTML = '';
    rowCount = 0;

    item.products.forEach(p => {
        addRow(p.productNo, p.quantity);
    });

    showToast(`'${item.customerName}' 건의 정보를 불러왔습니다.`);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auth & Global Events
function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    // Excel Copy-Paste Feature
    document.addEventListener('paste', (e) => {
        // Only run if specific inputs are not focused (optional, but let's allow general paste if it looks like TSV)
        // Or if the target is within the product input area.
        // User said: "In the product info input window..."
        // Let's attach it to the whole document but check if the pasted data is multiline TSV.

        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('Text');

        if (!pastedData) return;

        // Simple check: multiple lines or tab character?
        const rows = pastedData.split(/\r\n|\n|\r/).filter(r => r.trim() !== '');

        // If it looks like Excel data (at least 2 cols separated by tab)
        const isTSV = rows.some(r => r.split('\t').length >= 2);

        if (isTSV) {
            e.preventDefault();

            // Clear existing rows (User intent usually "replace" or "fill")
            // But let's ask or just append? 
            // "Copy from Excel... paste". Usually expects to fill. 
            // Let's clear for cleaner UX if it's a bulk paste, or maybe just fill from the first empty one?
            // "feature disappeared" implies it was simple before.
            // Let's clear and rebuild.

            const container = document.getElementById('product-inputs');
            container.innerHTML = '';
            rowCount = 0;

            rows.forEach(rowStr => {
                const cols = rowStr.split('\t');
                if (cols.length >= 2) {
                    const pNo = cols[0].trim();
                    const qty = cols[1].trim();
                    if (pNo) {
                        addRow(pNo, qty);
                    }
                }
            });
            showToast(`${rows.length}개 품목을 붙여넣었습니다.`);
        }
    });
}

// Product List Logic
let rowCount = 1;

function addRow(pNoVal = '', qtyVal = '1') {
    rowCount++;
    const container = document.getElementById('product-inputs');
    const div = document.createElement('div');
    div.className = 'product-row';
    div.dataset.row = rowCount;
    div.innerHTML = `
        <div class="row-idx">${rowCount}</div>
        <input type="text" class="product-no toss-input" placeholder="조달번호 (8자리)" maxlength="20" value="${pNoVal}">
        <input type="number" class="quantity toss-input" placeholder="수량" min="1" value="${qtyVal}">
        <button onclick="removeRow(this)" class="btn-delete" aria-label="삭제">✕</button>
    `;
    container.appendChild(div);
    updateIndexes();
}

function removeRow(btn) {
    const row = btn.closest('.product-row');
    const container = document.getElementById('product-inputs');
    if (container.children.length > 1) {
        row.remove();
        updateIndexes();
    } else {
        showToast('최소 1개의 제품이 필요합니다.');
    }
}

function updateIndexes() {
    const rows = document.querySelectorAll('.product-row');
    rows.forEach((row, index) => {
        row.querySelector('.row-idx').textContent = index + 1;
    });
    rowCount = rows.length;
}

// Estimate Generation
async function generateEstimate() {
    const customerName = document.getElementById('customer-name').value.trim();
    const projectName = document.getElementById('project-name').value.trim();

    // Collect Products
    const productRows = document.querySelectorAll('.product-row');
    const products = [];

    productRows.forEach(row => {
        const no = row.querySelector('.product-no').value.trim();
        const qty = row.querySelector('.quantity').value;
        if (no) products.push({ productNo: no, quantity: parseInt(qty) || 1 });
    });

    if (products.length === 0) {
        showToast('제품번호를 입력해주세요.');
        return;
    }

    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';

    try {
        const payload = {
            products,
            customerInfo: {
                customerName: customerName || '고객사',
                projectName: projectName || '견적 건'
            }
        };

        const response = await fetch('/api/generate-estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) throw new Error('생성 실패');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'estimate.xlsx';
        a.download = decodeURIComponent(filename);
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

        showToast('견적서가 다운로드되었습니다.');
        fetchHistory(); // Refresh history

    } catch (error) {
        showToast('견적서 생성 중 오류가 발생했습니다.');
    } finally {
        overlay.style.display = 'none';
    }
}

function showToast(msg) {
    const el = document.getElementById('result');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}