'use strict';

const prisma = require('../config/prisma');
const importService = require('../services/importService');

// ─── POST /parse ────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded CSV or XLSX file and return column names + preview rows.
 * No database writes occur at this step.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const parseFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { columns, rows, totalRows } = importService.parseFile(
      req.file.buffer,
      req.file.mimetype,
    );

    // Return ALL rows so the client can send them to /validate and /confirm.
    // Also include first 10 as preview_rows for backwards compatibility.
    const previewRows = rows.slice(0, 10);

    return res.json({
      success: true,
      data: {
        columns,
        rows,
        preview_rows: previewRows,
        total_rows: totalRows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /validate ─────────────────────────────────────────────────────────────

/**
 * Run the full normalization → filter → pricing pipeline on raw_rows
 * and return a detailed preview. No database writes.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const validateImport = async (req, res, next) => {
  try {
    const {
      column_mapping: mapping,
      window_days: windowDays,
      include_expired: includeExpired,
      discount_rules: discountRules,
      round_prices: roundPrices,
      raw_rows: rawRows,
    } = req.body;

    // ── Input validation ──
    if (!mapping || typeof mapping !== 'object') {
      return res.status(400).json({ success: false, message: 'column_mapping is required' });
    }
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'raw_rows must be a non-empty array' });
    }
    if (typeof windowDays !== 'number' || windowDays < 1 || windowDays > 90) {
      return res.status(400).json({ success: false, message: 'window_days must be between 1 and 90' });
    }

    // Validate discount rules server-side
    importService.validateDiscountRules(discountRules);

    // Validate column mapping against available columns
    const availableColumns = Object.keys(rawRows[0]);
    importService.validateColumnMapping(mapping, availableColumns);

    const today = new Date();

    // Step 1: Normalize
    const { normalized, errors } = importService.normalizeRows(rawRows, mapping, today);

    // Step 2: Filter by window
    const { retained, expired } = importService.filterRows(
      normalized,
      windowDays,
      includeExpired === true,
    );

    // Step 3: Apply discount rules
    const previews = importService.applyDiscountRules(retained, discountRules, roundPrices === true);

    // Step 4: Build preview
    const preview = importService.buildPreview(retained, expired, errors, rawRows.length, previews);

    return res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
};

// ─── POST /confirm ──────────────────────────────────────────────────────────────

/**
 * Execute the full import pipeline and persist all deals in a single transaction.
 * Requires the same payload as /validate plus a `publish` flag.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const confirmImport = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const {
      column_mapping,
      window_days,
      include_expired,
      discount_rules,
      round_prices,
      publish,
      raw_rows,
    } = req.body;

    // ── Input validation ──
    if (!column_mapping || typeof column_mapping !== 'object') {
      return res.status(400).json({ success: false, message: 'column_mapping is required' });
    }
    if (!Array.isArray(raw_rows) || raw_rows.length === 0) {
      return res.status(400).json({ success: false, message: 'raw_rows must be a non-empty array' });
    }
    if (typeof window_days !== 'number' || window_days < 1 || window_days > 90) {
      return res.status(400).json({ success: false, message: 'window_days must be between 1 and 90' });
    }

    importService.validateDiscountRules(discount_rules);

    const availableColumns = Object.keys(raw_rows[0]);
    importService.validateColumnMapping(column_mapping, availableColumns);

    const result = await importService.confirmImport(
      tenantId,
      {
        column_mapping,
        window_days,
        include_expired: include_expired === true,
        discount_rules,
        round_prices: round_prices === true,
        publish: publish === true,
        raw_rows,
      },
      prisma,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: req.user.id,
        action: 'IMPORT_PRODUCTS',
        entity: 'import_batch',
        entityId: result.batchId,
        details: {
          publishedCount: result.publishedCount,
          draftCount: result.draftCount,
          errorsCount: result.errorsCount,
        },
        ip: req.ip,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        batch_id: result.batchId,
        published_count: result.publishedCount,
        draft_count: result.draftCount,
        errors_count: result.errorsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /rules ─────────────────────────────────────────────────────────────────

/**
 * Return the authenticated tenant's saved discount rules.
 * If none exist yet, return sensible defaults.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getRules = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const rules = await prisma.storeDiscountRules.findUnique({
      where: { tenantId },
    });

    if (!rules) {
      return res.json({
        success: true,
        data: {
          rules: [
            { days_lte: 7, discount_pct: 20 },
            { days_lte: 3, discount_pct: 40 },
            { days_lte: 1, discount_pct: 60 },
          ],
          round_prices: false,
          default_window: 7,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        rules: rules.rules,
        round_prices: rules.roundPrices,
        default_window: rules.defaultWindow,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /rules ─────────────────────────────────────────────────────────────────

/**
 * Create or update the authenticated tenant's discount rules.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const upsertRules = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { rules, round_prices, default_window } = req.body;

    // Validate rules
    importService.validateDiscountRules(rules);

    if (typeof default_window !== 'number' || default_window < 1 || default_window > 90) {
      return res.status(400).json({ success: false, message: 'default_window must be between 1 and 90' });
    }

    const saved = await prisma.storeDiscountRules.upsert({
      where: { tenantId },
      create: {
        tenantId,
        rules,
        roundPrices: round_prices === true,
        defaultWindow: default_window,
      },
      update: {
        rules,
        roundPrices: round_prices === true,
        defaultWindow: default_window,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: req.user.id,
        action: 'UPDATE_DISCOUNT_RULES',
        entity: 'store_discount_rules',
        entityId: saved.id,
        details: { rulesCount: rules.length, roundPrices: round_prices, defaultWindow: default_window },
        ip: req.ip,
      },
    });

    return res.json({
      success: true,
      data: {
        rules: saved.rules,
        round_prices: saved.roundPrices,
        default_window: saved.defaultWindow,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  parseFile,
  validateImport,
  confirmImport,
  getRules,
  upsertRules,
};
