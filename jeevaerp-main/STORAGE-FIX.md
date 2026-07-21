# Prescription storage — bug fix + a privacy hole I found

## 1. Your 500 (`Invalid cloud_name jeeva`)

`.env` has `CLOUDINARY_CLOUD_NAME=jeeva`, which is a placeholder, not a real
Cloudinary account. The old guard only checked the vars were **present**:

```ts
return Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);
```

`"jeeva"` is truthy, so it took the Cloudinary branch and 401'd. Presence != validity.

**Fixed two ways:**
- placeholder values (`jeeva`, `changeme`, `your-cloud-name`, ...) are now rejected -> falls back to local disk
- if Cloudinary is real but *fails*, it logs and **falls back to local disk instead of 500ing**.
  A CDN being down must never lose a prescription.

**You can now just delete the three CLOUDINARY_* lines from `.env`.** Uploads work with zero setup.

---

## 2. The thing I found while fixing it — please read

Uploads were being written to `public/uploads/prescriptions/`.

Next serves **everything in `/public` statically, with no auth**. And your middleware
matcher is:

```
matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"]
```

`.*\..*` excludes any path containing a dot — so a `.pdf` **never even reaches the
middleware**. It was served straight off disk.

**Every prescription scan was publicly downloadable by anyone with the URL. No login.**
Patient name, doctor, medicines. You wrote DPDP Act 2023 compliance into the SDA for
this client — this would have breached it on day one.

### What I changed

- Scans now go to **`storage/prescriptions/`** — outside the web root, not served by Next.
- New authenticated route: **`GET /api/v1/files/prescriptions/[key]`**
  - clinical staff (reception / pharmacy / doctor / admin) -> any scan
  - a patient -> **only their own** (ownership check against `patientId`)
  - lab techs -> no access (they have no reason to read prescriptions)
  - path-traversal guarded, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`
- `/storage/` and `/public/uploads/` added to `.gitignore` — **patient records must never hit git**.

**The UI didn't need a single change.** Everything already renders `fileUrl`; that value
is now the authenticated route instead of a static path, and the browser sends the
session cookie automatically.

### Do this on your machine

```bash
rm -rf public/uploads          # I removed it here; remove it in your repo too
```

Any prescriptions you uploaded during testing point at the old `/uploads/...` path and
will 404. Just re-upload them — it's dev data.

---

## 3. My recommendation: don't use Cloudinary for this at all

Even correctly configured, Cloudinary's `secure_url` is **public by default**. Anyone
with the link gets the file. To make it safe you'd need `type=authenticated` plus signed
delivery URLs — real work, and you'd still be shipping Indian patients' health records
to a US provider, which is exactly the cross-border transfer question DPDP makes you
answer.

Cloudinary is a media CDN built for public marketing assets. Patient prescriptions are
the opposite of that.

**Keep the scans on the hospital's own server** (local disk + the authenticated route
that's now in place). It is simpler, cheaper, and more defensible. If the client later
wants off-box durability, use an India-region S3-compatible bucket with a **private ACL**
and signed URLs, or MinIO on their own hardware — not a public media CDN.

The Cloudinary code path is still there if you disagree; it just isn't the default, and
it now carries a comment saying exactly what you'd have to fix first.

---

## Still open (unchanged from last pass)

- Bed transfers (General -> ICU mid-stay)
- Doctor portal inpatient list
- Interim IPD billing on long stays
- Replace placeholder GSTIN `36AACCA1234F1Z5` before production
