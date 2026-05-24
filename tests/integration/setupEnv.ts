process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://ai_interviewer:ai_interviewer_dev@localhost:5432/ai_interviewer';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_that_is_at_least_32_characters_long';
process.env.DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || 'mock_deepgram_key';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'mock_openrouter_key';
process.env.PORT = process.env.PORT || '5001';

// Globally Mock ioredis to prevent hanging TCP connections in testing
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === 'ioredis') {
    const mockClient = {
      get: async () => null,
      set: async () => 'OK',
      del: async () => 1,
      incr: async () => 1,
      llen: async () => 0,
      rpush: async () => 0,
      lindex: async () => null,
      quit: async () => {},
      disconnect: () => {},
      on: () => {},
      once: () => {},
      getMaxListeners: () => 10,
      setMaxListeners: () => {},
    };
    const MockRedis = function () {
      return mockClient;
    };
    MockRedis.default = MockRedis;
    // Support static property or methods if any
    return MockRedis;
  }
  return originalRequire.apply(this, arguments);
};

