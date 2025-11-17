const express = require('express');
const axios = require('axios');
const ExcelJS = require('exceljs');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 포트 설정
const PORT = process.env.PORT || 3000;

// 공공데이터 포털 API 키
const API_KEY = process.env.API_KEY || 'c3841318b681fad81247356e55fe8f4d050ed6b2e07377c70d255d4b0f7fd8ac';

// 기본 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// 품목 정보 조회 API (단일 제품 테스트용)
app.get('/api/product', async (req, res) => {
  try {
    const { productNo } = req.query;

    if (!productNo) {
      return res.status(400).json({ error: '제품번호를 입력해주세요.' });
    }

    // 조달청 나라장터 종합쇼핑몰 API URL
    // 다수공급자계약 품목정보 조회
    const apiUrl = 'https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService/getMASCntrctPrdctInfoList';

    const params = {
      serviceKey: API_KEY,
      numOfRows: 100,
      pageNo: 1,
      inqryDiv: '1',  // 조회구분 (1: 물품식별번호로 조회)
      inqryBgnDt: '2024-01-01',  // 조회시작일
      inqryEndDt: '2025-12-31',  // 조회종료일
      prdctIdntNo: productNo,  // 물품식별번호로 검색
      type: 'json'
    };

    console.log('API 호출 중...', productNo);
    const response = await axios.get(apiUrl, { params });

    res.json(response.data);

  } catch (error) {
    console.error('API 호출 에러:', error.message);
    if (error.response) {
      console.error('응답 데이터:', error.response.data);
    }
    res.status(500).json({
      error: 'API 호출 실패',
      message: error.message,
      details: error.response?.data || null
    });
  }
});

// 숫자를 한글로 변환하는 함수
function numberToKorean(num) {
  const units = ['', '십', '백', '천'];
  const bigUnits = ['', '만', '억', '조'];
  const numbers = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

  if (num === 0) return '영';

  let result = '';
  let bigUnitIndex = 0;

  while (num > 0) {
    const fourDigits = num % 10000;
    if (fourDigits > 0) {
      let fourDigitStr = '';
      let tempNum = fourDigits;

      for (let i = 0; i < 4; i++) {
        const digit = tempNum % 10;
        if (digit > 0) {
          // 일의 자리가 1이 아니거나, 십의 자리가 아닐 때만 '일' 표시
          if (digit === 1 && i > 0) {
            fourDigitStr = units[i] + fourDigitStr;
          } else {
            fourDigitStr = numbers[digit] + units[i] + fourDigitStr;
          }
        }
        tempNum = Math.floor(tempNum / 10);
      }

      result = fourDigitStr + bigUnits[bigUnitIndex] + result;
    }
    num = Math.floor(num / 10000);
    bigUnitIndex++;
  }

  return result;
}

