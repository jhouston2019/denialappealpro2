/**
 * PDF Generation Utility with Watermark and Claim Information
 * Generates professional denial appeal reports with header and watermark
 */

export interface ClaimInformation {
  claimNumber?: string;
  propertyAddress?: string;
  dateOfLoss?: string;
  insuranceCarrier?: string;
}

export interface PDFHeaderData extends ClaimInformation {
  reportId: string;
  dateReviewed: string;
  estimateName: string;
}

/**
 * Generate PDF header HTML with claim information and watermark
 */
export function generatePDFHeader(data: PDFHeaderData): string {
  const currentDate = new Date(data.dateReviewed).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <div style="position: relative; padding: 30px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: white; margin-bottom: 30px; border-radius: 8px;">
      <!-- Watermark -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); opacity: 0.1; font-size: 72px; font-weight: bold; white-space: nowrap; pointer-events: none;">
        DENIAL APPEAL PRO
      </div>
      
      <!-- Header Content -->
      <div style="position: relative; z-index: 1;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: bold;">Denial Appeal Pro</h1>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Professional Estimate Analysis Report</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.9;">Report ID: ${data.reportId}</p>
            <p style="margin: 0; font-size: 12px; opacity: 0.9;">Date: ${currentDate}</p>
          </div>
        </div>
        
        ${data.claimNumber || data.propertyAddress || data.dateOfLoss || data.insuranceCarrier ? `
          <div style="border-top: 1px solid rgba(255,255,255,0.3); padding-top: 15px; margin-top: 15px;">
            <h2 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Claim Information</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 13px;">
              ${data.claimNumber ? `
                <div>
                  <span style="opacity: 0.8;">Claim Number:</span>
                  <strong style="margin-left: 8px;">${data.claimNumber}</strong>
                </div>
              ` : ''}
              ${data.insuranceCarrier ? `
                <div>
                  <span style="opacity: 0.8;">Carrier:</span>
                  <strong style="margin-left: 8px;">${data.insuranceCarrier}</strong>
                </div>
              ` : ''}
              ${data.propertyAddress ? `
                <div style="grid-column: span 2;">
                  <span style="opacity: 0.8;">Property:</span>
                  <strong style="margin-left: 8px;">${data.propertyAddress}</strong>
                </div>
              ` : ''}
              ${data.dateOfLoss ? `
                <div>
                  <span style="opacity: 0.8;">Date of Loss:</span>
                  <strong style="margin-left: 8px;">${new Date(data.dateOfLoss).toLocaleDateString('en-US')}</strong>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate PDF footer HTML with watermark and confidentiality notice
 */
export function generatePDFFooter(
  pageNumber: number, 
  totalPages: number,
  claimNumber?: string,
  propertyAddress?: string
): string {
  return `
    <div style="padding: 20px 30px; border-top: 2px solid #e5e7eb; margin-top: 30px; font-size: 11px; color: #6b7280;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="margin: 0; font-weight: 600; color: #dc2626;">CONFIDENTIAL - For Client Use Only</p>
          <p style="margin: 5px 0 0 0;">This report is provided for informational purposes only and does not constitute legal, financial, or professional advice.</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-weight: 600;">Denial Appeal Pro</p>
          <p style="margin: 5px 0 0 0;">Page ${pageNumber} of ${totalPages}</p>
        </div>
      </div>
      ${claimNumber || propertyAddress ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af;">
          ${claimNumber ? `<strong>CLAIM:</strong> ${claimNumber}` : ''} 
          ${claimNumber && propertyAddress ? ' | ' : ''}
          ${propertyAddress ? `<strong>PROPERTY:</strong> ${propertyAddress}` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate complete PDF HTML with watermark throughout
 */
export function generatePDFHTML(
  headerData: PDFHeaderData,
  contentHTML: string,
  totalPages: number = 1
): string {
  // Create watermark text with claim information
  const watermarkText = headerData.claimNumber 
    ? `${headerData.claimNumber} - CONFIDENTIAL`
    : 'DENIAL APPEAL PRO - CONFIDENTIAL';
  
  const watermarkSubtext = headerData.propertyAddress 
    ? headerData.propertyAddress.substring(0, 50)
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Denial Appeal Report - ${headerData.claimNumber || headerData.reportId}</title>
      <style>
        @page {
          margin: 0;
          size: letter;
        }
        
        body {
          margin: 0;
          padding: 40px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #1f2937;
          background: white;
          position: relative;
        }
        
        /* Main diagonal watermark with claim info */
        .watermark-page {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 72px;
          font-weight: bold;
          color: rgba(37, 99, 235, 0.08);
          white-space: nowrap;
          pointer-events: none;
          z-index: 0;
          text-align: center;
        }
        
        /* Secondary watermark with property address */
        .watermark-subtext {
          position: fixed;
          top: 60%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 24px;
          font-weight: 600;
          color: rgba(37, 99, 235, 0.06);
          white-space: nowrap;
          pointer-events: none;
          z-index: 0;
          margin-top: 60px;
        }
        
        /* Header watermark - top right corner */
        .watermark-header {
          position: fixed;
          top: 10px;
          right: 10px;
          font-size: 10px;
          font-weight: 600;
          color: rgba(37, 99, 235, 0.3);
          pointer-events: none;
          z-index: 1000;
          text-align: right;
          line-height: 1.4;
        }
        
        /* Footer watermark - bottom center */
        .watermark-footer {
          position: fixed;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          font-weight: 600;
          color: rgba(37, 99, 235, 0.3);
          pointer-events: none;
          z-index: 1000;
          text-align: center;
        }
        
        /* Content wrapper with higher z-index */
        .content {
          position: relative;
          z-index: 1;
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: #111827;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          position: relative;
          z-index: 1;
        }
        
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        
        th {
          background-color: #f3f4f6;
          font-weight: 600;
          color: #374151;
        }
        
        .severity-error {
          color: #dc2626;
          font-weight: 600;
        }
        
        .severity-warning {
          color: #f59e0b;
          font-weight: 600;
        }
        
        .severity-info {
          color: #2563eb;
          font-weight: 600;
        }
        
        .section {
          margin-bottom: 32px;
          page-break-inside: avoid;
          position: relative;
          z-index: 1;
        }
        
        .highlight-box {
          background: #eff6ff;
          border-left: 4px solid #2563eb;
          padding: 16px;
          margin: 16px 0;
          border-radius: 4px;
        }
        
        /* Print-specific watermarks */
        @media print {
          .watermark-page, .watermark-subtext, .watermark-header, .watermark-footer {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <!-- Main diagonal watermark -->
      <div class="watermark-page">${watermarkText}</div>
      ${watermarkSubtext ? `<div class="watermark-subtext">${watermarkSubtext}</div>` : ''}
      
      <!-- Header corner watermark -->
      <div class="watermark-header">
        ${headerData.claimNumber ? `CLAIM: ${headerData.claimNumber}<br/>` : ''}
        CONFIDENTIAL
      </div>
      
      <!-- Footer watermark -->
      <div class="watermark-footer">
        ${headerData.claimNumber || 'N/A'} | ${headerData.propertyAddress || 'Property Address Not Specified'} | Denial Appeal Pro
      </div>
      
      ${generatePDFHeader(headerData)}
      
      <div class="content">
        ${contentHTML}
      </div>
      
      ${generatePDFFooter(1, totalPages, headerData.claimNumber, headerData.propertyAddress)}
    </body>
    </html>
  `;
}
