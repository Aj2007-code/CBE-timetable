// api/pyq-admin.js
//
// Handles admin-only actions for the PYQ tab: verifying the admin key,
// uploading a PDF, and deleting a PDF. Everyone else (students viewing/
// downloading PYQs) never touches this file — those reads go straight from
// the browser to Supabase using the public anon key, which has no write
// access to the pyq table or bucket.
//
// Required Vercel environment variables (Project Settings -> Environment
// Variables on vercel.com):
//   PYQ_ADMIN_KEY              a password only you know/type in the app
//   SUPABASE_SERVICE_ROLE_KEY  from Supabase: Project Settings -> API ->
//                               service_role key. NEVER put this in
//                               script.js or anywhere else client-side —
//                               it bypasses all Row Level Security.
//
// See the SQL at the bottom of this project's setup notes for the table +
// storage bucket this function expects (cbe_pyq_files table, "pyq" bucket).

const SUPABASE_URL = "https://ektzrezmwzhautdmbrwf.supabase.co";
const BUCKET = "pyq";
const MAX_BYTES = 3 * 1024 * 1024; // keep uploads well under the serverless body-size limit

function serviceHeaders(extra) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Object.assign(
    {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    extra || {}
  );
}

function sanitizeFileName(name) {
  return String(name || "file.pdf")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.PYQ_ADMIN_KEY) {
    res.status(500).json({ error: "Server not configured — missing PYQ_ADMIN_KEY or SUPABASE_SERVICE_ROLE_KEY" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  if (body.adminKey !== process.env.PYQ_ADMIN_KEY) {
    res.status(401).json({ error: "Wrong admin key" });
    return;
  }

  try {
    if (body.action === "verify") {
      res.status(200).json({ ok: true });
      return;
    }

    if (body.action === "upload") {
      const { courseCode, fileName, fileBase64 } = body;
      if (!courseCode || !fileName || !fileBase64) {
        res.status(400).json({ error: "Missing courseCode, fileName, or fileBase64" });
        return;
      }

      const buf = Buffer.from(fileBase64, "base64");
      if (buf.length > MAX_BYTES) {
        res.status(413).json({ error: "File too large — keep PDFs under 3MB" });
        return;
      }

      const cleanName = sanitizeFileName(fileName);
      const storagePath = `${courseCode}/${Date.now()}-${cleanName}`;

      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
        method: "POST",
        headers: serviceHeaders({ "Content-Type": "application/pdf" }),
        body: buf,
      });
      if (!uploadRes.ok) {
        const t = await uploadRes.text();
        res.status(502).json({ error: "Storage upload failed: " + t });
        return;
      }

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/cbe_pyq_files`, {
        method: "POST",
        headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify([
          {
            course_code: courseCode,
            file_name: cleanName,
            storage_path: storagePath,
            size_bytes: buf.length,
          },
        ]),
      });
      if (!insertRes.ok) {
        const t = await insertRes.text();
        // Roll back the storage object so we don't leave an orphaned file.
        await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
          method: "DELETE",
          headers: serviceHeaders(),
        }).catch(() => {});
        res.status(502).json({ error: "Database insert failed: " + t });
        return;
      }

      const rows = await insertRes.json();
      res.status(200).json({ ok: true, file: rows[0] });
      return;
    }

    if (body.action === "delete") {
      const { id, storagePath } = body;
      if (!id || !storagePath) {
        res.status(400).json({ error: "Missing id or storagePath" });
        return;
      }

      await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
        method: "DELETE",
        headers: serviceHeaders(),
      });
      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/cbe_pyq_files?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: serviceHeaders(),
      });
      if (!delRes.ok) {
        const t = await delRes.text();
        res.status(502).json({ error: "Database delete failed: " + t });
        return;
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
