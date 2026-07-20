/**
 * SUPPLEMENT REQUEST GENERATOR
 * Generates formatted supplement requests based on analysis findings
 */

export interface SupplementInput {
  missingScope?: Array<{
    category: string;
    description: string;
    estimatedValue?: number;
  }>;
  quantityDiscrepancies?: Array<{
    item: string;
    currentQuantity: number;
    expectedQuantity: number;
    unit: string;
    discrepancyAmount: number;
  }>;
  pricingSuppression?: Array<{
    category: string;
    description: string;
    percentBelow?: number;
    estimatedShortfall?: number;
  }>;
  vertical?: string;
  claimNumber?: string;
  propertyAddress?: string;
  dateOfLoss?: string;
  insuranceCarrier?: string;
}

export interface SupplementOutput {
  text: string;
  sections: {
    header: string;
    missingScope: string;
    quantityDiscrepancies: string;
    pricingSuppression: string;
    requestedAction: string;
    footer: string;
  };
  totalEstimatedValue: number;
}

/**
 * Generate supplement request from analysis findings
 */
export function generateSupplementRequest(input: SupplementInput): SupplementOutput {
  const sections = {
    header: generateHeader(input),
    missingScope: generateMissingScope(input.missingScope || []),
    quantityDiscrepancies: generateQuantityDiscrepancies(input.quantityDiscrepancies || []),
    pricingSuppression: generatePricingSuppression(input.pricingSuppression || []),
    requestedAction: generateRequestedAction(input),
    footer: generateFooter()
  };

  const text = [
    sections.header,
    sections.missingScope,
    sections.quantityDiscrepancies,
    sections.pricingSuppression,
    sections.requestedAction,
    sections.footer
  ]
    .filter(s => s.trim())
    .join('\n\n');

  const totalEstimatedValue = calculateTotalValue(input);

  return {
    text,
    sections,
    totalEstimatedValue
  };
}

function generateHeader(input: SupplementInput): string {
  const verticalTitle = getVerticalTitle(input.vertical);
  let header = `SUPPLEMENT REQUEST\n${verticalTitle ? `${verticalTitle} - ` : ''}Estimate Analysis\n`;
  header += '─'.repeat(60) + '\n\n';

  if (input.claimNumber) {
    header += `Claim Number: ${input.claimNumber}\n`;
  }
  if (input.propertyAddress) {
    header += `Property Address: ${input.propertyAddress}\n`;
  }
  if (input.dateOfLoss) {
    header += `Date of Loss: ${input.dateOfLoss}\n`;
  }
  if (input.insuranceCarrier) {
    header += `Insurance Carrier: ${input.insuranceCarrier}\n`;
  }

  header += `\nBased on analysis of the submitted insurance estimate, the following scope items appear to be missing, suppressed, or undercounted.`;

  return header;
}

function getVerticalTitle(vertical?: string): string {
  const titles: Record<string, string> = {
    roof: 'Roofing Estimate',
    water: 'Water Damage Estimate',
    fire: 'Fire Damage Estimate',
    interior: 'Interior Damage Estimate',
    contractor: 'Contractor Estimate Comparison',
    xactimate: 'Xactimate Estimate'
  };

  return vertical ? titles[vertical] || '' : '';
}

function generateMissingScope(items: SupplementInput['missingScope']): string {
  if (!items || items.length === 0) return '';

  let section = 'MISSING SCOPE ITEMS\n' + '─'.repeat(60) + '\n\n';
  section += 'The following scope items appear to be missing from the estimate:\n\n';

  items.forEach((item, index) => {
    section += `${index + 1}. ${item.category}\n`;
    section += `   ${item.description}\n`;
    if (item.estimatedValue) {
      section += `   Estimated Value: $${item.estimatedValue.toLocaleString()}\n`;
    }
    section += '\n';
  });

  return section;
}

