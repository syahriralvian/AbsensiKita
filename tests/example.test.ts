import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should run basic math correctly', () => {
    expect(1 + 1).toBe(2);
  });
  
  it('should test an async operation', async () => {
    const result = await Promise.resolve(true);
    expect(result).toBe(true);
  });
});
