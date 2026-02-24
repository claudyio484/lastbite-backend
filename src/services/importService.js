'use strict';

const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { differenceInCalendarDays, parse: dateParse, isValid } = require('date-fns');
const { ImportParseError, ImportValidationError, ImportConfirmError } = require('../errors/ImportErrors');

/** Maximum number of data rows allowed in an import file */
const MAX_ROW_LIMIT = 50_000;

// ─── parseFile ──────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded file buffer into an array of raw row objects.
 *
 * Supports CSV (text/csv, application/vnd.ms-excel with .csv extension)
 * and XLSX (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet).
 *
 * @param {Buffer} buffer    The raw file bytes
 * @param {string} mimetype  The MIME type reported by multer
 * @returns {{ columns: string[], rows: Array<Record<string, string>>, totalRows: number }}
 * @throws {ImportParseError} If the file is corrupt, empty, or exceeds MAX_ROW_LIMIT
 */
function parseFile(buffer, mimetype) {
  /** @type {Array<Record<string, string>>} */
  let rows;
  /** @type {string[]} */
  let columns;

  try {
    if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimetype === 'application/vnd.ms-excel') {
      // ── XLSX / XLS ──
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        throw new ImportParseError('Excel file contains no sheets');
      }
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
      if (rows.length === 0) {
        throw new ImportParseError('File contains no data rows');
      }
      columns = Object.keys(rows[0]);
      // Convert all values to strings for consistent downstream handling
      rows = rows.map((row) => {
        /** @type {Record<string, string>} */
        const stringRow = {};
        for (const key of columns) {
          stringRow[key] = String(row[key] ?? '');
        }
        return stringRow;
      });
    } else {
      // ── CSV ──
      const text = buffer.toString('utf-8');
      if (!text.trim()) {
        throw new ImportParseError('File is empty');
      }
      rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
      if (rows.length === 0) {
        throw new ImportParseError('File contains no data rows');
      }
      columns = Object.keys(rows[0]);
    }
  } catch (err) {
    if (err instanceof ImportParseError) throw err;
    throw new ImportParseError('Unable to parse file — it may be corrupt or in an unsupported format', {
      originalError: err.message,
    });
  }

  if (rows.length > MAX_ROW_LIMIT) {
    throw new ImportParseError(
      `File contains ${rows.length} rows which exceeds the ${MAX_ROW_LIMIT} row limit`,
      { rowCount: rows.length, limit: MAX_ROW_LIMIT },
    );
  }

  return { columns, rows, totalRows: rows.length };
}

// ─── Date parsing helpers ───────────────────────────────────────────────────────

/**
 * Try to parse a date string using multiple format strategies.
 * Order of attempts: DD/MM/YYYY → MM/DD/YYYY → YYYY-MM-DD → Excel serial number.
 *
 * @param {string} raw  The raw date value from the spreadsheet
 * @returns {Date | null}  Parsed date or null if unparseable
 */
function tryParseDate(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();

  // Attempt 1: DD/MM/YYYY (common UAE format)
  const ddMmYyyy = dateParse(trimmed, 'dd/MM/yyyy', new Date());
  if (isValid(ddMmYyyy)) return ddMmYyyy;

  // Attempt 2: MM/DD/YYYY (US format)
  const mmDdYyyy = dateParse(trimmed, 'MM/dd/yyyy', new Date());
  if (isValid(mmDdYyyy)) return mmDdYyyy;

  // Attempt 3: YYYY-MM-DD (ISO format)
  const isoDate = dateParse(trimmed, 'yyyy-MM-dd', new Date());
  if (isValid(isoDate)) return isoDate;

  // Attempt 4: Excel serial number (e.g. 45678 → a date)
  const serial = Number(trimmed);
  if (!isNaN(serial) && serial > 30000 && serial < 70000) {
    // Excel epoch: 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    const result = new Date(excelEpoch.getTime() + serial * 86400000);
    if (isValid(result)) return result;
  }

  return null;
}

// ─── normalizeRows ──────────────────────────────────────────────────────────────

