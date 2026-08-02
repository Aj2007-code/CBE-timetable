const SUPABASE_URL = "https://ektzrezmwzhautdmbrwf.supabase.co";
const BUCKET = "pyq";
const MAX_BYTES = 3 * 1024 * 1024; 
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
