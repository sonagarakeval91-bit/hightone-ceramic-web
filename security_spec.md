# Security Specification — Hightone Ceramic Firestore

## 1. Data Invariants
1. **Default Deny**: All unmatched paths deny read and write (`match /{document=**} { allow read, write: if false; }`).
2. **Dealer Application Integrity**: Any public submission to `/dealer_applications/{appId}` MUST initialize with `status == 'pending'`, all three KYC verification booleans (`addressVerified`, `gstVerified`, `callVerified`) strictly `false`, strict field whitelist (`hasAll` + `hasOnly`), string length bounds, and server timestamp `createdAtTs == request.time`. Public visitors cannot read, list, update, or delete any application.
3. **B2B Inquiry Integrity**: Public submissions to `/b2b_inquiries/{inquiryId}` MUST initialize with `status == 'new'`, `createdAtTs == request.time`, strict keys, and bounded strings. Only verified Admins can read, list, update, or delete inquiries.
4. **PII Isolation on Dealer Accounts**: `/dealer_accounts/{accountId}` contains credentials and PII and is strictly Admin-only for all operations. Multi-device dealer portal login uses `/dealer_auth_tokens/{credHash}` where `credHash` is a 64-character lowercase hex SHA-256 digest of `userId::password`; `list` is Admin-only and `get` requires knowing the exact 256-bit `credHash`.
5. **Dealer Order Integrity**: Creating an order in `/dealer_orders/{orderId}` requires either `isAdmin()` or a valid, `active == true` `/dealer_auth_tokens/{credHash}` matching `dealerAccountId`, with initial state locked to `status == 'new'` and `verificationStatus == 'pending'`. Updating an order by a dealer cannot touch completed orders, cannot mutate `dealerAccountId` or `dealerCredHash`, and resets verification back to `pending`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Self-Approved Application**: `create` on `/dealer_applications/HDA-1` with `status: "approved"`.
2. **Pre-Verified KYC Bypass**: `create` on `/dealer_applications/HDA-2` with `verification.addressVerified: true`.
3. **Timestamp Spoofing**: `create` on `/dealer_applications/HDA-3` with `createdAtTs: "2020-01-01T00:00:00Z"` instead of `request.time`.
4. **Shadow Ghost Field**: `create` on `/dealer_applications/HDA-4` with extra field `isAdmin: true`.
5. **Unauthenticated PII Read**: `list` on `/dealer_applications` or `/dealer_accounts` without Admin auth.
6. **ID Poisoning**: `create` on `/dealer_applications/` with a 200-char or `$` character ID.
7. **Unverified Admin Email Spoof**: Request with `email == "sonagarakeval91@gmail.com"` and `email_verified == false`.
8. **Token Enumeration**: `list` on `/dealer_auth_tokens` without Admin auth.
9. **Malformed Token Lookup**: `get` on `/dealer_auth_tokens/short_key` (fails 64-char hex regex).
10. **Forged Dealer Order**: `create` on `/dealer_orders/HTC-1` with non-existent or `active: false` `dealerCredHash`.
11. **Completed Order Tampering**: `update` on a completed `/dealer_orders/HTC-2` as a non-admin dealer.
12. **Status Escalation on Inquiry**: `create` on `/b2b_inquiries/HTC-3` with `status: "quoted"`.