/**
 * Extract, validate, and normalize raw rows using the user-supplied column mapping.
 *
 * - Parses expiry_date through multiple date formats
 * - Calculates days_to_expiry relative to `today`
 * - Validates quantity (integer > 0) and price (float > 0)
 * - Deduplicates by (sku, expiryDate): merges quantities, keeps lowest price
 *
 * @param {Array<Record<string, string>>} rows   Raw rows from parseFile
 * @param {{ sku: string, expiry_date: string, quantity: string, price: string, name: string, barcode?: string }} mapping
 * @param {Date} today  Reference date for days_to_expiry calculation
 * @returns {{ normalized: NormalizedRow[], errors: ParseError[] }}
 *
 * @typedef {{ sku: string, productName: string, barcode: string | null, expiryDate: Date, daysToExpiry: number, quantity: number, originalPrice: number }} NormalizedRow
 * @typedef {{ row: number, field: string, value: string, error: string }} ParseError
 */
function normalizeRows(rows, mapping, today) {
  /** @type {ParseError[]} */
  const errors = [];
  /** @type {Map<string, NormalizedRow>} keyed by "sku|isoDate" */
  const deduped = new Map();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // +2: 1-based + header row

    // ── SKU ──
    const sku = (raw[mapping.sku] ?? '').trim();
    if (!sku) {
      errors.push({ row: rowNum, field: 'sku', value: '', error: 'SKU is required' });
      continue;
    }

    // ── Product name ──
    const productName = (raw[mapping.name] ?? '').trim();
    if (!productName) {
      errors.push({ row: rowNum, field: 'name', value: '', error: 'Product name is required' });
      continue;
    }

    // ── Barcode (optional) ──
    const barcode = mapping.barcode ? (raw[mapping.barcode] ?? '').trim() || null : null;

    // ── Expiry date ──
    const rawDate = (raw[mapping.expiry_date] ?? '').trim();
    const expiryDate = tryParseDate(rawDate);
    if (!expiryDate) {
      errors.push({ row: rowNum, field: 'expiry_date', value: rawDate, error: 'Invalid date format' });
      continue;
    }

    const daysToExpiry = differenceInCalendarDays(expiryDate, today);

    // ── Quantity ──
    const rawQty = (raw[mapping.quantity] ?? '').trim();
    const quantity = parseInt(rawQty, 10);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ row: rowNum, field: 'quantity', value: rawQty, error: 'Quantity must be a positive integer' });
      continue;
    }

    // ── Price ──
    const rawPrice = (raw[mapping.price] ?? '').trim().replace(/[^0-9.]/g, '');
    const originalPrice = parseFloat(rawPrice);
    if (isNaN(originalPrice) || originalPrice <= 0) {
      errors.push({ row: rowNum, field: 'price', value: raw[mapping.price] ?? '', error: 'Price must be a positive number' });
      continue;
    }

    // ── Deduplicate by (sku, expiryDate) ──
    const isoDate = expiryDate.toISOString().slice(0, 10);
    const dedupeKey = `${sku}|${isoDate}`;

    const existing = deduped.get(dedupeKey);
    if (existing) {
      existing.quantity += quantity;
      existing.originalPrice = Math.min(existing.originalPrice, originalPrice);
    } else {
      deduped.set(dedupeKey, {
        sku,
        productName,
        barcode,
        expiryDate,
        daysToExpiry,
        quantity,
        originalPrice,
      });
    }
  }

  return { normalized: Array.from(deduped.values()), errors };
}

// ─── filterRows ─────────────────────────────────────────────────────────────────

/**
 * Split normalized rows into "retained" (within the expiry window) and "expired" buckets.
 *
 * @param {NormalizedRow[]} normalized  Normalized rows from normalizeRows
 * @param {number} windowDays          Maximum days_to_expiry to retain (inclusive)
 * @param {boolean} includeExpired     Whether to collect already-expired rows
 * @returns {{ retained: NormalizedRow[], expired: NormalizedRow[] }}
 */
function filterRows(normalized, windowDays, includeExpired) {
  /** @type {NormalizedRow[]} */
  const retained = [];
  /** @type {NormalizedRow[]} */
  const expired = [];

  for (const row of normalized) {
    if (row.daysToExpiry >= 0 && row.daysToExpiry <= windowDays) {
      retained.push(row);
    } else if (row.daysToExpiry < 0 && includeExpired) {
      expired.push(row);
    }
    // rows with daysToExpiry > windowDays are silently dropped
  }

  return { retained, expired };
}

// ─── applyDiscountRules ─────────────────────────────────────────────────────────

