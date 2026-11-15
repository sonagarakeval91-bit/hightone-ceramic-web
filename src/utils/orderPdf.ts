import { jsPDF } from 'jspdf';
import { DealerOrderPayload } from '../types';
import { CompanyInfoMap } from '../services/googleSheetsService';

function getOrderSheetMeta(order: DealerOrderPayload) {
  const dateObj = order.timestamp ? new Date(order.timestamp) : new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const formattedDate = !isNaN(dateObj.getTime())
    ? `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()}`
    : new Date().toLocaleDateString('en-GB');

  const firmDisplay = (order.dealerInfo?.firmName || '').trim().toUpperCase();
  const personDisplay = (
    order.personName ||
    order.dealerInfo?.contactPerson ||
    order.dealerInfo?.firmName ||
    '—'
  ).toUpperCase();
  const phoneDisplay = order.dealerInfo?.phoneNumber
    ? `${order.dealerInfo.phoneCode || '+91'} ${order.dealerInfo.phoneNumber}`
    : '—';

  let requiredByDisplay = '';
  if (order.requiredDate) {
    const reqObj = new Date(`${order.requiredDate}T00:00:00`);
    const formattedReq = !isNaN(reqObj.getTime())
      ? `${pad(reqObj.getDate())}/${pad(reqObj.getMonth() + 1)}/${reqObj.getFullYear()}`
      : order.requiredDate;
    requiredByDisplay = `${formattedReq}${order.requiredPeriod ? ` (${order.requiredPeriod})` : ''}`;
  } else if (order.requiredPeriod) {
    requiredByDisplay = order.requiredPeriod;
  }

  const gradeTotals: Record<string, number> = {};
  const packingTotals: Record<string, number> = {};
  order.items.forEach((item) => {
    const g = item.grade || 'Uty';
    const p = item.packing || 'Box';
    gradeTotals[g] = (gradeTotals[g] || 0) + (item.totalQuantity || 0);
    packingTotals[p] = (packingTotals[p] || 0) + (item.totalQuantity || 0);
  });

  const gradeBreakdownStr = Object.entries(gradeTotals)
    .map(([g, q]) => `${g}: ${q}`)
    .join('  |  ');
  const packingBreakdownStr = Object.entries(packingTotals)
    .map(([p, q]) => `${p}: ${q}`)
    .join('  |  ');

  return {
    formattedDate,
    firmDisplay,
    personDisplay,
    phoneDisplay,
    requiredByDisplay,
    gradeBreakdownStr,
    packingBreakdownStr
  };
}

/**
 * Generates and directly downloads an A4 PDF Dealer Order Sheet WITHOUT opening any browser print dialog.
 */
