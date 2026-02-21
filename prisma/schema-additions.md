// Add to prisma schema - Notifications & KYC models

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
// Add this to your schema.prisma

/*
enum NotificationType {
  NEW_ORDER
  LOW_STOCK
  NEW_MESSAGE
  PRODUCT_EXPIRING
  SUBSCRIPTION
  SYSTEM
}

model Notification {
  id        String           @id @default(uuid())
  tenantId  String
  type      NotificationType
  title     String
  body      String
  entityId  String?          // orderId, productId, messageId...
  isRead    Boolean          @default(false)
  priority  String           @default("normal") // "normal" | "urgent"
  createdAt DateTime         @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("notifications")
}

// ─── KYC / ONBOARDING ────────────────────────────────────────────────────────

enum KycStatus {
  PENDING
  UNDER_REVIEW
  APPROVED
  REJECTED
}

enum IssuingAuthority {
  DED
  ABU_DHABI_DED
  SHARJAH_SEDD
  DMCC_FREEZONE
  DIFC
  OTHER
}

model MerchantKyc {
  id                  String           @id @default(uuid())
  tenantId            String           @unique
  
  // Step 1 - Business Details
  registeredCompanyName String?
  storeName           String?
  tradeLicenceNumber  String?
  issuingAuthority    IssuingAuthority @default(DED)
  vatTrn              String?
  licenceExpiryDate   DateTime?
  
  // Step 2 - Documents
  tradeLicenceUrl     String?
  emiratesIdUrl       String?
  vatCertificateUrl   String?
  
  // Step 3 - Payouts
  bankAccountHolder   String?
  bankName            String?
  iban                String?
  
  // Status
  status              KycStatus        @default(PENDING)
  reviewNotes         String?
  submittedAt         DateTime?
  reviewedAt          DateTime?
  
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("merchant_kyc")
}

// ─── OTP Verification ────────────────────────────────────────────────────────

model OtpCode {
  id        String   @id @default(uuid())
  phone     String
  code      String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("otp_codes")
}

// ─── Password Reset ───────────────────────────────────────────────────────────

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("password_reset_tokens")
}
*/

// This file documents the additional schema additions needed.
// Copy the model definitions above into your prisma/schema.prisma file.