/**
 * Apply tiered discount rules to a set of normalized rows and produce deal previews.
 *
 * **Tier selection convention:**
 * The applied tier is the one with the LOWEST `days_lte` value that is still >= `days_to_expiry`.
 * Rules are sorted ascending by `days_lte`, then we find the first rule where
 * `rule.days_lte >= product.days_to_expiry`.
 *
 * If no rule matches (product expiry is beyond all tiers), the rule with the highest
 * `days_lte` is used as a fallback.
 *
 * **Examples** (rules: [1, 2, 3, 7]):
 *   - Product at J-5 (daysToExpiry=5) → tier 7  (7 >= 5, smallest matching)
 *   - Product at J-3 (daysToExpiry=3) → tier 3  (3 >= 3, exact match)
 *   - Product at J-1 (daysToExpiry=1) → tier 1  (1 >= 1, exact match)
 *   - Product at J-0 (daysToExpiry=0) → tier 1  (1 >= 0, edge case — same day)
 *
 * **Rounding (when `roundPrices` is true):**
 * Snap to the nearest X.90 value (0.90, 1.90, 2.90, …):
 *   - 9.87 → 9.90
 *   - 10.05 → 9.90
 *   - 10.50 → 10.90
 *   - price < 0.90 → keep as-is (no rounding)
 * Formula: `Math.round(price - 0.9) + 0.9`
 *
 * @param {NormalizedRow[]} rows      Rows to price
 * @param {Array<{ days_lte: number, discount_pct: number }>} rules  Discount tiers
 * @param {boolean} roundPrices       Whether to apply .90 rounding
 * @returns {DealPreview[]}
 *
 * @typedef {NormalizedRow & { discountPct: number, finalPrice: number, warning?: 'aggressive_discount' }} DealPreview
 */
function applyDiscountRules(rows, rules, roundPrices) {
  if (!rules || rules.length === 0) {
    throw new ImportValidationError([
      { row: 0, field: 'discount_rules', value: '[]', error: 'At least one discount rule is required' },
    ]);
  }

  const sortedRules = [...rules].sort((a, b) => a.days_lte - b.days_lte);

  return rows.map((row) => {
    // Find the tier: smallest days_lte that is still >= daysToExpiry
    let tier = sortedRules.find((r) => r.days_lte >= row.daysToExpiry);

    // Fallback: if no tier matches (product beyond all tiers), use the highest tier
    if (!tier) {
      tier = sortedRules[sortedRules.length - 1];
    }

    const discountPct = tier.discount_pct;
    let finalPrice = row.originalPrice * (1 - discountPct / 100);

    // Apply .90 rounding if enabled
    // Snap to the nearest X.90 value (e.g. 0.90, 1.90, 2.90, …).
    // Formula: shift by -0.9, round to nearest integer, shift back by +0.9.
    // Examples: 9.87 → 9.90, 10.05 → 9.90, 10.50 → 10.90
    if (roundPrices && finalPrice >= 0.90) {
      finalPrice = Math.round(finalPrice - 0.9) + 0.9;
      // Guard: rounding should never produce a negative price
      if (finalPrice < 0) finalPrice = row.originalPrice * (1 - discountPct / 100);
    }

    // Round to 2 decimal places for monetary precision
    finalPrice = Math.round(finalPrice * 100) / 100;

    /** @type {DealPreview} */
    const preview = {
      ...row,
      discountPct,
      finalPrice,
    };

    if (discountPct >= 90) {
      preview.warning = 'aggressive_discount';
    }

    return preview;
  });
}

// ─── buildPreview ───────────────────────────────────────────────────────────────

/**
 * Assemble the full ImportPreview response object for the /validate endpoint.
 *
 * @param {NormalizedRow[]} retained       Rows within the expiry window
 * @param {NormalizedRow[]} expired        Already-expired rows
 * @param {ParseError[]}   errors         Parsing/validation errors
 * @param {number}         originalTotal  Total rows in the uploaded file
 * @param {DealPreview[]}  previews       Priced deal previews
 * @returns {ImportPreview}
 *
 * @typedef {{ totalRows: number, retained: number, expired: number, skippedZeroQty: number, parseErrors: ParseError[], distribution: Array<{ discountPct: number, count: number }>, deals: DealPreview[] }} ImportPreview
 */