// 이미지 다운로드 함수
async function downloadImage(url, productNo) {
  try {
    if (!url) return null;

    const response = await axios.get(url, { responseType: 'arraybuffer' });

    // Sharp를 사용해 이미지 크기 조정 (1.5배로 크게)
    const resizedImage = await sharp(Buffer.from(response.data))
      .resize(150, 150, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    return resizedImage;
  } catch (error) {
    console.log(`이미지 다운로드 실패 (${productNo}):`, error.message);
    return null;
  }
}

// 여러 제품 조회 및 엑셀 생성
app.post('/api/generate-estimate', async (req, res) => {
  try {
    const { products, customerInfo } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ error: '제품 정보를 입력해주세요.' });
    }

    // 고객 정보 기본값 설정
    const info = {
      customerName: customerInfo?.customerName || '고객사',
      projectName: customerInfo?.projectName || '견적 건',
      companyName: customerInfo?.companyName || '(주)문 수 시 스 템',
      companyPhone: customerInfo?.companyPhone || '052.276.4200',
      companyAddress: customerInfo?.companyAddress || '울산광역시 중구 운곡길 26',
      companyRep: customerInfo?.companyRep || '최 영 혜',
      companyFax: customerInfo?.companyFax || '052.271.6037',
      companyBizNo: customerInfo?.companyBizNo || '166-88-02397',
      includeFee: customerInfo?.includeFee !== false,
      includeVat: customerInfo?.includeVat !== false,
      includeInstall: customerInfo?.includeInstall !== false
    };

    console.log('견적서 생성 시작...', products);
    const results = [];
    let subtotal = 0;
    let rowNumber = 1;

    // 각 제품 정보 조회
    for (const item of products) {
      try {
        const apiUrl = 'https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService/getMASCntrctPrdctInfoList';
        const params = {
          serviceKey: API_KEY,
          numOfRows: 100,
          pageNo: 1,
          inqryDiv: '1',
          inqryBgnDt: '2024-01-01',
          inqryEndDt: '2025-12-31',
          prdctIdntNo: item.productNo,
          type: 'json'
        };

        console.log(`제품 ${item.productNo} 조회 중...`);
        const response = await axios.get(apiUrl, { params });
        const data = response.data;

        let productData = {};
        if (data?.response?.body?.items) {
          const items = Array.isArray(data.response.body.items) ?
            data.response.body.items :
            (data.response.body.items.item ?
              (Array.isArray(data.response.body.items.item) ?
                data.response.body.items.item :
                [data.response.body.items.item]) :
              []);

          productData = items.find(i => i.prdctIdntNo === item.productNo) || items[0] || {};
        } else if (data?.items) {
          const items = Array.isArray(data.items) ? data.items : [data.items];
          productData = items.find(i => i.prdctIdntNo === item.productNo) || items[0] || {};
        } else {
          productData = data || {};
        }

        const productSpec = productData.prdctSpecNm || '정보 없음';
        const corpName = productData.cntrctCorpNm || productData.prdctMakrNm || '';
        const productClassName = productData.prdctClsfcNoNm || '제품';
        const unitPrice = parseInt(productData.cntrctPrceAmt || 0);
        const amount = unitPrice * item.quantity;
        const imageUrl = productData.prdctImgUrl || '';

        subtotal += amount;

        // 이미지 다운로드
        const imageBuffer = await downloadImage(imageUrl, item.productNo);

        results.push({
          no: rowNumber++,
          productName: productClassName,
          corpName: corpName,
          imageBuffer: imageBuffer,
          imageUrl: imageUrl,
          spec: productSpec,
          productNo: productData.prdctIdntNo || item.productNo,
          quantity: item.quantity,
          unitPrice: unitPrice,
          amount: amount,
          remark: ''
        });

      } catch (error) {
        console.error(`제품 ${item.productNo} 조회 실패:`, error.message);
        results.push({
          no: rowNumber++,
          productName: '조회 실패',
          corpName: '',
          imageBuffer: null,
          imageUrl: '',
          spec: '-',
          productNo: item.productNo,
          quantity: item.quantity,
          unitPrice: 0,
          amount: 0,
          remark: '조회 실패'
        });
      }
    }

    // 조달수수료 계산 (0.54%)
    let procurementFee = 0;
    if (info.includeFee) {
      procurementFee = Math.round(subtotal * 0.0054);
    }

    // 부가세 계산 (10%)
    let vat = 0;
    const subtotalWithFee = subtotal + procurementFee;
    if (info.includeVat) {
      vat = Math.round(subtotalWithFee * 0.1);
    }

    // 총 합계
    const totalAmount = subtotalWithFee + vat;

    // 한글 금액 표기
    const koreanAmount = numberToKorean(totalAmount) + '원정';
    const totalAmountText = `一金${koreanAmount}(₩${totalAmount.toLocaleString()})`;

    // 포함 항목 텍스트
    const includeText = [];
    if (info.includeVat) includeText.push('부가세');
    if (info.includeInstall) includeText.push('설치비');
    const includeStr = includeText.length > 0 ? includeText.join(',') + '포함' : '';

    // 오늘 날짜
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // ExcelJS 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(info.projectName || '견적서');

    // 페이지 설정
    worksheet.pageSetup.paperSize = 9; // A4
    worksheet.pageSetup.orientation = 'portrait';
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0;

    // 열 너비 설정
    worksheet.columns = [
      { width: 5 },   // A - NO
      { width: 20 },  // B - 품명(회사명)
      { width: 15 },  // C - 제품사진
      { width: 30 },  // D - 모델명,규격
      { width: 12 },  // E - 조달번호
      { width: 8 },   // F - 수량
      { width: 12 },  // G - 단가
      { width: 15 },  // H - 금액
      { width: 15 }   // I - 비고
    ];

    // 행 높이 기본값 설정
    worksheet.properties.defaultRowHeight = 20;

    let currentRow = 1;

    // 제목 행
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = `견     적     서`;
    titleCell.font = { size: 20, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 35;

    // 회사 정보 (우측 상단)
    worksheet.getCell(`F${currentRow}`).value = `${year} 년    ${month}  월     ${day} 일`;
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    currentRow++;

    // 고객명
    worksheet.getCell(`A${currentRow}`).value = `${info.customerName} 귀하`;
    worksheet.getCell(`A${currentRow}`).font = { size: 12, bold: true };

    // 회사명
    worksheet.getCell(`F${currentRow}`).value = info.companyName;
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${currentRow}`).font = { bold: true };

    // 직인 이미지 추가
    try {
      const sealPath = path.join(__dirname, '../public/seal.png');
      const sealBuffer = await fs.readFile(sealPath);
      const sealId = workbook.addImage({
        buffer: sealBuffer,
        extension: 'png',
      });

      // 직인 위치 (회사명 옆)
      worksheet.addImage(sealId, {
        tl: { col: 7.5, row: currentRow - 0.8 },
        ext: { width: 60, height: 60 },
        editAs: 'oneCell'
      });
    } catch (error) {
      console.log('직인 이미지 추가 실패:', error.message);
    }

    currentRow++;

    // 빈 줄
    worksheet.getCell(`F${currentRow}`).value = `사업자번호 ${info.companyBizNo}`;
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    currentRow++;

    // 건명
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = `건명 : ${info.projectName}`;
    worksheet.getCell(`A${currentRow}`).font = { size: 11 };

    worksheet.getCell(`F${currentRow}`).value = info.companyAddress;
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    currentRow++;

    // 빈 줄
    worksheet.getCell(`F${currentRow}`).value = `대     표   :   ${info.companyRep}`;
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    currentRow++;

    // 아래와 같이 견적합니다
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = '아래와 같이 견적합니다';

    worksheet.getCell(`F${currentRow}`).value = `TEL.${info.companyPhone}   FAX.${info.companyFax}`;
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 2; // 빈 줄 추가

    // 총 합계 금액
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const totalCell = worksheet.getCell(`A${currentRow}`);
    totalCell.value = `총  합 계 금 액 ${totalAmountText} ${includeStr}`;
    totalCell.font = { size: 14, bold: true };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };
    worksheet.getRow(currentRow).height = 30;
    currentRow += 2; // 빈 줄 추가

    // 테이블 헤더
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = ['NO', '품명(회사명)', '제품사진', '모델명,규격', '조달번호', '수량', '단가', '금액', '비고'];
    headerRow.font = { bold: true };
    headerRow.height = 25;

    // 헤더 스타일링
    for (let col = 1; col <= 9; col++) {
      const cell = headerRow.getCell(col);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    }
    currentRow++;

    // 제품 데이터 추가
    for (const item of results) {
      const dataRow = worksheet.getRow(currentRow);

      // 품명 셀 설정 (회사명 포함)
      let productNameText = item.productName;
      if (item.corpName) {
        productNameText = `${item.productName}\n(${item.corpName})`;
      }

      dataRow.values = [
        item.no,
        productNameText,
        '', // 이미지 컬럼은 비워둠
        item.spec,
        item.productNo,
        item.quantity,
        item.unitPrice.toLocaleString(),
        item.amount.toLocaleString(),
        item.remark
      ];

      dataRow.height = 120; // 크게 만든 이미지를 위한 행 높이

      // 데이터 행 스타일링
      for (let col = 1; col <= 9; col++) {
        const cell = dataRow.getCell(col);
        cell.alignment = {
          horizontal: col === 1 || col >= 5 ? 'center' : 'left',
          vertical: 'middle',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      // 이미지 추가 (C열 - 정중앙 배치)
      if (item.imageBuffer) {
        try {
          const imageId = workbook.addImage({
            buffer: item.imageBuffer,
            extension: 'png',
          });

          // 셀 중앙에 이미지 배치를 위한 오프셋 계산
          worksheet.addImage(imageId, {
            tl: { col: 2.1, row: currentRow - 0.9 }, // C열 중앙 정렬
            ext: { width: 110, height: 110 }, // 1.5배 크기
            editAs: 'oneCell'
          });
        } catch (imgError) {
          console.log('이미지 삽입 실패:', imgError.message);
        }
      }

      currentRow++;
    }

    // 빈 줄
    currentRow += 1;

    // 요약 행 추가 함수
    const addSummaryRow = (label, value) => {
      const row = worksheet.getRow(currentRow);
      row.getCell(5).value = label;
      row.getCell(8).value = value.toLocaleString();

      // 스타일링
      for (let col = 5; col <= 8; col++) {
        const cell = row.getCell(col);
        cell.alignment = { horizontal: col === 5 ? 'right' : 'center', vertical: 'middle' };
        if (col >= 5) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }
      row.getCell(5).font = { bold: true };
      currentRow++;
    };

    // 물품금액 행 추가
    addSummaryRow('물품금액', subtotal);

    // 조달수수료 행
    if (info.includeFee && procurementFee > 0) {
      addSummaryRow('조달 수수료', procurementFee);
      addSummaryRow('조달품목의 0.54%', subtotal + procurementFee);
    }

    if (info.includeVat && vat > 0) {
      // 부가세 행은 별도로 표시하지 않고 총합계에 포함
    }

    // 최종 합계 행 - 배경색 추가
    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(5).value = '';
    totalRow.getCell(8).value = totalAmount.toLocaleString();
    totalRow.getCell(8).font = { bold: true, size: 12 };
    totalRow.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCC99' }
    };
    for (let col = 5; col <= 8; col++) {
      totalRow.getCell(col).border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    }

    // 엑셀 버퍼 생성
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // 파일명 생성
    const safeCustomerName = info.customerName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const safeProjectName = info.projectName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const dateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const filename = `${safeCustomerName}_${safeProjectName}_${dateStr}.xlsx`;

    // 파일 다운로드 응답
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(Buffer.from(excelBuffer));

    console.log('견적서 생성 완료!');

  } catch (error) {
    console.error('견적서 생성 에러:', error.message);
    res.status(500).json({
      error: '견적서 생성 실패',
      message: error.message
    });
  }
});

// 서버 상태 확인 API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '서버가 정상적으로 실행 중입니다.',
    apiKeySet: API_KEY !== '여기에_발급받은_인증키를_넣으세요'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   나라장터 자동 견적서 생성 서버가 시작되었습니다!   ║
  ╠═══════════════════════════════════════════════╣
  ║   로컬 주소: http://localhost:${PORT}            ║
  ╚═══════════════════════════════════════════════╝

  ⚠️  중요: API 키를 설정했는지 확인하세요!
  `);

  if (API_KEY === '여기에_발급받은_인증키를_넣으세요') {
    console.log('⚠️  경고: API 키가 설정되지 않았습니다. products.js 파일에서 API_KEY를 설정하세요.');
  } else {
    console.log('✅ API 키가 설정되었습니다.');
  }
});

module.exports = app;