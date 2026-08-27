const fs = require('fs');
const sharp = require('sharp');
const { Attachment, Comment, Idea } = require('../../models');
const { getStorageDriver } = require('./storage');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { isPrivileged } = require('../../middlewares/ownership.middleware');

const MAX_IMAGE_DIMENSION = 1920;

// Mirrors comments.service.js's IDEA_ENTITY_TYPES — duplicated locally rather than imported
// across sibling modules for two literal strings. An attachment always keys off the specific
// Comment row it's attached to (entityType='comment'), so freezing it requires walking through
// that comment to find its own entityType/entityId — the actual idea, if there is one.
const IDEA_ENTITY_TYPES = ['idea', 'idea_note'];

// GIF is intentionally excluded — sharp would flatten an animated GIF to its first frame.
const IMAGE_COMPRESSION = {
  'image/png': { format: 'png', options: { compressionLevel: 9, palette: true } },
  'image/jpeg': { format: 'jpeg', options: { quality: 78, mozjpeg: true } },
  'image/webp': { format: 'webp', options: { quality: 78 } },
};

// Downscales + re-encodes screenshots/photos before they hit disk, to keep upload storage small.
// Mutates `file.size` so the stored Attachment row reflects what was actually written.
async function compressImageIfApplicable(file) {
  const spec = IMAGE_COMPRESSION[file.mimetype];
  if (!spec) return;
  try {
    const buffer = await sharp(file.path)
      .rotate()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .toFormat(spec.format, spec.options)
      .toBuffer();
    if (buffer.length < file.size) {
      fs.writeFileSync(file.path, buffer);
      file.size = buffer.length;
    }
  } catch (err) {
    // Compression is an optimization, not a requirement — fall back to the original upload.
    logger.warn('Image compression failed, storing original file', { error: err.message, fileName: file.originalname });
  }
}

async function listForEntity(entityType, entityId) {
  const attachments = await Attachment.findAll({ where: { entityType, entityId }, order: [['createdAt', 'DESC']] });
  // `url` is computed here (not stored) so the frontend never has to know the on-disk path
  // layout — it only ever reads `attachment.url`, same as it does right after an upload.
  return attachments.map((a) => ({ ...a.toJSON(), url: `/uploads/${a.filePath}` }));
}

async function upload({ file, entityType, entityId, uploadedBy }) {
  await compressImageIfApplicable(file);
  const driver = getStorageDriver();
  const { filePath, publicUrl } = await driver.save(file, entityType);
  const attachment = await Attachment.create({
    entityType, entityId, fileName: file.originalname, filePath, fileSize: file.size, mimeType: file.mimetype, uploadedBy,
  });
  return { ...attachment.toJSON(), url: publicUrl };
}

async function remove(id, requester) {
  const attachment = await Attachment.findByPk(id);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  const isOwner = attachment.uploadedBy === requester.id;
  const privileged = isPrivileged(requester);
  if (!isOwner && !privileged) throw ApiError.forbidden('You can only delete your own attachments');

  // Frozen once its idea is decided, same as the comment it hangs off of — an attachment is part
  // of the discussion record too, and evidence that can still be deleted isn't actually frozen.
  if (!privileged && attachment.entityType === 'comment') {
    const comment = await Comment.findByPk(attachment.entityId, { attributes: ['id', 'entityType', 'entityId'] });
    if (comment && IDEA_ENTITY_TYPES.includes(comment.entityType)) {
      const idea = await Idea.findByPk(comment.entityId, { attributes: ['id', 'status'] });
      if (idea && (idea.status === 'approved' || idea.status === 'rejected')) {
        throw ApiError.badRequest('This idea has been decided — the discussion thread is now read-only.');
      }
    }
  }

  await getStorageDriver().remove(attachment.filePath);
  await attachment.destroy();
  return attachment;
}

module.exports = { listForEntity, upload, remove };
