const SUPABASE_URL = "https://ektzrezmwzhautdmbrwf.supabase.co";
const BUCKET = "books";
const MAX_BYTES = 50 * 1024 * 1024; 
const { requireAdmin, ADMIN_ROLL } = require("./_adminAuth");

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

  if (!requireAdmin(req)) {
    res.status(401).json({ error: "Admin session required — please log in again" });
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
      const uploadUrl = `${SUPABASE_URL}/storage/v1${signData.url}`;

      res.status(200).json({ ok: true, uploadUrl, storagePath, cleanName });
      return;
    }
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