function buildPreview(retained, expired, errors, originalTotal, previews) {
  // Build distribution: group by discountPct
  /** @type {Map<number, number>} */
  const distMap = new Map();
  for (const deal of previews) {
    distMap.set(deal.discountPct, (distMap.get(deal.discountPct) || 0) + 1);
  }
  const distribution = Array.from(distMap.entries())
    .map(([discountPct, count]) => ({ discountPct, count }))
    .sort((a, b) => a.discountPct - b.discountPct);

  return {
    totalRows: originalTotal,
    retained: retained.length,
    expired: expired.length,
    skippedZeroQty: 0, // zero-qty rows are already rejected in normalizeRows
    parseErrors: errors,
    distribution,
    deals: previews,
  };
}

// ─── validateDiscountRules ──────────────────────────────────────────────────────

/**
 * Server-side validation of discount rules received from the client.
 *
 * Rules:
 *   - Array length: 1–10
 *   - days_lte: integer 1–90, no duplicates
 *   - discount_pct: integer 1–99
 *
 * @param {Array<{ days_lte: number, discount_pct: number }>} rules
 * @throws {ImportValidationError} If any rule is invalid
 */
function validateDiscountRules(rules) {
  /** @type {ParseError[]} */
  const errors = [];

  if (!Array.isArray(rules)) {
    errors.push({ row: 0, field: 'discount_rules', value: String(rules), error: 'discount_rules must be an array' });
    throw new ImportValidationError(errors);
  }

  if (rules.length < 1 || rules.length > 10) {
    errors.push({
      row: 0,
      field: 'discount_rules',
      value: String(rules.length),
      error: 'Must have between 1 and 10 discount rules',
    });
    throw new ImportValidationError(errors);
  }

  /** @type {Set<number>} */
  const seenDays = new Set();

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const idx = i + 1;

    if (typeof rule !== 'object' || rule === null) {
      errors.push({ row: idx, field: 'discount_rules', value: String(rule), error: 'Rule must be an object' });
      continue;
    }

    const daysLte = rule.days_lte;
    if (!Number.isInteger(daysLte) || daysLte < 1 || daysLte > 90) {
      errors.push({
        row: idx,
        field: 'days_lte',
        value: String(daysLte),
        error: 'days_lte must be an integer between 1 and 90',
      });
    } else if (seenDays.has(daysLte)) {
      errors.push({
        row: idx,
        field: 'days_lte',
        value: String(daysLte),
        error: `Duplicate days_lte value: ${daysLte}`,
      });
    } else {
      seenDays.add(daysLte);
    }

    const pct = rule.discount_pct;
    if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
      errors.push({
        row: idx,
        field: 'discount_pct',
        value: String(pct),
        error: 'discount_pct must be an integer between 1 and 99',
      });
    }
  }

  if (errors.length > 0) {
    throw new ImportValidationError(errors);
  }
}

// ─── validateColumnMapping ──────────────────────────────────────────────────────

/**
 * Validate that the column mapping references columns that exist in the data.
 *
 * @param {{ sku: string, expiry_date: string, quantity: string, price: string, name: string, barcode?: string }} mapping
 * @param {string[]} availableColumns  Column names from the parsed file
 * @throws {ImportValidationError}
 */
function validateColumnMapping(mapping, availableColumns) {
  /** @type {ParseError[]} */
  const errors = [];
  const required = ['sku', 'expiry_date', 'quantity', 'price', 'name'];

  for (const field of required) {
    const colName = mapping[field];
    if (!colName || typeof colName !== 'string') {
      errors.push({ row: 0, field, value: String(colName), error: `Column mapping for "${field}" is required` });
    } else if (!availableColumns.includes(colName)) {
      errors.push({ row: 0, field, value: colName, error: `Column "${colName}" does not exist in the file` });
    }
  }

  // barcode is optional but must reference an existing column if provided
  if (mapping.barcode && !availableColumns.includes(mapping.barcode)) {
    errors.push({ row: 0, field: 'barcode', value: mapping.barcode, error: `Column "${mapping.barcode}" does not exist in the file` });
  }

  if (errors.length > 0) {
    throw new ImportValidationError(errors);
  }
}

// ─── confirmImport ──────────────────────────────────────────────────────────────

