import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { registry } from '../api/registry.js';
import { error, json } from '../api/responses.js';
import { ApiError } from '../errors.js';
import { route } from '../lib/route.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import type { AppDeps } from '../app.js';
import { ProductImageUploadResponseRef } from '../api/schemas.js';

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => imageTypes.has(file.mimetype)
    ? callback(null, true)
    : callback(new ApiError('validation_failed', 'Upload a JPEG, PNG, or WebP image.')),
});
for (const [path, summary] of [['/uploads/products', 'Upload a product photo'], ['/uploads/stall', 'Upload a stall photo']] as const) {
  registry.registerPath({
    method: 'post', path, tags: ['Uploads'], summary,
    security: [{ bearerAuth: [] }],
    request: { body: { required: true, content: {
      'multipart/form-data': { schema: {
        type: 'object', properties: { image: { type: 'string', format: 'binary' } }, required: ['image'],
      } },
    } } },
    responses: {
      201: { description: 'Public image URL.', content: json(ProductImageUploadResponseRef) },
      400: error('Unsupported file type or the image exceeds 5 MB.'), 403: error('Farmer accounts only.'),
    },
  });
}

export function uploadsRouter(deps: AppDeps): Router {
  const r = Router();
  const receiveImage = (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof MulterError) {
        next(new ApiError('validation_failed', err.code === 'LIMIT_FILE_SIZE' ? 'Photos must be 5 MB or smaller.' : 'Upload one image at a time.'));
        return;
      }
      next(err);
    });
  };
  const saveImage = route(async (req, res) => {
    if (!req.file) throw new ApiError('validation_failed', 'Choose a photo to upload.');
    const owner = await deps.pool.query('select 1 from farmers where profile_id=$1', [currentUser(req).id]);
    if (!owner.rowCount) throw new ApiError('not_found', 'Create a farmer stall before uploading photos.');
    if (!deps.productImages) throw new ApiError('internal', 'Image storage is not configured.');
    const bytes = req.file.buffer;
    const validSignature = req.file.mimetype === 'image/jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : req.file.mimetype === 'image/png'
        ? bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!validSignature) throw new ApiError('validation_failed', 'The selected file does not match its image type.');
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype];
    const folder = req.path.endsWith('/stall') ? 'stall' : 'products';
    const url = await deps.productImages.upload(currentUser(req).id, `${folder}/${randomUUID()}.${ext}`, req.file.mimetype, req.file.buffer);
    res.status(201).json({ url });
  });
  for (const path of ['/uploads/products', '/uploads/stall']) {
    r.post(path, requireAuth(deps.auth, deps.pool), requireRole('farmer'), receiveImage, saveImage);
  }
  return r;
}
