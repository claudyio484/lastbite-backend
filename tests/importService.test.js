'use strict';

const { normalizeRows, filterRows, applyDiscountRules, parseFile, buildPreview } = require('../src/services/importService');

// ─────────────────────────────────────────
// normalizeRows
// ─────────────────────────────────────────

describe('normalizeRows', () => {
  const mapping = {
    sku: 'SKU',
    name: 'Product',
    expiry_date: 'Expiry',
    quantity: 'Qty',
    price: 'Price',
    barcode: 'Barcode',
  };

  const today = new Date('2025-06-15');

  it('should normalize valid rows correctly', () => {
    const rows = [
      { SKU: 'ABC-001', Product: 'Milk', Expiry: '20/06/2025', Qty: '10', Price: '5.50', Barcode: '123456789' },
    ];

    const { normalized, errors } = normalizeRows(rows, mapping, today);

    expect(errors).toHaveLength(0);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].sku).toBe('ABC-001');
    expect(normalized[0].productName).toBe('Milk');
    expect(normalized[0].barcode).toBe('123456789');
    expect(normalized[0].daysToExpiry).toBe(5);
    expect(normalized[0].quantity).toBe(10);
    expect(normalized[0].originalPrice).toBe(5.5);
  });

  it('should parse DD/MM/YYYY date format', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '25/06/2025', Qty: '5', Price: '3.00', Barcode: '' },
    ];
    const { normalized } = normalizeRows(rows, mapping, today);
    expect(normalized[0].daysToExpiry).toBe(10);
  });

  it('should parse YYYY-MM-DD date format', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '2025-06-18', Qty: '5', Price: '3.00', Barcode: '' },
    ];
    const { normalized } = normalizeRows(rows, mapping, today);
    expect(normalized[0].daysToExpiry).toBe(3);
  });

  it('should error on invalid date', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: 'not-a-date', Qty: '5', Price: '3.00', Barcode: '' },
    ];
    const { normalized, errors } = normalizeRows(rows, mapping, today);
    expect(normalized).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('expiry_date');
    expect(errors[0].error).toContain('Invalid date');
  });

  it('should error on missing SKU', () => {
    const rows = [
      { SKU: '', Product: 'Bread', Expiry: '20/06/2025', Qty: '5', Price: '3.00', Barcode: '' },
    ];
    const { errors } = normalizeRows(rows, mapping, today);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('sku');
  });

  it('should error on missing product name', () => {
    const rows = [
      { SKU: 'A1', Product: '', Expiry: '20/06/2025', Qty: '5', Price: '3.00', Barcode: '' },
    ];
    const { errors } = normalizeRows(rows, mapping, today);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('name');
  });

  it('should error on zero quantity', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '20/06/2025', Qty: '0', Price: '3.00', Barcode: '' },
    ];
    const { errors } = normalizeRows(rows, mapping, today);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('quantity');
  });

  it('should error on negative quantity', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '20/06/2025', Qty: '-5', Price: '3.00', Barcode: '' },
    ];
    const { errors } = normalizeRows(rows, mapping, today);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('quantity');
  });

  it('should error on non-numeric price', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '20/06/2025', Qty: '5', Price: 'free', Barcode: '' },
    ];
    const { errors } = normalizeRows(rows, mapping, today);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('price');
  });

  it('should error on zero price', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '20/06/2025', Qty: '5', Price: '0', Barcode: '' },
    ];
    const { errors } = normalizeRows(rows, mapping, today);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('price');
  });

  it('should strip currency symbols from price', () => {
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '20/06/2025', Qty: '5', Price: 'AED 12.50', Barcode: '' },
    ];
    const { normalized, errors } = normalizeRows(rows, mapping, today);
    expect(errors).toHaveLength(0);
    expect(normalized[0].originalPrice).toBe(12.5);
  });

  it('should deduplicate by (sku, expiryDate) — merge quantities, keep lowest price', () => {
    const rows = [
      { SKU: 'A1', Product: 'Milk', Expiry: '20/06/2025', Qty: '5', Price: '4.00', Barcode: '' },
      { SKU: 'A1', Product: 'Milk', Expiry: '20/06/2025', Qty: '3', Price: '3.50', Barcode: '' },
    ];
    const { normalized } = normalizeRows(rows, mapping, today);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].quantity).toBe(8);      // 5 + 3
    expect(normalized[0].originalPrice).toBe(3.5); // min(4.00, 3.50)
  });

  it('should NOT deduplicate different expiry dates for same SKU', () => {
    const rows = [
      { SKU: 'A1', Product: 'Milk', Expiry: '20/06/2025', Qty: '5', Price: '4.00', Barcode: '' },
      { SKU: 'A1', Product: 'Milk', Expiry: '22/06/2025', Qty: '3', Price: '3.50', Barcode: '' },
    ];
    const { normalized } = normalizeRows(rows, mapping, today);
    expect(normalized).toHaveLength(2);
  });

  it('should handle barcode as null when mapping has no barcode', () => {
    const noBarcode = { sku: 'SKU', name: 'Product', expiry_date: 'Expiry', quantity: 'Qty', price: 'Price' };
    const rows = [
      { SKU: 'A1', Product: 'Bread', Expiry: '20/06/2025', Qty: '5', Price: '3.00' },
    ];
    const { normalized } = normalizeRows(rows, noBarcode, today);
    expect(normalized[0].barcode).toBeNull();
  });

  it('should correctly set row numbers in errors (accounting for header)', () => {
    const rows = [
      { SKU: 'A1', Product: 'Good', Expiry: '20/06/2025', Qty: '5', Price: '3.00', Barcode: '' },
      { SKU: '', Product: 'Bad', Expiry: '20/06/2025', Qty: '5', Price: '3.00', Barcode: '' },
    ];
    const { errors } = normalizeRows(rows, mapping, today);
    expect(errors[0].row).toBe(3); // row index 1 + 2 (1-based + header)
  });
});

