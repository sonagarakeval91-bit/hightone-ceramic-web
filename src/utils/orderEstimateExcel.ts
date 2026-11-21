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
 * Expands a SavedDealerOrder into per-color/code estimate rows and pre-filled header metadata.
 */
export const buildDefaultEstimateConfig = (order: SavedDealerOrder): EstimateExportConfig => {
  const voucherDate = formatVoucherDateDDMMYYYY(order.timestamp);

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
    voucherNo,
    voucherDate,
    dealerName,
    dealerAddress,
    vehicleNo,
    gstPercent: 18,
    remarks,
    totalWeightKg,
    lines
  };
};

const BORDER_OUTER: Partial<ExcelJS.Border> = {
  style: 'medium',
  color: { argb: 'FF0F172A' }
};

const BORDER_THIN: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: 'FF334155' }
};

const BORDER_HAIR: Partial<ExcelJS.Border> = {
  style: 'hair',
  color: { argb: 'FFCBD5E1' }
};

const HEADER_BAND_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' }
};

const META_TINT_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8FAFC' }
};

const TOTAL_BAR_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' }
};

const EDITABLE_GST_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFEF9C3' }
};

const sanitizeFilenamePart = (val: string, fallback: string): string => {
  const cleaned = val
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return cleaned || fallback;
};