export function downloadDealerOrderPDF(
  order: DealerOrderPayload,
  _companyInfo?: CompanyInfoMap,
  options?: { hideDealerContact?: boolean }
): void {
  const hideContact = Boolean(options?.hideDealerContact);
  const {
    formattedDate,
    firmDisplay,
    personDisplay,
    phoneDisplay,
    requiredByDisplay,
    gradeBreakdownStr,
    packingBreakdownStr
  } = getOrderSheetMeta(order);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const ensurePageSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      y = 14;
    }
  };

  // Top Header Strip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 46, 82);
  doc.text('HIGHTONE CERAMIC · DEALER ORDER SHEET', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Order Ref: ${order.orderId || 'DRAFT'}`, pageWidth - margin, y, { align: 'right' });
  y += 6;

  // Top Meta Row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  const metaParts: string[] = [];
  if (!hideContact) metaParts.push(`Mobile: ${phoneDisplay}`);
  if (requiredByDisplay) metaParts.push(`Required By: ${requiredByDisplay}`);
  metaParts.push(`Date: ${formattedDate}`);
  doc.text(metaParts.join('   |   '), margin, y);
  y += 4;

  // Organization & Dealer Name Box
  const hasDistinctFirm = Boolean(firmDisplay && firmDisplay !== personDisplay);
  const dealerBoxHeight = hasDistinctFirm ? 13 : 8.5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentWidth, dealerBoxHeight);

  doc.setFontSize(9.5);
  if (hasDistinctFirm) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Organization / Firm : ${firmDisplay}`, margin + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contact Person : ${personDisplay}`, margin + 3, y + 10.2);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text(
      firmDisplay ? `Organization / Dealer : ${firmDisplay}` : `Name : ${personDisplay}`,
      margin + 3,
      y + 5.5
    );
  }
  y += dealerBoxHeight + 3;

  // Main Table Column Geometry
  const colSrW = 14;
  const colQtyW = 24;
  const colDescW = contentWidth - colSrW - colQtyW;

  const drawTableHeader = () => {
    doc.setFillColor(242, 245, 249);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(margin, y, colSrW, 9, 'FD');
    doc.rect(margin + colSrW, y, colDescW, 9, 'FD');
    doc.rect(margin + colSrW + colDescW, y, colQtyW, 9, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Sr.', margin + colSrW / 2, y + 5.8, { align: 'center' });
    doc.text('DESCRIPTION & GRADE / PACKING / COLOR MATRIX', margin + colSrW + 3, y + 5.8);
    doc.text('Total Qty', margin + contentWidth - 2.5, y + 5.8, { align: 'right' });
    y += 9;
  };

  drawTableHeader();

  order.items.forEach((item, idx) => {
    const splits =
      item.colorSplits && item.colorSplits.length > 0
        ? item.colorSplits
        : [{ codeOrColor: 'White', quantity: item.totalQuantity || 0 }];

    // Wrap splits cleanly into rows of max 6 columns per row so it never overflows width
    const chunkSize = 6;
    const splitChunks: Array<typeof splits> = [];
    for (let i = 0; i < splits.length; i += chunkSize) {
      splitChunks.push(splits.slice(i, i + chunkSize));
    }

    const rowHeight = 10 + splitChunks.length * 10.5 + 2;
    if (y + rowHeight > pageHeight - 22) {
      doc.addPage();
      y = 14;
      drawTableHeader();
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, colSrW, rowHeight);
    doc.rect(margin + colSrW, y, colDescW, rowHeight);
    doc.rect(margin + colSrW + colDescW, y, colQtyW, rowHeight);

    // Sr. No.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(String(idx + 1), margin + colSrW / 2, y + 6, { align: 'center' });

    // Description Header + Packing/Grade tags
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const titleLines = doc.splitTextToSize(item.name, colDescW - 38);
    doc.text(titleLines[0] || item.name, margin + colSrW + 3, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(
      `[${item.packing || 'Box'}] [${item.grade || 'Uty'}]`,
      margin + colSrW + colDescW - 3,
      y + 5.5,
      { align: 'right' }
    );

    // Color/Code Split mini-boxes
    let matrixY = y + 8;
    splitChunks.forEach((chunk) => {
      const boxW = Math.min(24, (colDescW - 6) / Math.max(chunk.length, 1));
      chunk.forEach((split, sIdx) => {
        const bx = margin + colSrW + 3 + sIdx * boxW;
        doc.setFillColor(248, 250, 252);
        doc.rect(bx, matrixY, boxW, 4.5, 'FD');
        doc.rect(bx, matrixY + 4.5, boxW, 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        const label = String(split.codeOrColor || 'White').slice(0, 12);
        doc.text(label, bx + boxW / 2, matrixY + 3.2, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(String(split.quantity), bx + boxW / 2, matrixY + 8.1, { align: 'center' });
      });
      matrixY += 10.5;
    });

    // Total Quantity for batch
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(String(item.totalQuantity), margin + contentWidth - 3, y + rowHeight / 2 + 1.5, {
      align: 'right'
    });

    y += rowHeight;
  });

  // Footer Total Row
  ensurePageSpace(24);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentWidth, 8.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Weight : ${(order.totalWeightKg || 0).toFixed(2)} kg`, margin + 3, y + 5.7);
  doc.text(`Total : ${order.totalQuantity} Units`, margin + contentWidth - 3, y + 5.7, {
    align: 'right'
  });
  y += 8.5;

  // Grade & Packing Classification Strip
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, y, contentWidth, 8, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Grade Summary: ${gradeBreakdownStr || '—'}   |   Packing Summary: ${packingBreakdownStr || '—'}`,
    margin + 3,
    y + 5.2
  );
  y += 11;

  if (order.dealerInfo?.notes) {
    ensurePageSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Order Notes: ', margin, y);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(order.dealerInfo.notes, contentWidth - 22);
    doc.text(noteLines, margin + 21, y);
  }

  const safeOrderId = (order.orderId || 'Sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Hightone_Order_${safeOrderId}.pdf`);
}

/**
 * Opens an official printable factory dealer order report and invokes browser Print dialog.
 */
