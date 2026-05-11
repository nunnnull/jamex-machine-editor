import { getJobMeta } from '../storage/tempStore.js';

export async function handleStatus(req, res, next) {
  try {
    const { jobId } = req.params;

    if (!jobId || typeof jobId !== 'string' || jobId.length < 1) {
      return res.status(400).json({ error: 'Invalid job ID.', code: 400 });
    }

    const meta = await getJobMeta(jobId);

    if (!meta) {
      return res.status(404).json({ error: 'Job not found.', code: 404 });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}/processed/${jobId}`;
    const images = meta.images || {};
    const imageList = Object.values(images).map(img => {
      const processedPath = `${baseUrl}/${img.id}.png`;
      const rawStatus = img.status || 'unknown';
      const statusMap = {
        queued: 'pending',
        processing: 'processing',
        completed: 'done',
        failed: 'failed',
      };
      return {
        id: img.id,
        filename: img.originalname || img.filename,
        status: statusMap[rawStatus] || rawStatus,
        progress: rawStatus === 'completed' ? 100 : rawStatus === 'processing' ? 50 : 0,
        original_url: null,
        preview_url: img.status === 'completed' ? processedPath : null,
        error: img.error || null,
      };
    });

    return res.status(200).json({
      jobId: meta.jobId || jobId,
      items: imageList,
      total: meta.total || 0,
      completed: meta.completed || 0,
      failed: meta.failed || 0,
    });
  } catch (err) {
    next(err);
  }
}
