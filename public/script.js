// 전역 변수
let rowCount = 1;

// 제품 행 추가
function addRow() {
    const container = document.getElementById('product-inputs');
    rowCount++;

    const newRow = document.createElement('div');
    newRow.className = 'product-row';
    newRow.dataset.row = rowCount;
    newRow.innerHTML = `
        <span class="row-number">${rowCount}</span>
        <input type="text" class="product-no" placeholder="제품번호 (예: 24234567)" maxlength="20">
        <input type="number" class="quantity" placeholder="수량" min="1" value="1">
        <button onclick="removeRow(this)" class="btn-remove" title="삭제">✕</button>
    `;

    container.appendChild(newRow);

    // 새로 추가된 입력 필드에 포커스
    newRow.querySelector('.product-no').focus();
}

// 제품 행 삭제
function removeRow(button) {
    const rows = document.querySelectorAll('.product-row');
    if (rows.length > 1) {
        button.parentElement.remove();
        updateRowNumbers();
    } else {
        showMessage('최소 1개의 제품은 입력해야 합니다.', 'warning');
    }
}

// 행 번호 업데이트
function updateRowNumbers() {
    const rows = document.querySelectorAll('.product-row');
    rows.forEach((row, index) => {
        const numberSpan = row.querySelector('.row-number');
        if (numberSpan) {
            numberSpan.textContent = index + 1;
        }
        row.dataset.row = index + 1;
    });
    rowCount = rows.length;
}

// API 연결 테스트
async function testAPI() {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('result-content');

    resultDiv.style.display = 'block';
    resultContent.innerHTML = '<div class="loading">API 연결을 테스트하는 중...</div>';

    try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.status === 'OK') {
            let message = `
                <div class="success">
                    ✅ 서버 연결 성공!<br>
                    상태: ${data.status}<br>
                    메시지: ${data.message}<br>
                    API 키 설정: ${data.apiKeySet ? '✅ 완료' : '❌ 필요'}
                </div>
            `;

            if (!data.apiKeySet) {
                message += `
                    <div class="warning">
                        ⚠️ API 키가 설정되지 않았습니다.<br>
                        api/products.js 파일에서 API_KEY를 설정해주세요.
                    </div>
                `;
            }

            resultContent.innerHTML = message;
        } else {
            throw new Error('서버 상태 확인 실패');
        }
    } catch (error) {
        console.error('테스트 에러:', error);
        resultContent.innerHTML = `
            <div class="error">
                ❌ API 연결 실패<br>
                오류: ${error.message}<br>
                서버가 실행 중인지 확인해주세요.
            </div>
        `;
    }
}

