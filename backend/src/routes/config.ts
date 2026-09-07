import { Router, Request, Response } from 'express';
import { FILE_SIZE_LIMITS, MAX_UPLOAD_BYTES } from '../utils/fileUtils';
import { isSmtpConfigured } from '../services/email';
import { getSystemSettings } from '../services/systemSettings';
import logger from '../utils/logger';

const router = Router();

/**
 * Public client configuration
 *
 * The SPA is built at image-build time, so anything baked into the bundle needs
 * a rebuild to change. Upload limits are served here instead, letting the
 * MAX_<TYPE>_SIZE_MB environment variables take effect with a restart.
 */

/**
 * GET /api/config
 * Returns the upload limits the server enforces, whether this instance can
 * send email, and the instance-wide default distance unit (ft/m).
 * Public endpoint — no authentication required, no sensitive values.
 *
 * The SMTP entry is a bare boolean on purpose: host, port, user and TLS mode
 * stay on the admin-only /api/admin/config. A campaign DM is not necessarily a
 * platform admin, so without this they could not tell whether the "also email
 * them" option on an invitation would do anything at all.
 *
 * distanceUnit is read here (rather than added to /api/auth/appearance) so any
 * authenticated screen — not just branding — can pick it up via the same
 * long-lived react-query cache already used for upload limits.
 */
router.get('/', async (_req: Request, res: Response) => {
  let distanceUnit: 'ft' | 'm' = 'ft';
  try {
    const settings = await getSystemSettings();
    if (settings.distanceUnit === 'm') distanceUnit = 'm';
  } catch (error) {
    logger.error('Error reading system settings for /api/config', { err: error });
  }

  res.json({
    uploadLimits: { ...FILE_SIZE_LIMITS },
    maxUploadBytes: MAX_UPLOAD_BYTES,
    smtp: { configured: isSmtpConfigured() },
    distanceUnit,
  });
});

export default router;
