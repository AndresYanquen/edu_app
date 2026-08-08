const r2Storage = require('./r2Storage');

const PROVIDERS = {
  r2: r2Storage,
};

const getStorageProvider = (provider = process.env.STORAGE_PROVIDER || 'local') => {
  const storage = PROVIDERS[provider];
  if (!storage) {
    throw new Error(`Storage provider "${provider}" is not configured`);
  }
  return storage;
};

module.exports = {
  getStorageProvider,
};