function generateQuantityDiscrepancies(items: SupplementInput['quantityDiscrepancies']): string {
  if (!items || items.length === 0) return '';

  let section = 'QUANTITY DISCREPANCIES\n' + '─'.repeat(60) + '\n\n';
  section += 'The following items appear to have quantity discrepancies:\n\n';

  items.forEach((item, index) => {
    const difference = item.expectedQuantity - item.currentQuantity;
    section += `${index + 1}. ${item.item}\n`;
    section += `   Current Quantity: ${item.currentQuantity} ${item.unit}\n`;
    section += `   Expected Quantity: ${item.expectedQuantity} ${item.unit}\n`;
    section += `   Discrepancy: ${difference} ${item.unit}`;
    if (item.discrepancyAmount) {
      section += ` (approximately $${item.discrepancyAmount.toLocaleString()})`;
    }
    section += '\n\n';
  });

  return section;
}

function generatePricingSuppression(items: SupplementInput['pricingSuppression']): string {
  if (!items || items.length === 0) return '';

  let section = 'PRICING DISCREPANCIES\n' + '─'.repeat(60) + '\n\n';
  section += 'The following pricing discrepancies were identified:\n\n';

  items.forEach((item, index) => {
    section += `${index + 1}. ${item.category}\n`;
    section += `   ${item.description}\n`;
    if (item.percentBelow) {
      section += `   Pricing appears ${item.percentBelow}% below regional market averages\n`;
    }
    if (item.estimatedShortfall) {
      section += `   Estimated Shortfall: $${item.estimatedShortfall.toLocaleString()}\n`;
    }
    section += '\n';
  });

  return section;
}

function generateRequestedAction(input: SupplementInput): string {
  const verticalSpecificText = getVerticalSpecificActionText(input.vertical);

  let section = 'REQUESTED ACTION\n' + '─'.repeat(60) + '\n\n';
  section += 'Please review the above scope items and provide a revised estimate including:\n\n';
  section += '• All missing line items identified in this supplement request\n';
  section += '• Corrected quantities for items showing discrepancies\n';
  section += '• Pricing adjusted to reflect current regional market rates\n';

  if (verticalSpecificText) {
    section += '\n' + verticalSpecificText;
  }

  const totalValue = calculateTotalValue(input);
  if (totalValue > 0) {
    section += `\n\nEstimated Total Additional Value: $${totalValue.toLocaleString()}`;
  }

  return section;
}

function getVerticalSpecificActionText(vertical?: string): string {
  const texts: Record<string, string> = {
    roof: 'Please ensure all roofing components required by manufacturer specifications and building codes are included, including starter rows, drip edge, ice and water shield, and proper flashing at all transitions.',
    water: 'Please verify that all water damage mitigation and restoration scope is included, including proper drying equipment, antimicrobial treatment, insulation replacement, and complete interior finishing.',
    fire: 'Please ensure all fire restoration scope is included, including smoke sealing, thermal fogging, HVAC cleaning, insulation replacement, and complete interior reconstruction.',
    interior: 'Please verify that all interior finishing scope is included, with proper drywall panel breaks, insulation, texture matching, and full-room painting where necessary for acceptable results.',
    contractor: 'Please review the attached contractor estimate(s) which include the scope items and pricing identified in this supplement request, reflecting current market conditions for complete repairs.'
  };

  return vertical ? texts[vertical] || '' : '';
}

function generateFooter(): string {
  return '─'.repeat(60) + '\n\n' +
    'This supplement request is generated based on analysis of the submitted estimate.\n' +
    'All identified discrepancies should be verified through re-inspection if necessary.\n\n' +
    'Generated by Denial Appeal Pro - Structured Analysis Platform';
}

function calculateTotalValue(input: SupplementInput): number {
  let total = 0;

  if (input.missingScope) {
    total += input.missingScope.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);
  }

  if (input.quantityDiscrepancies) {
    total += input.quantityDiscrepancies.reduce((sum, item) => sum + (item.discrepancyAmount || 0), 0);
  }

  if (input.pricingSuppression) {
    total += input.pricingSuppression.reduce((sum, item) => sum + (item.estimatedShortfall || 0), 0);
  }

  return total;
}

/**
 * Format supplement for PDF export
 */
export function formatSupplementForPDF(supplement: SupplementOutput): string {
  // Add page breaks and formatting for PDF rendering
  return supplement.text
    .replace(/─{60}/g, '━'.repeat(60))
    .replace(/\n\n/g, '\n\n');
}

/**
 * Format supplement for plain text download
 */
export function formatSupplementForDownload(supplement: SupplementOutput): string {
  return supplement.text;
}