// 견적서 생성
async function generateEstimate() {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('result-content');
    const loadingOverlay = document.getElementById('loading-overlay');

    // 고객 정보 수집 (회사 정보는 고정값)
    const customerInfo = {
        customerName: document.getElementById('customer-name').value || '고객사',
        projectName: document.getElementById('project-name').value || '견적 건',
        companyName: '(주)문 수 시 스 템',
        companyPhone: '052.276.4200',
        companyAddress: '울산광역시 중구 운곡길 26',
        companyRep: '최 영 혜',
        companyBizNo: '166-88-02397',
        companyFax: '052.271.6037',
        includeFee: document.getElementById('include-fee').checked,
        includeVat: document.getElementById('include-vat').checked,
        includeInstall: document.getElementById('include-install').checked
    };

    // 입력값 수집
    const rows = document.querySelectorAll('.product-row');
    const products = [];
    let hasError = false;

    for (const row of rows) {
        const productNoInput = row.querySelector('.product-no');
        const quantityInput = row.querySelector('.quantity');
        const productNo = productNoInput.value.trim();
        const quantity = parseInt(quantityInput.value);

        if (productNo && quantity > 0) {
            products.push({ productNo, quantity });
        } else if (productNo || quantity) {
            // 부분적으로만 입력된 경우
            hasError = true;
            if (!productNo) {
                productNoInput.style.borderColor = '#f44336';
            }
            if (!quantity || quantity < 1) {
                quantityInput.style.borderColor = '#f44336';
            }
        }
    }

    // 입력값 검증
    if (hasError) {
        showMessage('모든 행에 제품번호와 수량을 올바르게 입력해주세요.', 'error');
        return;
    }

    if (products.length === 0) {
        showMessage('최소 1개 이상의 제품 정보를 입력해주세요.', 'warning');
        return;
    }

    // 로딩 표시
    loadingOverlay.style.display = 'flex';
    resultDiv.style.display = 'block';
    resultContent.innerHTML = '<div class="loading">견적서를 생성하는 중...</div>';

    try {
        const response = await fetch('/api/generate-estimate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ products, customerInfo })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '견적서 생성에 실패했습니다.');
        }

        // 엑셀 파일 다운로드
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
        a.download = `narashop_estimate_${timestamp}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // 성공 메시지
        resultContent.innerHTML = `
            <div class="success">
                ✅ 견적서가 성공적으로 생성되었습니다!<br>
                총 ${products.length}개 제품의 견적서가 다운로드되었습니다.<br>
                파일명: narashop_estimate_${timestamp}.xlsx
            </div>
        `;

        // 입력 필드 초기화 옵션
        setTimeout(() => {
            if (confirm('견적서가 생성되었습니다. 입력 내용을 초기화하시겠습니까?')) {
                resetForm();
            }
        }, 1000);

    } catch (error) {
        console.error('Error:', error);
        resultContent.innerHTML = `
            <div class="error">
                ❌ 견적서 생성 실패<br>
                오류: ${error.message}<br>
                <br>
                가능한 원인:<br>
                1. API 키가 올바르게 설정되지 않았습니다.<br>
                2. 제품번호가 잘못되었습니다.<br>
                3. 서버가 실행 중이지 않습니다.<br>
                4. 공공데이터 포털 API 서버에 문제가 있습니다.
            </div>
        `;
    } finally {
        // 로딩 숨기기
        loadingOverlay.style.display = 'none';
    }
}

// 메시지 표시
function showMessage(message, type = 'info') {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('result-content');

    resultDiv.style.display = 'block';
    resultContent.innerHTML = `<div class="${type}">${message}</div>`;

    // 5초 후 자동으로 숨기기
    setTimeout(() => {
        if (resultContent.innerHTML.includes(message)) {
            resultDiv.style.display = 'none';
        }
    }, 5000);
}

// 폼 초기화
function resetForm() {
    const container = document.getElementById('product-inputs');
    container.innerHTML = `
        <div class="product-row" data-row="1">
            <span class="row-number">1</span>
            <input type="text" class="product-no" placeholder="제품번호 (예: 24234567)" maxlength="20">
            <input type="number" class="quantity" placeholder="수량" min="1" value="1">
            <button onclick="removeRow(this)" class="btn-remove" title="삭제">✕</button>
        </div>
    `;
    rowCount = 1;

    const resultDiv = document.getElementById('result');
    resultDiv.style.display = 'none';
}

// Enter 키로 다음 필드로 이동
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const target = e.target;
        if (target.classList.contains('product-no')) {
            const nextInput = target.parentElement.querySelector('.quantity');
            if (nextInput) {
                nextInput.focus();
            }
        } else if (target.classList.contains('quantity')) {
            const currentRow = target.parentElement;
            const nextRow = currentRow.nextElementSibling;
            if (nextRow) {
                const nextInput = nextRow.querySelector('.product-no');
                if (nextInput) {
                    nextInput.focus();
                }
            } else {
                // 마지막 행에서 Enter를 누르면 새 행 추가
                addRow();
            }
        }
    }
});

// 입력 필드 스타일 초기화
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('product-no') || e.target.classList.contains('quantity')) {
        e.target.style.borderColor = '';
    }
});

// 엑셀 데이터 붙여넣기 처리
function handlePaste(e) {
    e.preventDefault();
    const pasteData = (e.clipboardData || window.clipboardData).getData('text');

    // 탭으로 구분된 데이터를 파싱
    const lines = pasteData.trim().split('\n');
    const container = document.getElementById('product-inputs');

    // 기존 행 제거
    container.innerHTML = '';
    rowCount = 0;

    lines.forEach((line, index) => {
        const [productNo, quantity] = line.split('\t');
        if (productNo) {
            rowCount++;
            const newRow = document.createElement('div');
            newRow.className = 'product-row';
            newRow.dataset.row = rowCount;
            newRow.innerHTML = `
                <span class="row-number">${rowCount}</span>
                <input type="text" class="product-no" value="${productNo.trim()}" placeholder="제품번호 (예: 24234567)" maxlength="20">
                <input type="number" class="quantity" value="${quantity ? quantity.trim() : '1'}" placeholder="수량" min="1">
                <button onclick="removeRow(this)" class="btn-remove" title="삭제">✕</button>
            `;
            container.appendChild(newRow);
        }
    });

    showMessage(`${rowCount}개의 제품이 추가되었습니다.`, 'success');
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('나라장터 자동 견적서 생성기가 준비되었습니다!');

    // 첫 입력 필드에 포커스
    const firstInput = document.querySelector('.product-no');
    if (firstInput) {
        firstInput.focus();
    }

    // 붙여넣기 이벤트 리스너 추가
    document.getElementById('product-inputs').addEventListener('paste', handlePaste);
});

// 예제 데이터 자동 입력 (테스트용)
function loadSampleData() {
    const sampleProducts = [
        { productNo: '24234567', quantity: 2 },
        { productNo: '24234568', quantity: 5 },
        { productNo: '24234569', quantity: 1 }
    ];

    // 기존 행 제거 후 샘플 데이터로 채우기
    const container = document.getElementById('product-inputs');
    container.innerHTML = '';

    sampleProducts.forEach((product, index) => {
        const row = document.createElement('div');
        row.className = 'product-row';
        row.dataset.row = index + 1;
        row.innerHTML = `
            <span class="row-number">${index + 1}</span>
            <input type="text" class="product-no" value="${product.productNo}" placeholder="제품번호 (예: 24234567)" maxlength="20">
            <input type="number" class="quantity" value="${product.quantity}" placeholder="수량" min="1">
            <button onclick="removeRow(this)" class="btn-remove" title="삭제">✕</button>
        `;
        container.appendChild(row);
    });

    rowCount = sampleProducts.length;
    showMessage('샘플 데이터가 입력되었습니다.', 'success');
}

// 디버그 모드 (개발용)
const DEBUG_MODE = false;
if (DEBUG_MODE) {
    console.log('디버그 모드 활성화');
    window.loadSampleData = loadSampleData;
}