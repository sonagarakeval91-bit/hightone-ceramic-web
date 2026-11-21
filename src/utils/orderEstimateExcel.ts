import ExcelJS from 'exceljs';
import { SavedDealerOrder } from '../types';

export interface EstimateLineRow {
  productName: string;
  grade: string;
  colorCode: string;
  packing: string;
  quantity: number;
}

export interface EstimateExportConfig {
  estimateCode: string;
  voucherNo: string;
  voucherDate: string;
  dealerName: string;
  dealerAddress: string;
  vehicleNo: string;
  gstPercent: number;
  remarks: string;
  totalWeightKg: number;
  lines: EstimateLineRow[];
}

/**
 * Formats an order grade into the factory estimate convention (`Uty`, `Suty`, `ROK`).
 */
export const formatEstimateGrade = (grade?: string): string => {
  const raw = (grade || 'Uty').trim();
  const normalized = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized === 'suty') return 'Suty';
  if (normalized === 'uty') return 'Uty';
  if (normalized === 'rok') return 'ROK';
  return raw || 'Uty';
};

/**
 * Attempts to parse an order timestamp or ISO date into DD/MM/YYYY.
 */
export const formatVoucherDateDDMMYYYY = (timestamp?: string): string => {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const formatDate = (d: Date) =>
    `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

  if (timestamp && timestamp.trim()) {
    const trimmed = timestamp.trim();
    // Already DD/MM/YYYY or D/M/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${pad2(day)}/${pad2(month)}/${year}`;
      }
    }

    // YYYY-MM-DD
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
      const year = Number(ymdMatch[1]);
      const month = Number(ymdMatch[2]);
      const day = Number(ymdMatch[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${pad2(day)}/${pad2(month)}/${year}`;
      }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDate(parsed);
    }
  }

  return formatDate(new Date());
};

/**
 * Computes Indian Financial Year estimate code (e.g., EST2627 for Apr 2026 - Mar 2027).
 */
export const buildDefaultEstimateCode = (voucherDateDDMMYYYY?: string): string => {
  let month = new Date().getMonth() + 1;
  let year = new Date().getFullYear();

  if (voucherDateDDMMYYYY) {
    const match = voucherDateDDMMYYYY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      month = Number(match[2]);
      year = Number(match[3]);
    }
  }

  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const yy1 = String(fyStart).slice(-2);
  const yy2 = String(fyEnd).slice(-2);
  return `EST${yy1}${yy2}`;
};

/**
 * Expands a SavedDealerOrder into per-color/code estimate rows and pre-filled header metadata.
 */
export const buildDefaultEstimateConfig = (order: SavedDealerOrder): EstimateExportConfig => {
  const voucherDate = formatVoucherDateDDMMYYYY(order.timestamp);
  const estimateCode = buildDefaultEstimateCode(voucherDate);

  const firm = (order.dealerInfo?.firmName || '').trim();
  const person = (order.personName || order.dealerInfo?.contactPerson || '').trim();
  const dealerName = (firm || person || 'DEALER').toUpperCase();

  const city = (order.dealerInfo?.city || '').trim();
  const cityState = (order.dealerInfo?.cityState || '').trim();
  const street = (order.dealerAddress || '').trim();
  const dealerAddress = (city || cityState || street || '').toUpperCase();

  const voucherNo = (order.orderId || order.dispatchNo || order.id || '').trim();
  const vehicleNo = (order.vehicleNo || '').trim();
  const remarks = (order.dealerInfo?.notes || '').trim();

  const lines: EstimateLineRow[] = [];
  let computedWeightKg = 0;

  (order.items || []).forEach((item) => {
    const grade = formatEstimateGrade(item.grade);
    const packing = (item.packing || 'Box').trim();
    const unitWeight = Number(item.unitWeightKg) || 0;

    if (item.colorSplits && item.colorSplits.length > 0) {
      item.colorSplits.forEach((split) => {
        const qty = Number(split.quantity) || 0;
        if (qty <= 0) return;
        computedWeightKg += qty * unitWeight;
        lines.push({
          productName: item.name,
          grade,
          colorCode: (split.codeOrColor || 'White').trim(),
          packing,
          quantity: qty
        });
      });
    } else if ((Number(item.totalQuantity) || 0) > 0) {
      const qty = Number(item.totalQuantity) || 0;
      computedWeightKg += qty * unitWeight;
      lines.push({
        productName: item.name,
        grade,
        colorCode: 'White',
        packing,
        quantity: qty
      });
    }
  });

  const totalWeightKg =
    typeof order.totalWeightKg === 'number' && Number.isFinite(order.totalWeightKg)
      ? order.totalWeightKg
      : computedWeightKg;

  return {
    estimateCode,
    voucherNo,
    voucherDate,
    dealerName,
    dealerAddress,
    vehicleNo,
    gstPercent: 9,
    remarks,
    totalWeightKg,
    lines
  };
};

const THIN_BLACK: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: 'FF000000' }
};

const GRAY_SHADE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE5E7EB' }
};

const EDITABLE_GST_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFEFCE8' }
};

const sanitizeFilenamePart = (val: string, fallback: string): string => {
  const cleaned = val
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return cleaned || fallback;
};

const sanitizeSheetName = (val: string): string => {
  const cleaned = val
    .trim()
    .replace(/[\\/?*[\]:]/g, '')
    .slice(0, 31);
  return cleaned || 'Sales_Order_Estimate';
};

/**
 * Generates and downloads a print-ready .xlsx Sales Order Estimate matching the EST2627 layout.
 * All Rate cells remain strictly blank with live Excel formulas for Amount, Totals, GST TAX, and Balances.
 */
export const downloadOrderEstimateExcel = async (
  config: EstimateExportConfig
): Promise<string> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hightone Ceramic Admin';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const sheet = workbook.addWorksheet(sanitizeSheetName(config.estimateCode || 'Estimate'), {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2
      }
    }
  });

  // 7-Column geometry matching EST2627 PDF proportions
  sheet.columns = [
    { key: 'productName', width: 34 },
    { key: 'grade', width: 9 },
    { key: 'colorCode', width: 13 },
    { key: 'packing', width: 10 },
    { key: 'qty', width: 11.5 },
    { key: 'rate', width: 11.5 },
    { key: 'amount', width: 14.5 }
  ];

  // ROW 1: Top Banner ("SALES ORDER" left | Estimate Code centered)
  sheet.mergeCells('A1:B1');
  sheet.mergeCells('C1:E1');
  const titleLeft = sheet.getCell('A1');
  titleLeft.value = 'SALES ORDER';
  titleLeft.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF000000' } };
  titleLeft.alignment = { horizontal: 'left', vertical: 'middle' };

  const titleCenter = sheet.getCell('C1');
  titleCenter.value = (config.estimateCode || 'EST2627').trim();
  titleCenter.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF000000' } };
  titleCenter.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  // ROW 2: Breathing space between title and boxed header
  sheet.getRow(2).height = 6;

  // ROWS 3-4: Boxed 2-Column Party & Voucher Header
  sheet.mergeCells('A3:D3');
  sheet.mergeCells('E3:G3');
  sheet.mergeCells('A4:D4');
  sheet.mergeCells('E4:G4');

  const nameCell = sheet.getCell('A3');
  nameCell.value = `Name        :  ${config.dealerName.trim()}`;
  nameCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  nameCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const voucherNoCell = sheet.getCell('E3');
  voucherNoCell.value = `Voucher No   :  ${config.voucherNo.trim()}`;
  voucherNoCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  voucherNoCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const addrCell = sheet.getCell('A4');
  addrCell.value = `Address     :  ${config.dealerAddress.trim()}`;
  addrCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  addrCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const voucherDtCell = sheet.getCell('E4');
  voucherDtCell.value = `Voucher Dt.  :  ${config.voucherDate.trim()}`;
  voucherDtCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  voucherDtCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 20;

  // Apply crisp outer box & center divider borders to rows 3-4
  for (let col = 1; col <= 7; col++) {
    const r3 = sheet.getCell(3, col);
    r3.border = {
      top: THIN_BLACK,
      left: col === 1 || col === 5 ? THIN_BLACK : undefined,
      right: col === 4 || col === 7 ? THIN_BLACK : undefined
    };

    const r4 = sheet.getCell(4, col);
    r4.border = {
      bottom: THIN_BLACK,
      left: col === 1 || col === 5 ? THIN_BLACK : undefined,
      right: col === 4 || col === 7 ? THIN_BLACK : undefined
    };
  }

  // ROW 5: 7-Column Table Header
  const headers = ['Product Name', 'Grade', 'Color/Code', 'Packing', 'Qty.', 'Rate', 'Amount'];
  const headerRow = sheet.getRow(5);
  headerRow.height = 21;
  headers.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: THIN_BLACK,
      right: THIN_BLACK
    };
  });

  // ROWS 6+: Line Items + Optional Blank Spacer Rows for A4 Proportion
  const firstItemRow = 6;
  const minBodyRows = 16;
  const totalBodyRows = Math.max(config.lines.length, minBodyRows);
  const lastBodyRow = firstItemRow + totalBodyRows - 1;

  let totalQty = 0;

  for (let i = 0; i < totalBodyRows; i++) {
    const r = firstItemRow + i;
    const row = sheet.getRow(r);
    row.height = 17.5;

    const line = config.lines[i];
    if (line) {
      totalQty += Number(line.quantity) || 0;

      const cProduct = row.getCell(1);
      cProduct.value = line.productName;
      cProduct.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cProduct.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      const cGrade = row.getCell(2);
      cGrade.value = line.grade;
      cGrade.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cGrade.alignment = { horizontal: 'center', vertical: 'middle' };

      const cColor = row.getCell(3);
      cColor.value = line.colorCode;
      cColor.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cColor.alignment = { horizontal: 'center', vertical: 'middle' };

      const cPacking = row.getCell(4);
      cPacking.value = line.packing;
      cPacking.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cPacking.alignment = { horizontal: 'center', vertical: 'middle' };

      const cQty = row.getCell(5);
      cQty.value = Number(line.quantity);
      cQty.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cQty.alignment = { horizontal: 'right', vertical: 'middle' };
      cQty.numFmt = '0.000';

      // Rate cell strictly blank for confidential dealer-specific entry in Excel
      const cRate = row.getCell(6);
      cRate.value = null;
      cRate.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cRate.alignment = { horizontal: 'right', vertical: 'middle' };
      cRate.numFmt = '0.00';

      // Live Amount formula = Qty * Rate
      const cAmount = row.getCell(7);
      cAmount.value = { formula: `E${r}*F${r}`, result: 0 };
      cAmount.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
      cAmount.alignment = { horizontal: 'right', vertical: 'middle' };
      cAmount.numFmt = '0.00';
    } else {
      // Clean spacer rows preserving vertical rules & ready for optional manual line additions
      row.getCell(1).font = { name: 'Arial', size: 9.5 };
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      row.getCell(2).font = { name: 'Arial', size: 9.5 };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).font = { name: 'Arial', size: 9.5 };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).font = { name: 'Arial', size: 9.5 };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

      const cQty = row.getCell(5);
      cQty.font = { name: 'Arial', size: 9.5 };
      cQty.alignment = { horizontal: 'right', vertical: 'middle' };
      cQty.numFmt = '0.000';

      const cRate = row.getCell(6);
      cRate.font = { name: 'Arial', size: 9.5 };
      cRate.alignment = { horizontal: 'right', vertical: 'middle' };
      cRate.numFmt = '0.00';

      const cAmount = row.getCell(7);
      cAmount.value = { formula: `IF(AND(E${r}="",F${r}=""),"",E${r}*F${r})` };
      cAmount.font = { name: 'Arial', size: 9.5 };
      cAmount.alignment = { horizontal: 'right', vertical: 'middle' };
      cAmount.numFmt = '0.00';
    }

    // Crisp vertical column dividers (no inner horizontal gridlines, matching PDF)
    for (let col = 1; col <= 7; col++) {
      row.getCell(col).border = {
        left: THIN_BLACK,
        right: THIN_BLACK
      };
    }
  }

  // SUBTOTAL BAR ROW: Vehicle No | Total Qty | TOTAL | Subtotal Amount
  const subtotalRow = lastBodyRow + 1;
  sheet.mergeCells(`A${subtotalRow}:D${subtotalRow}`);
  const subRowObj = sheet.getRow(subtotalRow);
  subRowObj.height = 20;

  const vehicleCell = sheet.getCell(`A${subtotalRow}`);
  vehicleCell.value = `Vehicle No : ${config.vehicleNo.trim()}`;
  vehicleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  vehicleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const totalQtyCell = sheet.getCell(`E${subtotalRow}`);
  totalQtyCell.value = {
    formula: `SUM(E${firstItemRow}:E${lastBodyRow})`,
    result: totalQty
  };
  totalQtyCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalQtyCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalQtyCell.numFmt = '0.000';

  const totalWordCell = sheet.getCell(`F${subtotalRow}`);
  totalWordCell.value = 'TOTAL';
  totalWordCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  totalWordCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const subtotalAmtCell = sheet.getCell(`G${subtotalRow}`);
  subtotalAmtCell.value = {
    formula: `SUM(G${firstItemRow}:G${lastBodyRow})`,
    result: 0
  };
  subtotalAmtCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  subtotalAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };
  subtotalAmtCell.numFmt = '0.00';

  for (let col = 1; col <= 7; col++) {
    const cell = subRowObj.getCell(col);
    cell.fill = GRAY_SHADE_FILL;
    cell.border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: col === 1 || col === 5 || col === 6 || col === 7 ? THIN_BLACK : undefined,
      right: col === 4 || col === 5 || col === 6 || col === 7 ? THIN_BLACK : undefined
    };
  }

  // FOOTER LEDGER ROWS
  const gstRow = subtotalRow + 1;
  const weightRow = subtotalRow + 2;
  const grandTotalRow = subtotalRow + 3;
  const prevBalRow = subtotalRow + 4;
  const currBalRow = subtotalRow + 5;

  // Row +1: Cash Rs. :- | Bill Amt Rs. :-  ||  GST TAX | [Editable GST %] | =ROUND(Subtotal * GST%, 0)
  sheet.mergeCells(`A${gstRow}:B${gstRow}`);
  sheet.mergeCells(`C${gstRow}:D${gstRow}`);
  sheet.getRow(gstRow).height = 21;

  const cashCell = sheet.getCell(`A${gstRow}`);
  cashCell.value = 'Cash Rs. :-';
  cashCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  cashCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const billAmtCell = sheet.getCell(`C${gstRow}`);
  billAmtCell.value = 'Bill Amt Rs. :-';
  billAmtCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  billAmtCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const gstLabelCell = sheet.getCell(`E${gstRow}`);
  gstLabelCell.value = 'GST TAX';
  gstLabelCell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
  gstLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const safeGstDecimal =
    Number.isFinite(config.gstPercent) && config.gstPercent >= 0 ? config.gstPercent / 100 : 0.09;
  const gstRateCell = sheet.getCell(`F${gstRow}`);
  gstRateCell.value = safeGstDecimal;
  gstRateCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  gstRateCell.alignment = { horizontal: 'right', vertical: 'middle' };
  gstRateCell.numFmt = '0.##%';
  gstRateCell.fill = EDITABLE_GST_FILL;

  const gstAmtCell = sheet.getCell(`G${gstRow}`);
  gstAmtCell.value = {
    formula: `ROUND(G${subtotalRow}*F${gstRow},0)`,
    result: 0
  };
  gstAmtCell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
  gstAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };
  gstAmtCell.numFmt = '#,##0.00';

  for (let col = 1; col <= 4; col++) {
    sheet.getCell(gstRow, col).border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: col === 1 ? THIN_BLACK : undefined,
      right: col === 4 ? THIN_BLACK : undefined
    };
  }
  sheet.getCell(gstRow, 5).border = { top: THIN_BLACK, left: THIN_BLACK };
  sheet.getCell(gstRow, 6).border = { top: THIN_BLACK, right: THIN_BLACK };
  sheet.getCell(gstRow, 7).border = { top: THIN_BLACK, left: THIN_BLACK, right: THIN_BLACK };

  // Row +2: Weight :- <kg>  ||  Continuation of GST TAX box
  sheet.mergeCells(`A${weightRow}:D${weightRow}`);
  sheet.getRow(weightRow).height = 21;

  const weightCell = sheet.getCell(`A${weightRow}`);
  weightCell.value = `Weight :-   ${config.totalWeightKg.toFixed(2)}`;
  weightCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  weightCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  for (let col = 1; col <= 4; col++) {
    sheet.getCell(weightRow, col).border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: col === 1 ? THIN_BLACK : undefined,
      right: col === 4 ? THIN_BLACK : undefined
    };
  }
  sheet.getCell(weightRow, 5).border = { left: THIN_BLACK, bottom: THIN_BLACK };
  sheet.getCell(weightRow, 6).border = { right: THIN_BLACK, bottom: THIN_BLACK };
  sheet.getCell(weightRow, 7).border = { left: THIN_BLACK, right: THIN_BLACK, bottom: THIN_BLACK };

  // Rows +3..+5 Left: Remarks Box spanning 3 rows
  sheet.mergeCells(`A${grandTotalRow}:D${currBalRow}`);
  const remarksCell = sheet.getCell(`A${grandTotalRow}`);
  remarksCell.value = config.remarks.trim()
    ? `Remarks :  ${config.remarks.trim()}`
    : 'Remarks :';
  remarksCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } };
  remarksCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };

  for (let r = grandTotalRow; r <= currBalRow; r++) {
    for (let col = 1; col <= 4; col++) {
      sheet.getCell(r, col).border = {
        top: r === grandTotalRow ? THIN_BLACK : undefined,
        bottom: r === currBalRow ? THIN_BLACK : undefined,
        left: col === 1 ? THIN_BLACK : undefined,
        right: col === 4 ? THIN_BLACK : undefined
      };
    }
  }

  // Row +3 Right: Total : | =ROUND(Subtotal + GST, 0)
  sheet.mergeCells(`E${grandTotalRow}:F${grandTotalRow}`);
  sheet.getRow(grandTotalRow).height = 20;

  const grandTotalLabel = sheet.getCell(`E${grandTotalRow}`);
  grandTotalLabel.value = 'Total :';
  grandTotalLabel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  grandTotalLabel.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const grandTotalVal = sheet.getCell(`G${grandTotalRow}`);
  grandTotalVal.value = {
    formula: `ROUND(G${subtotalRow}+G${gstRow},0)`,
    result: 0
  };
  grandTotalVal.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  grandTotalVal.alignment = { horizontal: 'right', vertical: 'middle' };
  grandTotalVal.numFmt = '#,##0';

  for (let col = 5; col <= 7; col++) {
    const cell = sheet.getCell(grandTotalRow, col);
    cell.fill = GRAY_SHADE_FILL;
    cell.border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: col === 5 || col === 7 ? THIN_BLACK : undefined,
      right: col === 6 || col === 7 ? THIN_BLACK : undefined
    };
  }

  // Row +4 Right: Previous Balance Rs. | Blank editable cell
  sheet.mergeCells(`E${prevBalRow}:F${prevBalRow}`);
  sheet.getRow(prevBalRow).height = 20;

  const prevBalLabel = sheet.getCell(`E${prevBalRow}`);
  prevBalLabel.value = 'Previous Balance Rs.';
  prevBalLabel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  prevBalLabel.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const prevBalVal = sheet.getCell(`G${prevBalRow}`);
  prevBalVal.value = null;
  prevBalVal.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
  prevBalVal.alignment = { horizontal: 'right', vertical: 'middle' };
  prevBalVal.numFmt = '#,##0.00';

  for (let col = 5; col <= 7; col++) {
    sheet.getCell(prevBalRow, col).border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: col === 5 || col === 7 ? THIN_BLACK : undefined,
      right: col === 6 || col === 7 ? THIN_BLACK : undefined
    };
  }

  // Row +5 Right: Current Balance Rs. | =GrandTotal + PreviousBalance
  sheet.mergeCells(`E${currBalRow}:F${currBalRow}`);
  sheet.getRow(currBalRow).height = 20;

  const currBalLabel = sheet.getCell(`E${currBalRow}`);
  currBalLabel.value = 'Current Balance Rs.';
  currBalLabel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  currBalLabel.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const currBalVal = sheet.getCell(`G${currBalRow}`);
  currBalVal.value = {
    formula: `G${grandTotalRow}+G${prevBalRow}`,
    result: 0
  };
  currBalVal.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  currBalVal.alignment = { horizontal: 'right', vertical: 'middle' };
  currBalVal.numFmt = '#,##0.00';

  for (let col = 5; col <= 7; col++) {
    const cell = sheet.getCell(currBalRow, col);
    cell.fill = GRAY_SHADE_FILL;
    cell.border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: col === 5 || col === 7 ? THIN_BLACK : undefined,
      right: col === 6 || col === 7 ? THIN_BLACK : undefined
    };
  }

  // Write to browser Blob and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const codePart = sanitizeFilenamePart(config.estimateCode, 'EST');
  const dealerPart = sanitizeFilenamePart(config.dealerName, 'Dealer');
  const voucherPart = sanitizeFilenamePart(config.voucherNo, 'Order');
  const filename = `${codePart}_${dealerPart}_${voucherPart}.xlsx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
};