export function printDealerOrderPDF(
  order: DealerOrderPayload,
  _companyInfo?: CompanyInfoMap,
  options?: { hideDealerContact?: boolean }
): void {
  const hideContact = Boolean(options?.hideDealerContact);
  const printWindow = window.open('', '_blank', 'width=950,height=1150');
  if (!printWindow) {
    console.warn('Popup blocked when opening printable order sheet.');
    return;
  }

  const {
    formattedDate,
    firmDisplay,
    personDisplay,
    phoneDisplay,
    requiredByDisplay,
    gradeBreakdownStr,
    packingBreakdownStr
  } = getOrderSheetMeta(order);

  const hasDistinctFirm = Boolean(firmDisplay && firmDisplay !== personDisplay);

  const itemsRows = order.items
    .map((item, idx) => {
      const splits = item.colorSplits && item.colorSplits.length > 0
        ? item.colorSplits
        : [{ codeOrColor: 'White', quantity: item.totalQuantity || 0 }];

      const splitsCellsHeaders = splits
        .map(
          (split) => `
          <th style="border: 1px solid #000; padding: 3px 6px; font-size: 10px; font-weight: 600; text-align: center; background: #fff; min-width: 32px;">
            ${split.codeOrColor}
          </th>
        `
        )
        .join('');

      const splitsCellsValues = splits
        .map(
          (split) => `
          <td style="border: 1px solid #000; padding: 4px 6px; font-size: 11px; font-weight: 700; text-align: center; font-family: monospace;">
            ${split.quantity}
          </td>
        `
        )
        .join('');

      return `
        <tr style="border-bottom: 1px solid #000;">
          <td style="border-right: 1px solid #000; padding: 12px 6px; text-align: center; font-weight: 700; font-size: 12px; vertical-align: top;">
            ${idx + 1}
          </td>
          <td style="border-right: 1px solid #000; padding: 10px 14px; vertical-align: top;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
              <div style="font-weight: 700; font-size: 12px; color: #000; letter-spacing: -0.2px;">
                ${item.name}
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="border: 1px solid #000; padding: 2px 7px; font-size: 10px; font-weight: 700; text-transform: capitalize; background: #fff;">
                  ${item.packing || 'Box'}
                </span>
                <span style="border: 1px solid #000; padding: 2px 7px; font-size: 10px; font-weight: 700; background: #fff;">
                  ${item.grade || 'Uty'}
                </span>
              </div>
            </div>

            <div style="margin-top: 8px; max-width: 100%; overflow-x: auto;">
              <table style="border-collapse: collapse; border: 1px solid #000; margin: 0;">
                <thead>
                  <tr>
                    ${splitsCellsHeaders}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    ${splitsCellsValues}
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 800; font-size: 13px; font-family: monospace; vertical-align: middle;">
            ${item.totalQuantity}
          </td>
        </tr>
      `;
    })
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dealer Order Sheet</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 12mm 12mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
          color: #000000;
          margin: 0;
          padding: 12px;
          background: #ffffff;
          font-size: 11px;
        }
        .order-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .top-meta-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 8px;
        }
        .meta-text {
          font-size: 12px;
          font-weight: 600;
        }
        .dealer-box {
          width: 100%;
          border: 1px solid #000;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 12px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 8px;
        }
        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }
        table.main-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #000;
        }
        table.main-table th {
          border-bottom: 1.5px solid #000;
          border-right: 1px solid #000;
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
        }
        table.main-table th:last-child {
          border-right: none;
        }
        .footer-row {
          display: flex;
          justify-content: space-between;
          border: 1px solid #000;
          border-top: none;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 800;
          font-family: monospace;
          background: #fff;
        }
        .classification-summary {
          border: 1px solid #000;
          border-top: none;
          padding: 6px 14px;
          font-size: 10px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 8px;
          background: #fafafa;
        }
        .no-print {
          background: #0F2E52;
          color: #fff;
          padding: 10px 14px;
          margin-bottom: 16px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          border-radius: 4px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .no-print button {
          border: none;
          padding: 6px 14px;
          font-weight: 700;
          font-size: 12px;
          border-radius: 3px;
          cursor: pointer;
        }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <span style="font-size: 13px; font-weight: 600;">Hightone Ceramic · Dealer Order Sheet</span>
        <div style="display: flex; gap: 8px;">
          <button onclick="window.print()" style="background: #25D366; color: #fff;">
            Print Order Sheet
          </button>
          <button onclick="window.close()" style="background: #334155; color: #fff;">
            Close
          </button>
        </div>
      </div>

      <div class="order-container">
        <!-- Top Meta Row -->
        <div class="top-meta-row">
          ${hideContact ? '' : `<div class="meta-text">Mobile : <strong>${phoneDisplay}</strong></div>`}
          ${requiredByDisplay ? `<div class="meta-text">Required By : <strong>${requiredByDisplay}</strong></div>` : ''}
          <div class="meta-text">Date : <strong>${formattedDate}</strong></div>
        </div>

        <!-- Firm & Dealer Name Box -->
        <div class="dealer-box">
          ${
            hasDistinctFirm
              ? `<div>Firm : &nbsp;<strong>${firmDisplay}</strong></div><div>Name : &nbsp;<strong>${personDisplay}</strong></div>`
              : `<div>${firmDisplay ? 'Organization / Dealer' : 'Name'} : &nbsp;<strong>${firmDisplay || personDisplay}</strong></div>`
          }
        </div>

        <!-- Main Items Table -->
        <div class="table-wrap">
          <table class="main-table">
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">Sr.<br/>No.</th>
                <th style="text-align: center;">DESCRIPTION</th>
                <th style="width: 85px; text-align: right;">Total<br/>Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        <!-- Table Footer Strip -->
        <div class="footer-row">
          <div>Weight : ${(order.totalWeightKg || 0).toFixed(2)}</div>
          <div>Total &nbsp; ${order.totalQuantity}</div>
        </div>

        <!-- Classification Breakdown Summary -->
        <div class="classification-summary">
          <div><strong>Grade Summary:</strong> ${gradeBreakdownStr || '—'}</div>
          <div><strong>Packing Summary:</strong> ${packingBreakdownStr || '—'}</div>
        </div>

        ${order.dealerInfo?.notes ? `
        <div style="margin-top: 10px; font-size: 10px; color: #333; line-height: 1.4;">
          <strong>Order Notes:</strong> ${order.dealerInfo.notes}
        </div>
        ` : ''}
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