/**
 * Execute the full import pipeline and persist results in a single Prisma transaction.
 *
 * Pipeline steps:
 *   1. Normalize raw rows → NormalizedRow[] + errors
 *   2. Filter by window → retained + expired
 *   3. Apply discount rules → DealPreview[]
 *   4. Transactionally:
 *      a. Create ImportBatch
 *      b. Upsert each retained deal (conflict on tenantId+sku+expiryDate → update)
 *      c. Mark expired rows as EXPIRED in DB if found
 *      d. Update ImportBatch status
 *
 * The entire operation succeeds or fails atomically.
 * Row-level parse errors are collected and stored in the ImportBatch.errors field.
 *
 * @param {string} tenantId  The authenticated tenant's ID
 * @param {{ column_mapping: object, window_days: number, include_expired: boolean, discount_rules: Array<{days_lte: number, discount_pct: number}>, round_prices: boolean, publish: boolean, raw_rows: Array<Record<string, string>> }} payload
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<{ batchId: string, publishedCount: number, draftCount: number, errorsCount: number }>}
 * @throws {ImportConfirmError}
 */
async function confirmImport(tenantId, payload, prisma) {
  const {
    column_mapping: mapping,
    window_days: windowDays,
    include_expired: includeExpired,
    discount_rules: discountRules,
    round_prices: roundPrices,
    publish,
    raw_rows: rawRows,
  } = payload;

  const today = new Date();

  // Step 1: Normalize
  const { normalized, errors: parseErrors } = normalizeRows(rawRows, mapping, today);

  // Step 2: Filter
  const { retained, expired } = filterRows(normalized, windowDays, includeExpired);

  // Step 3: Apply discount rules
  const previews = applyDiscountRules(retained, discountRules, roundPrices);

  const dealStatus = publish ? 'PUBLISHED' : 'DRAFT';
  let publishedCount = 0;
  let draftCount = 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 4a. Create ImportBatch
      const batch = await tx.importBatch.create({
        data: {
          tenantId,
          status: 'PROCESSING',
          totalRows: rawRows.length,
          retainedRows: retained.length,
          skippedRows: rawRows.length - retained.length - expired.length,
          errors: parseErrors,
        },
      });

      // 4b. Upsert retained deals
      for (const deal of previews) {
        await tx.deal.upsert({
          where: {
            tenantId_sku_expiryDate: {
              tenantId,
              sku: deal.sku,
              expiryDate: deal.expiryDate,
            },
          },
          create: {
            tenantId,
            importBatchId: batch.id,
            sku: deal.sku,
            productName: deal.productName,
            barcode: deal.barcode,
            expiryDate: deal.expiryDate,
            daysToExpiry: deal.daysToExpiry,
            originalPrice: deal.originalPrice,
            discountPct: deal.discountPct,
            finalPrice: deal.finalPrice,
            quantity: deal.quantity,
            status: dealStatus,
            source: 'CSV_IMPORT',
          },
          update: {
            importBatchId: batch.id,
            productName: deal.productName,
            barcode: deal.barcode,
            daysToExpiry: deal.daysToExpiry,
            originalPrice: deal.originalPrice,
            discountPct: deal.discountPct,
            finalPrice: deal.finalPrice,
            quantity: deal.quantity,
            status: dealStatus,
            source: 'CSV_IMPORT',
          },
        });

        if (publish) publishedCount++;
        else draftCount++;
      }

      // 4c. Mark expired rows
      if (includeExpired && expired.length > 0) {
        for (const row of expired) {
          await tx.deal.updateMany({
            where: {
              tenantId,
              sku: row.sku,
              expiryDate: row.expiryDate,
            },
            data: { status: 'EXPIRED' },
          });
        }
      }

      // 4d. Update batch status
      const finalStatus = parseErrors.length > 0 ? 'PARTIAL_ERROR' : 'SUCCESS';
      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status: finalStatus,
          publishedCount,
          draftCount,
        },
      });

      return { batchId: batch.id };
    });

    return {
      batchId: result.batchId,
      publishedCount,
      draftCount,
      errorsCount: parseErrors.length,
    };
  } catch (err) {
    if (err instanceof ImportValidationError) throw err;
    throw new ImportConfirmError(
      `Import transaction failed: ${err.message}`,
      undefined,
    );
  }
}

module.exports = {
  parseFile,
  normalizeRows,
  filterRows,
  applyDiscountRules,
  buildPreview,
  validateDiscountRules,
  validateColumnMapping,
  confirmImport,
};