// ─────────────────────────────────────────
// filterRows
// ─────────────────────────────────────────

describe('filterRows', () => {
  const makeRow = (daysToExpiry) => ({
    sku: `SKU-${daysToExpiry}`,
    productName: 'Test',
    barcode: null,
    expiryDate: new Date(),
    daysToExpiry,
    quantity: 1,
    originalPrice: 10,
  });

  it('should retain rows within the window (inclusive)', () => {
    const rows = [makeRow(0), makeRow(3), makeRow(7), makeRow(10)];
    const { retained } = filterRows(rows, 7, false);
    expect(retained).toHaveLength(3); // 0, 3, 7
  });

  it('should exclude rows beyond the window', () => {
    const rows = [makeRow(8), makeRow(15)];
    const { retained } = filterRows(rows, 7, false);
    expect(retained).toHaveLength(0);
  });

  it('should exclude expired rows when includeExpired is false', () => {
    const rows = [makeRow(-1), makeRow(-5), makeRow(3)];
    const { retained, expired } = filterRows(rows, 7, false);
    expect(retained).toHaveLength(1);
    expect(expired).toHaveLength(0);
  });

  it('should collect expired rows when includeExpired is true', () => {
    const rows = [makeRow(-1), makeRow(-5), makeRow(3)];
    const { retained, expired } = filterRows(rows, 7, true);
    expect(retained).toHaveLength(1);
    expect(expired).toHaveLength(2);
  });

  it('should include J-0 (same day expiry) in retained', () => {
    const rows = [makeRow(0)];
    const { retained } = filterRows(rows, 7, false);
    expect(retained).toHaveLength(1);
  });

  it('should retain row at exact window boundary', () => {
    const rows = [makeRow(7)];
    const { retained } = filterRows(rows, 7, false);
    expect(retained).toHaveLength(1);
  });
});

// ─────────────────────────────────────────
// applyDiscountRules
// ─────────────────────────────────────────

