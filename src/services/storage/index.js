const r2Storage = require('./r2Storage');
const env = require('../../config/env');

const PROVIDERS = {
  r2: r2Storage,
};

const getStorageProvider = (provider = env.STORAGE_PROVIDER) => {
  const storage = PROVIDERS[provider];
  if (!storage) {
    throw new Error(`Storage provider "${provider}" is not configured`);
  }
  return storage;
};

module.exports = {
  getStorageProvider,
};
