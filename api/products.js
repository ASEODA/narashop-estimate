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

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'c3841318b681fad81247356e55fe8f4d050ed6b2e07377c70d255d4b0f7fd8ac';

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// 품목 정보 조회
app.get('/api/product', async (req, res) => {
  try {
    const { productNo } = req.query;
    if (!productNo) return res.status(400).json({ error: '제품번호를 입력해주세요.' });

    const apiUrl = 'https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService/getMASCntrctPrdctInfoList';
    const params = {
      serviceKey: API_KEY,
      numOfRows: 100, pageNo: 1, inqryDiv: '1', inqryBgnDt: '2024-01-01', inqryEndDt: '2025-12-31', prdctIdntNo: productNo, type: 'json'
    };

    const response = await axios.get(apiUrl, { params });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'API 호출 실패', message: error.message });
  }
});

// Helper: Number to Korean
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
          if (digit === 1 && i > 0) fourDigitStr = units[i] + fourDigitStr;
          else fourDigitStr = numbers[digit] + units[i] + fourDigitStr;
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

// Helper: Download Image
async function downloadImage(url, productNo) {
  try {
    if (!url) return null;
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return await sharp(Buffer.from(response.data))
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .png().toBuffer();
  } catch (error) {
    return null;
  }
}

// Main: Generate Estimate
app.post('/api/generate-estimate', async (req, res) => {
  try {
    const { products, customerInfo } = req.body;
    if (!products || products.length === 0) return res.status(400).json({ error: '제품 정보를 입력해주세요.' });

    const info = {
      customerName: customerInfo?.customerName || '고객사',
      projectName: customerInfo?.projectName || '견적 건',
      companyName: customerInfo?.companyName || '(주)문 수 시 스 템',
      companyPhone: customerInfo?.companyPhone || '052.276.4200',
      companyAddress: customerInfo?.companyAddress || '울산광역시 중구 운곡길 26',
      companyRep: customerInfo?.companyRep || '최 영 혜',
      companyFax: customerInfo?.companyFax || '052.271.6037',
      companyBizNo: customerInfo?.companyBizNo || '166-88-02397',
      // Logic reinstated: Fee is added to total.
      includeFee: true
    };

    const results = [];
    let rowNumber = 1;

    for (const item of products) {
      try {
        const apiUrl = 'https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService/getMASCntrctPrdctInfoList';
        const params = {
          serviceKey: API_KEY, numOfRows: 100, pageNo: 1, inqryDiv: '1', inqryBgnDt: '2024-01-01', inqryEndDt: '2025-12-31', prdctIdntNo: item.productNo, type: 'json'
        };
        const response = await axios.get(apiUrl, { params });
        const data = response.data;

        let productData = {};
        if (data?.response?.body?.items) {
          const items = Array.isArray(data.response.body.items) ? data.response.body.items : (data.response.body.items.item ? (Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item]) : []);
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
        const imageUrl = productData.prdctImgUrl || '';
        const imageBuffer = await downloadImage(imageUrl, item.productNo);

        results.push({
          no: rowNumber++,
          productName: productClassName,
          corpName: corpName,
          imageBuffer: imageBuffer,
          imageUrl: imageUrl,
          spec: productSpec,
          productNo: productData.prdctIdntNo || item.productNo,
          quantity: parseInt(item.quantity) || 0,
          unitPrice: unitPrice,
          remark: ''
        });

      } catch (error) {
        results.push({
          no: rowNumber++, productName: '조회 실패', corpName: '', imageBuffer: null, imageUrl: '', spec: '-', productNo: item.productNo, quantity: parseInt(item.quantity) || 0, unitPrice: 0, remark: '조회 실패'
        });
      }
    }

    // --- Vibrant/Cool Style Colors (Phase 5) ---
    const COLORS = {
      primaryBlue: 'FF3182F6', // Bright Blue
      deepNavy: 'FF003366',    // Deep Navy (Gradient Start) -> Replaced deepBlue
      textDark: 'FF1A1F27',    // Darker Text
      textLight: 'FF8B95A1',
      bgLightBlue: 'FFE8F3FF',
      bgCardOutside: 'FFF2F4F6',
      bgWhite: 'FFFFFFFF',
      bgZebra: 'FFF0F8FF',     // Light Blue Tint for Zebra (Cooler)
      borderLight: 'FFCFD8DC', // Crisp
      borderActive: 'FF3182F6'
    };

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(info.projectName || '견적서');

    worksheet.columns = [
      { width: 3 },   // A: Padding Left
      { width: 6 },   // B: NO
      { width: 25 },  // C: 품명
      { width: 18 },  // D: 이미지
      { width: 35 },  // E: 규격
      { width: 14 },  // F: 조달번호
      { width: 8 },   // G: 수량
      { width: 13 },  // H: 단가
      { width: 15 },  // I: 금액
      { width: 15 },  // J: 비고
      { width: 3 }    // K: Padding Right
    ];

    worksheet.pageSetup = {
      paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.1, right: 0.1, top: 0.1, bottom: 0.1, header: 0, footer: 0 }
    };
    worksheet.views = [{ showGridLines: false }];

    const SC = 2; // Col B
    const EC = 10; // Col J

    const getColLetter = (idx) => ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'][idx];
    const contentRange = (row) => `${getColLetter(SC)}${row}:${getColLetter(EC)}${row}`;

    let currentRow = 2;

    const styles = {
      headerFont: { name: 'Malgun Gothic', size: 28, bold: true, color: { argb: 'FFFFFFFF' } },
      subTitleFont: { name: 'Malgun Gothic', size: 12, bold: true, color: { argb: COLORS.textDark } },
      bodyFont: { name: 'Malgun Gothic', size: 10, color: { argb: COLORS.textDark } },
      tableHeaderFont: { name: 'Malgun Gothic', size: 11, bold: true, color: { argb: COLORS.bgWhite } },
      borderMedium: { style: 'medium', color: { argb: COLORS.borderActive } },
      borderThin: { style: 'thin', color: { argb: COLORS.borderLight } },
      alignCenter: { horizontal: 'center', vertical: 'middle' },
      alignRight: { horizontal: 'right', vertical: 'middle' },
      alignLeft: { horizontal: 'left', vertical: 'middle', wrapText: true },
      // Special Alignment for C & E
      alignCenterWrap: { horizontal: 'center', vertical: 'middle', wrapText: true },
      currencyFmt: '#,##0'
    };

    // --- Header with Vibrant Gradient ---
    worksheet.mergeCells(contentRange(currentRow));
    const titleCell = worksheet.getCell(currentRow, SC);
    titleCell.value = '   견    적    서   ';
    titleCell.font = styles.headerFont;
    titleCell.alignment = styles.alignCenter;

    // Gradient Fill (Deep Navy -> Bright Blue)
    titleCell.fill = {
      type: 'gradient',
      gradient: 'linear',
      degree: 90,
      stops: [
        { position: 0, color: { argb: COLORS.deepNavy } },
        { position: 1, color: { argb: COLORS.primaryBlue } }
      ]
    };
    worksheet.getRow(currentRow).height = 60;
    currentRow += 2;

    // Date
    worksheet.mergeCells(`${getColLetter(SC)}${currentRow}:${getColLetter(EC - 2)}${currentRow}`); // B~H
    const dateLabelCell = worksheet.getCell(currentRow, SC);
    dateLabelCell.value = '견적일 :';
    dateLabelCell.font = { name: 'Malgun Gothic', size: 11, bold: true, color: { argb: COLORS.textLight } };
    dateLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    worksheet.mergeCells(`${getColLetter(EC - 1)}${currentRow}:${getColLetter(EC)}${currentRow}`); // I~J
    const dateValueCell = worksheet.getCell(currentRow, EC - 1);
    dateValueCell.value = new Date();
    dateValueCell.numFmt = 'yyyy. mm. dd.';
    dateValueCell.font = { name: 'Malgun Gothic', size: 11, bold: true, color: { argb: COLORS.textDark } };
    dateValueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow++;

    // Customer Info (Left) - B~E
    const customerStartRow = currentRow;
    worksheet.mergeCells(`${getColLetter(SC)}${currentRow}:${getColLetter(SC + 3)}${currentRow}`); // B~E
    worksheet.getCell(currentRow, SC).value = `${info.customerName} 귀하`;
    worksheet.getCell(currentRow, SC).font = { name: 'Malgun Gothic', size: 18, bold: true, color: { argb: COLORS.deepNavy } }; // Darker Navy Text
    worksheet.getCell(currentRow, SC).alignment = { horizontal: 'left', vertical: 'bottom' };

    worksheet.mergeCells(`${getColLetter(SC)}${currentRow + 1}:${getColLetter(SC + 3)}${currentRow + 1}`);
    worksheet.getCell(currentRow + 1, SC).value = `건명 : ${info.projectName}`;
    worksheet.getCell(currentRow + 1, SC).font = { name: 'Malgun Gothic', size: 12, color: { argb: COLORS.textDark } };
    worksheet.getCell(currentRow + 1, SC).alignment = { horizontal: 'left', vertical: 'top' };

    // Provider Info (Right) - F~J
    const providerStartRow = currentRow;

    // -- Data Population (No borders yet) --

    worksheet.mergeCells(`${getColLetter(6)}${currentRow}:${getColLetter(10)}${currentRow}`);
    const bizNoCell = worksheet.getCell(currentRow, 6);
    bizNoCell.value = `등록번호 : ${info.companyBizNo}`;
    bizNoCell.font = styles.bodyFont;
    bizNoCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    currentRow++;

    worksheet.getCell(currentRow, 6).value = '상  호';
    worksheet.getCell(currentRow, 6).font = { ...styles.bodyFont, color: COLORS.textLight };
    worksheet.getCell(currentRow, 6).alignment = styles.alignCenter;

    worksheet.mergeCells(`${getColLetter(7)}${currentRow}:${getColLetter(8)}${currentRow}`);
    worksheet.getCell(currentRow, 7).value = info.companyName;
    worksheet.getCell(currentRow, 7).font = { ...styles.bodyFont, bold: true };
    worksheet.getCell(currentRow, 7).alignment = styles.alignCenter;

    worksheet.getCell(currentRow, 9).value = '대  표';
    worksheet.getCell(currentRow, 9).font = { ...styles.bodyFont, color: COLORS.textLight };
    worksheet.getCell(currentRow, 9).alignment = styles.alignCenter;

    worksheet.getCell(currentRow, 10).value = info.companyRep;
    worksheet.getCell(currentRow, 10).font = styles.bodyFont;
    worksheet.getCell(currentRow, 10).alignment = styles.alignCenter;
    currentRow++;

    worksheet.mergeCells(`${getColLetter(6)}${currentRow}:${getColLetter(10)}${currentRow}`); // F~J
    const addrCell = worksheet.getCell(currentRow, 6);
    addrCell.value = `주  소 : ${info.companyAddress}`;
    addrCell.font = styles.bodyFont;
    addrCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    currentRow++;

    worksheet.mergeCells(`${getColLetter(6)}${currentRow}:${getColLetter(10)}${currentRow}`);
    const condCell = worksheet.getCell(currentRow, 6);
    condCell.value = `업  태 : 도매 / 종  목 : 방송음향기기 및 통신기기`;
    condCell.font = styles.bodyFont;
    condCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    currentRow++;

    worksheet.mergeCells(`${getColLetter(6)}${currentRow}:${getColLetter(10)}${currentRow}`);
    const contactCell = worksheet.getCell(currentRow, 6);
    contactCell.value = `TEL : ${info.companyPhone}   FAX : ${info.companyFax}`;
    contactCell.font = styles.bodyFont;
    contactCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    const providerEndRow = currentRow;

    // -- Apply Box Border (Safe No-Gap Method) --
    for (let r = providerStartRow; r <= providerEndRow; r++) {
      for (let c = 6; c <= 10; c++) {
        const cell = worksheet.getCell(r, c);
        if (!cell.border) cell.border = {};
        const b = cell.border;
        // Left
        if (c === 6) b.left = styles.borderMedium;
        // Right
        if (c === 10) b.right = styles.borderMedium;
        // Top
        if (r === providerStartRow) b.top = styles.borderMedium;
        // Bottom
        if (r === providerEndRow) b.bottom = styles.borderMedium;

        cell.border = b;
      }
    }

    currentRow += 2;

    // --- Header (Grand Total) --- 
    const predictedSum = results.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const predictedFee = Math.round(predictedSum * 0.0054);
    const predictedGrandTotal = predictedSum + predictedFee;
    const koreanAmount = numberToKorean(predictedGrandTotal) + '원정';

    worksheet.mergeCells(contentRange(currentRow));
    const totalTextCell = worksheet.getCell(currentRow, SC);
    // Added "(부가세 포함)"
    totalTextCell.value = `총 결제 금액 : ${koreanAmount} (₩${predictedGrandTotal.toLocaleString()} / 부가세 포함)`;
    totalTextCell.font = { name: 'Malgun Gothic', size: 16, bold: true, color: { argb: COLORS.deepNavy } }; // Navy text
    totalTextCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalTextCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgWhite } };
    totalTextCell.border = {
      top: { style: 'medium', color: { argb: COLORS.deepNavy } },
      bottom: { style: 'medium', color: { argb: COLORS.deepNavy } }
    };
    worksheet.getRow(currentRow).height = 45;
    currentRow += 2;

    // --- Table Header ---
    const headerRow = worksheet.getRow(currentRow);
    const headerLabels = ['NO', '품명(회사명)', '제품사진', '모델명,규격', '조달번호', '수량', '단가', '금액', '비고'];
    let labelIdx = 0;
    for (let col = SC; col <= EC; col++) {
      const cell = headerRow.getCell(col);
      cell.value = headerLabels[labelIdx++];
      cell.font = styles.tableHeaderFont;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.deepNavy } }; // Solid Navy Header
      cell.alignment = styles.alignCenter;
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.primaryBlue } } };
    }
    headerRow.height = 35;
    currentRow++;

    // --- Data Rows (Zebra Striping: Light Blue) ---
    const startDataRow = currentRow;
    let zebra = false;
    for (const item of results) {
      const dataRow = worksheet.getRow(currentRow);

      let productNameText = item.productName;
      if (item.corpName) productNameText = `${item.productName}\n(${item.corpName})`;

      dataRow.getCell(2).value = item.no;
      dataRow.getCell(3).value = productNameText;
      dataRow.getCell(4).value = '';
      dataRow.getCell(5).value = item.spec;
      dataRow.getCell(6).value = item.productNo;
      dataRow.getCell(7).value = item.quantity;
      dataRow.getCell(7).numFmt = '#,##0';

      dataRow.getCell(8).value = item.unitPrice;
      dataRow.getCell(8).numFmt = styles.currencyFmt;

      dataRow.getCell(9).value = { formula: `G${currentRow}*H${currentRow}`, result: (item.quantity * item.unitPrice) };
      dataRow.getCell(9).numFmt = styles.currencyFmt;

      dataRow.getCell(10).value = item.remark;

      dataRow.height = 90;

      // Styling & Zebra (Cool Blue)
      const rowFill = zebra ? { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgZebra } } : null;

      for (let col = SC; col <= EC; col++) {
        const cell = dataRow.getCell(col);
        cell.font = styles.bodyFont;
        if (rowFill) cell.fill = rowFill;

        cell.border = { bottom: styles.borderThin };

        // Alignment Logic Fix
        if (col === 3 || col === 5) { // C (3) & E (5) -> Center Middle Wrap
          cell.alignment = styles.alignCenterWrap;
        } else if (col === 8 || col === 9) {
          cell.alignment = styles.alignRight;
          cell.font = { ...styles.bodyFont, bold: true };
        } else cell.alignment = styles.alignCenter;
      }

      zebra = !zebra;

      if (item.imageBuffer) {
        try {
          const imageId = workbook.addImage({ buffer: item.imageBuffer, extension: 'png' });
          worksheet.addImage(imageId, {
            tl: { col: 3.05, row: currentRow - 0.95 },
            ext: { width: 120, height: 120 },
            editAs: 'oneCell'
          });
        } catch (e) { }
      }
      currentRow++;
    }

    const endDataRow = currentRow - 1;

    // --- Summary Section ---
    currentRow++;

    // Product Total (Sum)
    worksheet.mergeCells(`${getColLetter(SC)}${currentRow}:${getColLetter(EC - 2)}${currentRow}`); // B~H
    const sumLabel = worksheet.getCell(currentRow, SC);
    sumLabel.value = '물 품 대 금';
    sumLabel.alignment = styles.alignRight;
    sumLabel.font = { ...styles.subTitleFont, color: { argb: COLORS.textLight } };

    // Value I
    const sumCell = worksheet.getCell(currentRow, EC - 1);
    sumCell.value = { formula: `SUM(I${startDataRow}:I${endDataRow})` };
    sumCell.numFmt = styles.currencyFmt;
    sumCell.font = { ...styles.bodyFont, bold: true };
    sumCell.alignment = styles.alignRight;
    const sumRowIdx = currentRow;
    currentRow++;

    // Fee (0.54%)
    worksheet.mergeCells(`${getColLetter(SC)}${currentRow}:${getColLetter(EC - 2)}${currentRow}`); // B~H
    const feeLabel = worksheet.getCell(currentRow, SC);
    feeLabel.value = '조달 수수료 (0.54%)';
    feeLabel.alignment = styles.alignRight;
    feeLabel.font = { ...styles.subTitleFont, color: { argb: COLORS.textLight } };

    // Value I
    const feeCell = worksheet.getCell(currentRow, EC - 1);
    feeCell.value = { formula: `ROUND(I${sumRowIdx}*0.0054, 0)` };
    feeCell.numFmt = styles.currencyFmt;
    feeCell.font = { ...styles.bodyFont, bold: true };
    feeCell.alignment = styles.alignRight;
    const feeRowIdx = currentRow;
    currentRow++;

    // Grand Total
    const totalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`${getColLetter(SC)}${currentRow}:${getColLetter(EC - 2)}${currentRow}`);
    totalRow.getCell(SC).value = '총 결제 금액 (대금 + 수수료)';
    totalRow.getCell(SC).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(SC).font = { name: 'Malgun Gothic', size: 12, bold: true, color: { argb: COLORS.deepNavy } };

    // Value: Sum + Fee
    const finalFormula = `I${sumRowIdx}+I${feeRowIdx}`;
    totalRow.getCell(EC - 1).value = { formula: finalFormula };
    totalRow.getCell(EC - 1).numFmt = styles.currencyFmt;
    totalRow.getCell(EC - 1).alignment = styles.alignRight;
    totalRow.getCell(EC - 1).font = { name: 'Malgun Gothic', size: 14, bold: true, color: { argb: COLORS.deepNavy } };

    // Style Row B~J 
    for (let c = SC; c <= EC; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = styles.totalRowFill;
      cell.border = { top: { style: 'thin', color: { argb: COLORS.primaryBlue } }, bottom: { style: 'medium', color: { argb: COLORS.deepNavy } } };
    }

    currentRow += 2;
    worksheet.getCell(currentRow, SC).value = '견적 유효기간 : 발행일로부터 1개월';
    worksheet.getCell(currentRow, SC).font = { size: 9, color: { argb: COLORS.textLight } };

    currentRow += 2; // Final Padding

    // --- Global Background Logic ---
    const lastRow = currentRow;
    const bgFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgCardOutside } };

    // Top/Bottom Padding Rows
    for (let c = 1; c <= 11; c++) {
      worksheet.getCell(1, c).fill = bgFill;
      worksheet.getCell(lastRow, c).fill = bgFill;
    }
    // Left/Right Padding Cols
    for (let r = 2; r < lastRow; r++) {
      worksheet.getCell(r, 1).fill = bgFill;
      worksheet.getCell(r, 11).fill = bgFill;

      // Inside White
      for (let c = SC; c <= EC; c++) {
        const cell = worksheet.getCell(r, c);
        if (!cell.fill) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgWhite } };
        }
      }
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const safeCustomerName = info.customerName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const safeProjectName = info.projectName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const dateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const filename = `${safeCustomerName}_${safeProjectName}_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(Buffer.from(excelBuffer));
    console.log('견적서 생성 완료!');

  } catch (error) {
    console.error('견적서 생성 에러:', error.message);
    res.status(500).json({ error: '견적서 생성 실패', message: error.message });
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

app.listen(PORT, () => console.log('Server started on port', PORT));

module.exports = app;