describe('applyDiscountRules', () => {
  const rules = [
    { days_lte: 7, discount_pct: 20 },
    { days_lte: 3, discount_pct: 40 },
    { days_lte: 2, discount_pct: 50 },
    { days_lte: 1, discount_pct: 60 },
  ];

  const makeRow = (daysToExpiry, price = 10) => ({
    sku: `SKU-${daysToExpiry}`,
    productName: 'Test',
    barcode: null,
    expiryDate: new Date(),
    daysToExpiry,
    quantity: 1,
    originalPrice: price,
  });

  it('should select tier 7 for J-5 product', () => {
    // 7 >= 5, and it's the smallest days_lte >= 5
    const result = applyDiscountRules([makeRow(5)], rules, false);
    expect(result[0].discountPct).toBe(20);
    expect(result[0].finalPrice).toBe(8); // 10 * 0.80
  });

  it('should select tier 3 for J-3 product (exact match)', () => {
    const result = applyDiscountRules([makeRow(3)], rules, false);
    expect(result[0].discountPct).toBe(40);
    expect(result[0].finalPrice).toBe(6); // 10 * 0.60
  });

  it('should select tier 1 for J-1 product (exact match)', () => {
    const result = applyDiscountRules([makeRow(1)], rules, false);
    expect(result[0].discountPct).toBe(60);
    expect(result[0].finalPrice).toBe(4); // 10 * 0.40
  });

  it('should select tier 1 for J-0 product (same day — edge case)', () => {
    const result = applyDiscountRules([makeRow(0)], rules, false);
    expect(result[0].discountPct).toBe(60); // tier 1 (1 >= 0)
    expect(result[0].finalPrice).toBe(4);
  });

  it('should fallback to highest tier when product is beyond all tiers', () => {
    const result = applyDiscountRules([makeRow(15)], rules, false);
    expect(result[0].discountPct).toBe(20); // highest days_lte = 7, discount = 20
  });

  it('should apply .90 rounding correctly — 9.87 → 9.90', () => {
    // 12.3375 with 20% off = 9.87 → should round to 9.90
    const result = applyDiscountRules([makeRow(5, 12.3375)], rules, true);
    expect(result[0].finalPrice).toBe(9.9);
  });

  it('should apply .90 rounding correctly — 10.05 → 9.90', () => {
    // 12.5625 with 20% off = 10.05 → floor(10.05) = 10, decimal = 0.05 < 0.9 → (10-1)+0.9 = 9.90
    const result = applyDiscountRules([makeRow(5, 12.5625)], rules, true);
    expect(result[0].finalPrice).toBe(9.9);
  });

  it('should NOT round prices below 0.90', () => {
    // price = 1.00, 60% off = 0.40 — too low to round
    const result = applyDiscountRules([makeRow(1, 1.0)], rules, true);
    expect(result[0].finalPrice).toBe(0.4);
  });

  it('should add aggressive_discount warning when discount >= 90%', () => {
    const aggressiveRules = [{ days_lte: 7, discount_pct: 95 }];
    const result = applyDiscountRules([makeRow(5, 100)], aggressiveRules, false);
    expect(result[0].warning).toBe('aggressive_discount');
    expect(result[0].finalPrice).toBe(5); // 100 * 0.05
  });

  it('should NOT add warning when discount < 90%', () => {
    const result = applyDiscountRules([makeRow(5)], rules, false);
    expect(result[0].warning).toBeUndefined();
  });

  it('should throw when rules array is empty', () => {
    expect(() => applyDiscountRules([makeRow(5)], [], false)).toThrow();
  });
});

// ─────────────────────────────────────────
// parseFile
// ─────────────────────────────────────────

describe('parseFile', () => {
  it('should parse a valid CSV buffer', () => {
    const csv = 'SKU,Name,Qty\nABC-001,Milk,10\nABC-002,Bread,5';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = parseFile(buffer, 'text/csv');

    expect(result.columns).toEqual(['SKU', 'Name', 'Qty']);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0].SKU).toBe('ABC-001');
  });

  it('should throw ImportParseError for empty CSV', () => {
    const buffer = Buffer.from('', 'utf-8');
    expect(() => parseFile(buffer, 'text/csv')).toThrow('empty');
  });

  it('should throw ImportParseError for CSV with only header', () => {
    const csv = 'SKU,Name,Qty\n';
    const buffer = Buffer.from(csv, 'utf-8');
    expect(() => parseFile(buffer, 'text/csv')).toThrow('no data rows');
  });
});

// ─────────────────────────────────────────
// buildPreview
// ─────────────────────────────────────────

describe('buildPreview', () => {
  it('should calculate distribution correctly', () => {
    const previews = [
      { discountPct: 20, finalPrice: 8, sku: 'A', productName: 'A', barcode: null, expiryDate: new Date(), daysToExpiry: 5, quantity: 1, originalPrice: 10 },
      { discountPct: 20, finalPrice: 4, sku: 'B', productName: 'B', barcode: null, expiryDate: new Date(), daysToExpiry: 6, quantity: 1, originalPrice: 5 },
      { discountPct: 40, finalPrice: 6, sku: 'C', productName: 'C', barcode: null, expiryDate: new Date(), daysToExpiry: 2, quantity: 1, originalPrice: 10 },
    ];

    const result = buildPreview(previews, [], [], 5, previews);

    expect(result.totalRows).toBe(5);
    expect(result.retained).toBe(3);
    expect(result.expired).toBe(0);
    expect(result.distribution).toEqual([
      { discountPct: 20, count: 2 },
      { discountPct: 40, count: 1 },
    ]);
  });
});
