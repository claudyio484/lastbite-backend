const prisma = require('../config/prisma');
const { v4: uuidv4 } = require('uuid');

// GET /api/kyc/status
const getKycStatus = async (req, res) => {
  try {
    const kyc = await prisma.merchantKyc.findUnique({
      where: { tenantId: req.tenantId },
    });
    res.json({ success: true, data: kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/kyc/step1 - Business Details
const submitStep1 = async (req, res) => {
  try {
    const {
      registeredCompanyName, storeName, tradeLicenceNumber,
      issuingAuthority, vatTrn, licenceExpiryDate,
    } = req.body;

    const kyc = await prisma.merchantKyc.upsert({
      where: { tenantId: req.tenantId },
      update: { registeredCompanyName, storeName, tradeLicenceNumber, issuingAuthority, vatTrn, licenceExpiryDate: licenceExpiryDate ? new Date(licenceExpiryDate) : null },
      create: { tenantId: req.tenantId, registeredCompanyName, storeName, tradeLicenceNumber, issuingAuthority, vatTrn, licenceExpiryDate: licenceExpiryDate ? new Date(licenceExpiryDate) : null },
    });

    res.json({ success: true, data: kyc, nextStep: 2 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/kyc/step2 - Upload Documents (URLs from GCS)
const submitStep2 = async (req, res) => {
  try {
    const { tradeLicenceUrl, emiratesIdUrl, vatCertificateUrl } = req.body;

    if (!tradeLicenceUrl || !emiratesIdUrl) {
      return res.status(400).json({ success: false, message: 'Trade Licence and Emirates ID are required' });
    }

    const kyc = await prisma.merchantKyc.update({
      where: { tenantId: req.tenantId },
      data: { tradeLicenceUrl, emiratesIdUrl, vatCertificateUrl },
    });

    res.json({ success: true, data: kyc, nextStep: 3 });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/kyc/step3 - Payout Details + Submit Application
const submitStep3 = async (req, res) => {
  try {
    const { bankAccountHolder, bankName, iban } = req.body;

    if (!bankAccountHolder || !bankName || !iban) {
      return res.status(400).json({ success: false, message: 'All payout fields are required' });
    }

    // Validate UAE IBAN format (AE + 21 digits)
    const ibanClean = iban.replace(/\s/g, '');
    if (!ibanClean.match(/^AE\d{21}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid UAE IBAN format. Must be AE followed by 21 digits.' });
    }

    const kyc = await prisma.merchantKyc.update({
      where: { tenantId: req.tenantId },
      data: {
        bankAccountHolder,
        bankName,
        iban: ibanClean,
        status: 'UNDER_REVIEW',
        submittedAt: new Date(),
      },
    });

    // Update tenant trade licence info
    await prisma.tenant.update({
      where: { id: req.tenantId },
      data: { tradeLicenceExpiry: kyc.licenceExpiryDate },
    });

    res.json({
      success: true,
      data: kyc,
      message: 'Application submitted! Our team will verify within 24 hours.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Super Admin: Review KYC ──────────────────────────────────────────────────

// GET /api/admin/kyc - list pending applications
const listKycApplications = async (req, res) => {
  try {
    const { status = 'UNDER_REVIEW' } = req.query;
    const kycs = await prisma.merchantKyc.findMany({
      where: status !== 'ALL' ? { status } : {},
      include: { tenant: { select: { name: true, email: true, phone: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    res.json({ success: true, data: kycs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/admin/kyc/:tenantId/review
const reviewKyc = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body; // APPROVED or REJECTED

    const kyc = await prisma.merchantKyc.update({
      where: { tenantId: req.params.tenantId },
      data: { status, reviewNotes, reviewedAt: new Date() },
    });

    // If approved, activate merchant
    if (status === 'APPROVED') {
      await prisma.tenant.update({
        where: { id: req.params.tenantId },
        data: { isActive: true },
      });
      await prisma.subscription.update({
        where: { tenantId: req.params.tenantId },
        data: { status: 'TRIAL' },
      });
    }

    res.json({ success: true, data: kyc });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getKycStatus, submitStep1, submitStep2, submitStep3, listKycApplications, reviewKyc };
