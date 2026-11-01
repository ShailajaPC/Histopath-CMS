const { withRole } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');
const { getEmbedding, toVector } = require('../../lib/embed');

const fail = (status, message) => Object.assign(new Error(message), { status });
function sendError(res, e) {
  const status = e.status || (e.code === 'P0001' ? 409 : e.code === '42501' ? 403 : 500);
  res.status(status).json({ error: e.message });
}

// PUT    /api/report_manage  { id, diagnosis, icd_code, category, microscopic_findings, gross_desc }
//        -> updates an UNSIGNED report and re-generates its embedding (vector UPDATE)
// DELETE /api/report_manage?id=...
//        -> deletes an UNSIGNED report together with its vector (vector DELETE)
async function handler(req, res) {
  const id = req.query.id || (req.body && req.body.id);
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    if (req.method === 'PUT') {
      const { diagnosis, icd_code, category, microscopic_findings, gross_desc } = req.body;
      if (!diagnosis || !microscopic_findings)
        return res.status(400).json({ error: 'Diagnosis and microscopic findings are required' });
      // Embed first: if the service is down we refuse, rather than leave a stale vector behind
      const vec = toVector(await getEmbedding(`${microscopic_findings} Diagnosis: ${diagnosis}`));
      await withRole(req.user.role, async (c) => {
        const cur = await c.query(
          'SELECT is_signed, pathologist_id, synoptic_data FROM Reports WHERE report_id=$1 FOR UPDATE', [id]);
        if (!cur.rows.length) throw fail(404, 'Report not found');
        if (cur.rows[0].is_signed) throw fail(409, 'Signed reports cannot be edited. Use an addendum.');
        if (String(cur.rows[0].pathologist_id) !== String(req.user.user_id))
          throw fail(403, 'Only the pathologist who wrote this draft can edit it');
        const synoptic = { ...(cur.rows[0].synoptic_data || {}), gross_description: gross_desc || '' };
        await c.query(
          `UPDATE Reports SET diagnosis=$2, icd_code=$3, category=$4, microscopic_findings=$5,
                  synoptic_data=$6::jsonb, embedding=$7::vector
           WHERE report_id=$1`,
          [id, diagnosis, icd_code || '', category, microscopic_findings, JSON.stringify(synoptic), vec]);
      });
      return res.status(200).json({ success: true, embedding_updated: true });
    }

    if (req.method === 'DELETE') {
      await withRole(req.user.role, async (c) => {
        const cur = await c.query(
          'SELECT is_signed, pathologist_id, case_id FROM Reports WHERE report_id=$1 FOR UPDATE', [id]);
        if (!cur.rows.length) throw fail(404, 'Report not found');
        if (cur.rows[0].is_signed) throw fail(409, 'Signed reports cannot be deleted.');
        if (String(cur.rows[0].pathologist_id) !== String(req.user.user_id))
          throw fail(403, 'Only the pathologist who wrote this draft can delete it');
        await c.query('DELETE FROM IHC_Results WHERE report_id=$1', [id]);
        await c.query('DELETE FROM Morphological_Features WHERE report_id=$1', [id]);
        await c.query('DELETE FROM Reports WHERE report_id=$1', [id]);   // vector goes with the row
        await c.query(
          "INSERT INTO Case_Audit_Logs (case_id,action,old_status,new_status,performed_by) VALUES ($1,'REPORT_DELETED','REPORTED','DELETED',$2)",
          [cur.rows[0].case_id, req.user.user_id]);
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).end();
  } catch (e) {
    sendError(res, e);
  }
}

export default withAuth(handler, ['PATHOLOGIST']);
