import { vi } from 'vitest';

vi.mock('ioredis', () => {
  const mockRedisClient = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(0),
    rpush: vi.fn().mockResolvedValue(0),
    lindex: vi.fn().mockResolvedValue(null),
    quit: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    getMaxListeners: vi.fn().mockReturnValue(10),
    setMaxListeners: vi.fn(),
  };

  const MockRedis = vi.fn().mockImplementation(() => mockRedisClient);
  MockRedis.default = MockRedis;
  return {
    default: MockRedis,
    Redis: MockRedis,
  };
});
