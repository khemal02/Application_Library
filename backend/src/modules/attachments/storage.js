const fs = require('fs');
const path = require('path');
const env = require('../../config/env');

const uploadRoot = path.resolve(__dirname, '..', '..', '..', env.upload.dir);

/**
 * Storage driver interface: { save(file) => {filePath, publicUrl}, remove(filePath) }.
 * Only "local" is implemented; swapping to S3 later means adding an `s3.js` driver with the
 * same shape and switching on `env.storageDriver` here — nothing above this module needs to change.
 */
const localDriver = {
  async save(file, entityType) {
    const dir = path.join(uploadRoot, entityType);
    fs.mkdirSync(dir, { recursive: true });
    const destPath = path.join(dir, file.filename);
    fs.renameSync(file.path, destPath);
    return {
      filePath: path.relative(uploadRoot, destPath).replace(/\\/g, '/'),
      publicUrl: `/uploads/${entityType}/${file.filename}`,
    };
  },
  async remove(relativePath) {
    const absPath = path.join(uploadRoot, relativePath);
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  },
};

function getStorageDriver() {
  if (env.storageDriver === 's3') {
    throw new Error('S3 storage driver not configured yet — set STORAGE_DRIVER=local or implement modules/attachments/s3Driver.js');
  }
  return localDriver;
}

module.exports = { getStorageDriver, uploadRoot };
