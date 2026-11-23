# Enquiry Tracking Without Customer Login

**Project:** Sagar Traders  
**Scope:** Production-Grade Customer Self-Service  
**Route:** `/track-enquiry`

---

## 1. Overview and Security Model

To eliminate customer friction while preserving data privacy, Sagar Traders provides an unauthenticated tracking mechanism that requires zero customer account registration or login.

Instead, customers track their enquiries using a secure, high-entropy cryptographic token provided upon enquiry submission:

- **Format:** `tr_<hex-string>` (32 bytes of cryptographically secure random entropy generated via `node:crypto.randomBytes(32)`).
- **Storage:** Only the SHA-256 hash (`tracking_token_hash`) is stored in the database. Raw tokens are never stored, preventing token leakage in case of database read breaches.
- **Expiration:** Tokens are valid for 90 days from issuance.
- **Revocation / Rotation:** Administrators can rotate or revoke tokens at any time through the Admin Enquiry Detail console.
- **Rate Limiting:** Public lookup requests are rate-limited via sliding window IP and token checks. Invalid lookups return generic error messages to prevent reference enumeration.

---

## 2. Tracking URL Structure

Upon enquiry submission (bulk enquiry, contact form, or request callback), the customer is presented with:

1. The human-readable Enquiry Reference (e.g. `ENQ-2026-A1B2C3`).
2. A direct tracking link:
   ```
   https://sagartraders.in/track-enquiry?ref=ENQ-2026-A1B2C3&token=tr_...
   ```
3. A "Copy Tracking Link" button with live feedback.
4. WhatsApp confirmation message containing the tracking URL.

---

## 3. Status Timeline Progression

The tracking timeline displays a 5-step visual progression:

1. **Received (`NEW`)**: Enquiry recorded in the system.
2. **Under Review (`CONTACTED`)**: A Sagar Traders sales representative has picked up the requirement and verified material availability.
3. **Quotation Sent (`QUOTATION_SENT`)**: A formal quotation with unit rates, tax, discounts, and validity has been issued. An active button direct-links to `/quotation/[token]` to view and download the quotation.
4. **Confirmed (`CONFIRMED`)**: Customer accepted quotation; order entered dispatch queue.
5. **Completed (`COMPLETED`)**: Materials fulfilled and delivered to construction site.

If an enquiry is cancelled, a clear `CANCELLED` notice is presented with contact options to re-engage.

---

## 4. Administrative Control

From `/admin/enquiries/[id]`:

- **Rotate Tracking Token:** Generates a new 32-byte token, updates the hash in `enquiries`, invalidates the old token, and displays the new customer tracking link for the administrator to share via phone or WhatsApp.
- **Revoke Tracking Token:** Sets `tracking_token_revoked_at = now()`, immediately disabling public lookup.
- **Update Status:** Updates enquiry status, appending an immutable record to `enquiry_status_history` with the admin's user ID, timestamp, and optional remarks.