/**
 * Generates and downloads a print-ready, executive-formatted .xlsx Sales Order Estimate.
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

  const sheet = workbook.addWorksheet('Sales Order', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2
      }
    }
  });

  // Generous 7-Column widths so labels like "Previous Balance Rs." and "Current Balance Rs." never clip
  sheet.columns = [
    { key: 'productName', width: 35 },
    { key: 'grade', width: 9.5 },
    { key: 'colorCode', width: 13.5 },
    { key: 'packing', width: 10.5 },
    { key: 'qty', width: 13 },
    { key: 'rate', width: 13 },
    { key: 'amount', width: 16 }
  ];

  // ROW 1: Clean Executive Document Title (No EST2627 text)
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'SALES ORDER';
  titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  // ROW 2: Subtle visual breathing gap
  sheet.getRow(2).height = 8;

  // ROWS 3-4: Boxed 2-Column Party & Voucher Metadata
  // NOTE: Set style/border on the MASTER cell AFTER mergeCells so borders render cleanly on ALL 4 sides.
  sheet.mergeCells('A3:D3');
  sheet.mergeCells('E3:G3');
  sheet.mergeCells('A4:D4');
  sheet.mergeCells('E4:G4');
  sheet.getRow(3).height = 22;
  sheet.getRow(4).height = 22;

  const nameCell = sheet.getCell('A3');
  nameCell.value = `Name        :  ${config.dealerName.trim()}`;
  nameCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  nameCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  nameCell.fill = META_TINT_FILL;
  nameCell.border = {
    top: BORDER_OUTER,
    left: BORDER_OUTER,
    right: BORDER_THIN,
    bottom: BORDER_HAIR
  };

  const voucherNoCell = sheet.getCell('E3');
  voucherNoCell.value = `Voucher No   :  ${config.voucherNo.trim()}`;
  voucherNoCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  voucherNoCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  voucherNoCell.fill = META_TINT_FILL;
  voucherNoCell.border = {
    top: BORDER_OUTER,
    left: BORDER_THIN,
    right: BORDER_OUTER,
    bottom: BORDER_HAIR
  };

  const addrCell = sheet.getCell('A4');
  addrCell.value = `Address     :  ${config.dealerAddress.trim()}`;
  addrCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  addrCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  addrCell.fill = META_TINT_FILL;
  addrCell.border = {
    top: BORDER_HAIR,
    left: BORDER_OUTER,
    right: BORDER_THIN,
    bottom: BORDER_THIN
  };

  const voucherDtCell = sheet.getCell('E4');
  voucherDtCell.value = `Voucher Dt.  :  ${config.voucherDate.trim()}`;
  voucherDtCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  voucherDtCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  voucherDtCell.fill = META_TINT_FILL;
  voucherDtCell.border = {
    top: BORDER_HAIR,
    left: BORDER_THIN,
    right: BORDER_OUTER,
    bottom: BORDER_THIN
  };

  // ROW 5: Crisp Dark-Slate 7-Column Table Header
  const headers = ['Product Name', 'Grade', 'Color/Code', 'Packing', 'Qty.', 'Rate', 'Amount'];
  const headerRow = sheet.getRow(5);
  headerRow.height = 24;
  headers.forEach((label, idx) => {
    const col = idx + 1;
    const cell = headerRow.getCell(col);
    cell.value = label;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = HEADER_BAND_FILL;
    cell.alignment = {
      horizontal: col === 1 ? 'left' : col >= 5 ? 'right' : 'center',
      vertical: 'middle',
      indent: col === 1 ? 1 : 0
    };
    cell.border = {
      top: BORDER_THIN,
      bottom: BORDER_THIN,
      left: col === 1 ? BORDER_OUTER : BORDER_THIN,
      right: col === 7 ? BORDER_OUTER : BORDER_THIN
    };
  });

  // ROWS 6+: Line Items + Balanced Spacer Rows for Clean Printable Proportions
  const firstItemRow = 6;
  const minBodyRows = 15;
  const totalBodyRows = Math.max(config.lines.length, minBodyRows);
  const lastBodyRow = firstItemRow + totalBodyRows - 1;

  let totalQty = 0;

  for (let i = 0; i < totalBodyRows; i++) {
    const r = firstItemRow + i;
    const row = sheet.getRow(r);
    row.height = 19;

    const line = config.lines[i];
    if (line) {
      totalQty += Number(line.quantity) || 0;

      const cProduct = row.getCell(1);
      cProduct.value = line.productName;
      cProduct.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cProduct.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      const cGrade = row.getCell(2);
      cGrade.value = line.grade;
      cGrade.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cGrade.alignment = { horizontal: 'center', vertical: 'middle' };

      const cColor = row.getCell(3);
      cColor.value = line.colorCode;
      cColor.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cColor.alignment = { horizontal: 'center', vertical: 'middle' };

      const cPacking = row.getCell(4);
      cPacking.value = line.packing;
      cPacking.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cPacking.alignment = { horizontal: 'center', vertical: 'middle' };

      const cQty = row.getCell(5);
      cQty.value = Number(line.quantity);
      cQty.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cQty.alignment = { horizontal: 'right', vertical: 'middle' };
      cQty.numFmt = '0.000';

      // Rate cell strictly blank for confidential dealer-specific entry in Excel
      const cRate = row.getCell(6);
      cRate.value = null;
      cRate.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cRate.alignment = { horizontal: 'right', vertical: 'middle' };
      cRate.numFmt = '#,##0.00';

      // Live Amount formula = Qty * Rate
      const cAmount = row.getCell(7);
      cAmount.value = { formula: `E${r}*F${r}`, result: 0 };
      cAmount.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cAmount.alignment = { horizontal: 'right', vertical: 'middle' };
      cAmount.numFmt = '#,##0.00';
    } else {
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
      cRate.numFmt = '#,##0.00';

      const cAmount = row.getCell(7);
      cAmount.value = { formula: `IF(AND(E${r}="",F${r}=""),"",E${r}*F${r})` };
      cAmount.font = { name: 'Arial', size: 9.5 };
      cAmount.alignment = { horizontal: 'right', vertical: 'middle' };
      cAmount.numFmt = '#,##0.00';
    }

    // Crisp outer frame + vertical column dividers + subtle horizontal guide on filled rows
    for (let col = 1; col <= 7; col++) {
      row.getCell(col).border = {
        left: col === 1 ? BORDER_OUTER : BORDER_THIN,
        right: col === 7 ? BORDER_OUTER : BORDER_THIN,
        bottom: line ? BORDER_HAIR : undefined
      };
    }
  }

  // SUBTOTAL BAR ROW: Vehicle No | Total Qty | TOTAL | Subtotal Amount
  const subtotalRow = lastBodyRow + 1;
  sheet.mergeCells(`A${subtotalRow}:D${subtotalRow}`);
  sheet.getRow(subtotalRow).height = 22;

  const vehicleCell = sheet.getCell(`A${subtotalRow}`);
  vehicleCell.value = `Vehicle No :  ${config.vehicleNo.trim()}`;
  vehicleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  vehicleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  vehicleCell.fill = TOTAL_BAR_FILL;
  vehicleCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_OUTER,
    right: BORDER_THIN
  };

  const totalQtyCell = sheet.getCell(`E${subtotalRow}`);
  totalQtyCell.value = {
    formula: `SUM(E${firstItemRow}:E${lastBodyRow})`,
    result: totalQty
  };
  totalQtyCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  totalQtyCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalQtyCell.numFmt = '0.000';
  totalQtyCell.fill = TOTAL_BAR_FILL;
  totalQtyCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN
  };

  const totalWordCell = sheet.getCell(`F${subtotalRow}`);
  totalWordCell.value = 'TOTAL';
  totalWordCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  totalWordCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalWordCell.fill = TOTAL_BAR_FILL;
  totalWordCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN
  };

  const subtotalAmtCell = sheet.getCell(`G${subtotalRow}`);
  subtotalAmtCell.value = {
    formula: `SUM(G${firstItemRow}:G${lastBodyRow})`,
    result: 0
  };
  subtotalAmtCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  subtotalAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };
  subtotalAmtCell.numFmt = '#,##0.00';
  subtotalAmtCell.fill = TOTAL_BAR_FILL;
  subtotalAmtCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_OUTER
  };

  // FOOTER LEDGER ROWS (All merged blocks bordered cleanly on master cells)
  const gstRow = subtotalRow + 1;
  const weightRow = subtotalRow + 2;
  const grandTotalRow = subtotalRow + 3;
  const prevBalRow = subtotalRow + 4;
  const currBalRow = subtotalRow + 5;

  // Row +1: Cash Rs. :- | Bill Amt Rs. :- || GST TAX | [Editable GST %] | =ROUND(Subtotal * GST%, 0)
  sheet.mergeCells(`A${gstRow}:B${gstRow}`);
  sheet.mergeCells(`C${gstRow}:D${gstRow}`);
  sheet.getRow(gstRow).height = 22;

  const cashCell = sheet.getCell(`A${gstRow}`);
  cashCell.value = 'Cash Rs. :-';
  cashCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  cashCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  cashCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_OUTER,
    right: BORDER_HAIR
  };

  const billAmtCell = sheet.getCell(`C${gstRow}`);
  billAmtCell.value = 'Bill Amt Rs. :-';
  billAmtCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  billAmtCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  billAmtCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_HAIR,
    right: BORDER_THIN
  };

  const gstLabelCell = sheet.getCell(`E${gstRow}`);
  gstLabelCell.value = 'GST TAX';
  gstLabelCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  gstLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  gstLabelCell.border = {
    top: BORDER_THIN,
    left: BORDER_THIN,
    bottom: BORDER_HAIR
  };

  const safeGstPct =
    Number.isFinite(config.gstPercent) && config.gstPercent >= 0 ? config.gstPercent : 18;
  const gstRateCell = sheet.getCell(`F${gstRow}`);
  gstRateCell.value = safeGstPct / 100;
  gstRateCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  gstRateCell.alignment = { horizontal: 'right', vertical: 'middle' };
  gstRateCell.numFmt = Number.isInteger(safeGstPct) ? '0%' : '0.0%';
  gstRateCell.fill = EDITABLE_GST_FILL;
  gstRateCell.border = {
    top: BORDER_THIN,
    left: BORDER_HAIR,
    right: BORDER_THIN,
    bottom: BORDER_HAIR
  };

  const gstAmtCell = sheet.getCell(`G${gstRow}`);
  gstAmtCell.value = {
    formula: `ROUND(G${subtotalRow}*F${gstRow},0)`,
    result: 0
  };
  gstAmtCell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
  gstAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };
  gstAmtCell.numFmt = '#,##0.00';
  gstAmtCell.border = {
    top: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_OUTER,
    bottom: BORDER_HAIR
  };

  // Row +2: Weight :- <kg> || Clean GST block lower cell
  sheet.mergeCells(`A${weightRow}:D${weightRow}`);
  sheet.mergeCells(`E${weightRow}:F${weightRow}`);
  sheet.getRow(weightRow).height = 22;

  const weightCell = sheet.getCell(`A${weightRow}`);
  weightCell.value = `Weight :-   ${config.totalWeightKg.toFixed(2)} kg`;
  weightCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  weightCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  weightCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_OUTER,
    right: BORDER_THIN
  };

  const gstSpacerLabel = sheet.getCell(`E${weightRow}`);
  gstSpacerLabel.value = '';
  gstSpacerLabel.border = {
    left: BORDER_THIN,
    right: BORDER_THIN,
    bottom: BORDER_THIN
  };

  const gstSpacerAmt = sheet.getCell(`G${weightRow}`);
  gstSpacerAmt.value = '';
  gstSpacerAmt.border = {
    left: BORDER_THIN,
    right: BORDER_OUTER,
    bottom: BORDER_THIN
  };

  // Rows +3..+5 Left: Remarks Box spanning 3 rows with full outer border
  sheet.mergeCells(`A${grandTotalRow}:D${currBalRow}`);
  const remarksCell = sheet.getCell(`A${grandTotalRow}`);
  remarksCell.value = config.remarks.trim()
    ? `Remarks :  ${config.remarks.trim()}`
    : 'Remarks :';
  remarksCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  remarksCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
  remarksCell.border = {
    top: BORDER_THIN,
    bottom: BORDER_OUTER,
    left: BORDER_OUTER,
    right: BORDER_THIN
  };

  // Row +3 Right: Total : | =ROUND(Subtotal + GST, 0)
  sheet.mergeCells(`E${grandTotalRow}:F${grandTotalRow}`);
  sheet.getRow(grandTotalRow).height = 22;

  const grandTotalLabel = sheet.getCell(`E${grandTotalRow}`);
  grandTotalLabel.value = 'Total :';
  grandTotalLabel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  grandTotalLabel.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  grandTotalLabel.fill = TOTAL_BAR_FILL;
  grandTotalLabel.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN
  };

  const grandTotalVal = sheet.getCell(`G${grandTotalRow}`);
  grandTotalVal.value = {
    formula: `ROUND(G${subtotalRow}+G${gstRow},0)`,
    result: 0
  };
  grandTotalVal.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  grandTotalVal.alignment = { horizontal: 'right', vertical: 'middle' };
  grandTotalVal.numFmt = '#,##0.00';
  grandTotalVal.fill = TOTAL_BAR_FILL;
  grandTotalVal.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_OUTER
  };

  // Row +4 Right: Previous Balance Rs. | Blank editable cell
  sheet.mergeCells(`E${prevBalRow}:F${prevBalRow}`);
  sheet.getRow(prevBalRow).height = 22;

  const prevBalLabel = sheet.getCell(`E${prevBalRow}`);
  prevBalLabel.value = 'Previous Balance Rs.';
  prevBalLabel.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  prevBalLabel.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  prevBalLabel.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN
  };

  const prevBalVal = sheet.getCell(`G${prevBalRow}`);
  prevBalVal.value = null;
  prevBalVal.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
  prevBalVal.alignment = { horizontal: 'right', vertical: 'middle' };
  prevBalVal.numFmt = '#,##0.00';
  prevBalVal.border = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_OUTER
  };

  // Row +5 Right: Current Balance Rs. | =GrandTotal + PreviousBalance
  sheet.mergeCells(`E${currBalRow}:F${currBalRow}`);
  sheet.getRow(currBalRow).height = 22;

  const currBalLabel = sheet.getCell(`E${currBalRow}`);
  currBalLabel.value = 'Current Balance Rs.';
  currBalLabel.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  currBalLabel.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  currBalLabel.fill = TOTAL_BAR_FILL;
  currBalLabel.border = {
    top: BORDER_THIN,
    bottom: BORDER_OUTER,
    left: BORDER_THIN,
    right: BORDER_THIN
  };

  const currBalVal = sheet.getCell(`G${currBalRow}`);
  currBalVal.value = {
    formula: `G${grandTotalRow}+G${prevBalRow}`,
    result: 0
  };
  currBalVal.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  currBalVal.alignment = { horizontal: 'right', vertical: 'middle' };
  currBalVal.numFmt = '#,##0.00';
  currBalVal.fill = TOTAL_BAR_FILL;
  currBalVal.border = {
    top: BORDER_THIN,
    bottom: BORDER_OUTER,
    left: BORDER_THIN,
    right: BORDER_OUTER
  };

  // Write to browser Blob and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const dealerPart = sanitizeFilenamePart(config.dealerName, 'Dealer');
  const voucherPart = sanitizeFilenamePart(config.voucherNo, 'Order');
  const filename = `SalesOrder_${dealerPart}_${voucherPart}.xlsx`;

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
