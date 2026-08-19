const SUPABASE_URL = "https://ektzrezmwzhautdmbrwf.supabase.co";
const BUCKET = "books";
const MAX_BYTES = 50 * 1024 * 1024; // keep in sync with Supabase's plan-level cap — see notes below
const ADMIN_ROLL = "2501CB23";

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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: "Server not configured — missing SUPABASE_SERVICE_ROLE_KEY" });
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

  if (String(body.roll || "").toUpperCase() !== ADMIN_ROLL) {
    res.status(401).json({ error: "Not authorized for this roll number" });
    return;
  }

  try {
    // Step 1: client asks for a place to upload. We hand back a short-lived
    // signed URL. The actual file bytes never touch this function — the
    // browser PUTs them straight to Supabase Storage. This is what lets us
    // get past Vercel's ~4.5MB serverless request body limit.
    if (body.action === "get-upload-url") {
      const { courseCode, fileName, fileSize } = body;
      if (!courseCode || !fileName) {
        res.status(400).json({ error: "Missing courseCode or fileName" });
        return;
      }

      const size = Number(fileSize) || 0;
      if (size > MAX_BYTES) {
        res.status(413).json({
          error: `File too large — keep files under ${Math.round(MAX_BYTES / (1024 * 1024))}MB (Supabase plan limit).`,
        });
        return;
      }

      const cleanName = sanitizeFileName(fileName);
      const storagePath = `${courseCode}/${Date.now()}-${cleanName}`;

      const signRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${storagePath}`,
        {
          method: "POST",
          headers: serviceHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        }
      );

      if (!signRes.ok) {
        const t = await signRes.text();
        res.status(502).json({ error: "Could not create upload URL: " + t });
        return;
      }

      const signData = await signRes.json();
      // signData.url looks like "/object/upload/sign/books/<path>?token=..."
      const uploadUrl = `${SUPABASE_URL}/storage/v1${signData.url}`;

      res.status(200).json({ ok: true, uploadUrl, storagePath, cleanName });
      return;
    }

    // Step 2: client has already PUT the file bytes directly to `uploadUrl`
    // above. Now we just record the metadata — this payload is tiny (no
    // base64 file data), so it's well within Vercel's body limit.
    if (body.action === "confirm") {
      const { courseCode, fileName, storagePath, sizeBytes, title, author } = body;
      if (!courseCode || !fileName || !storagePath) {
        res.status(400).json({ error: "Missing courseCode, fileName, or storagePath" });
        return;
      }

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/cbe_reference_books`, {
        method: "POST",
        headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify([
          {
            course_code: courseCode,
            file_name: fileName,
            storage_path: storagePath,
            size_bytes: Number(sizeBytes) || null,
            title: title || null,
            author: author || null,
          },
        ]),
      });

      if (!insertRes.ok) {
        const t = await insertRes.text();
        // Clean up the orphaned storage object since the DB row failed.
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
      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/cbe_reference_books?id=eq.${encodeURIComponent(id)}`, {
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