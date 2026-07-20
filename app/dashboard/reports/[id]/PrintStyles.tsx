'use client';

interface PrintStylesProps {
  claimNumber: string;
  propertyAddress: string;
}

export default function PrintStyles({ claimNumber, propertyAddress }: PrintStylesProps) {
  return (
    <style jsx global>{`
      @media print {
        body {
          background: white !important;
          position: relative;
        }
        
        /* Hide navigation and buttons */
        header, nav, .no-print, button {
          display: none !important;
        }
        
        /* Print watermark - diagonal across page */
        body::before {
          content: "${claimNumber || 'CONFIDENTIAL'} - ${propertyAddress?.substring(0, 30) || 'DENIAL APPEAL PRO'}";
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 48px;
          font-weight: bold;
          color: rgba(37, 99, 235, 0.08);
          white-space: nowrap;
          pointer-events: none;
          z-index: 0;
        }
        
        /* Print header - top of every page */
        body::after {
          content: "CONFIDENTIAL | Claim: ${claimNumber || 'N/A'} | ${propertyAddress?.substring(0, 40) || 'N/A'}";
          position: fixed;
          top: 10px;
          right: 10px;
          font-size: 9px;
          font-weight: 600;
          color: rgba(37, 99, 235, 0.4);
          pointer-events: none;
          z-index: 1000;
        }
        
        .print-section {
          page-break-inside: avoid;
          break-inside: avoid;
          position: relative;
          z-index: 1;
        }
        
        /* Color adjustments for print */
        .bg-slate-950, .bg-slate-900 {
          background: white !important;
        }
        .text-slate-50, .text-slate-100, .text-slate-200 {
          color: #000 !important;
        }
        .text-slate-400, .text-slate-500 {
          color: #666 !important;
        }
        .border-slate-800, .border-slate-700 {
          border-color: #ddd !important;
        }
        
        /* Table styling */
        table {
          border-collapse: collapse;
          position: relative;
          z-index: 1;
        }
        th, td {
          border: 1px solid #ddd !important;
          padding: 8px !important;
        }
        
        /* Print footer on every page */
        @page {
          margin-bottom: 40px;
        }
        
        /* Ensure watermarks print */
        * {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `}</style>
  );
}
