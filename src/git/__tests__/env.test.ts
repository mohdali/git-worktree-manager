import { describe, it, expect } from 'vitest';
import { parseEnv, serializeEnv, computePortOffset } from '../env.js';

describe('parseEnv', () => {
  it('should parse simple key-value pairs', () => {
    const content = `DATABASE_URL=postgres://localhost/dev
API_KEY=secret123`;

    const result = parseEnv(content);

    expect(result.get('DATABASE_URL')).toBe('postgres://localhost/dev');
    expect(result.get('API_KEY')).toBe('secret123');
    expect(result.size).toBe(2);
  });

  it('should skip comments and empty lines', () => {
    const content = `# This is a comment
DATABASE_URL=postgres://localhost/dev

# Another comment
API_KEY=secret123
`;

    const result = parseEnv(content);

    expect(result.size).toBe(2);
    expect(result.get('DATABASE_URL')).toBe('postgres://localhost/dev');
  });

  it('should handle quoted values', () => {
    const content = `SINGLE_QUOTED='hello world'
DOUBLE_QUOTED="hello world"
UNQUOTED=hello world`;

    const result = parseEnv(content);

    expect(result.get('SINGLE_QUOTED')).toBe('hello world');
    expect(result.get('DOUBLE_QUOTED')).toBe('hello world');
    expect(result.get('UNQUOTED')).toBe('hello world');
  });

  it('should handle values with equals signs', () => {
    const content = `CONNECTION_STRING=host=localhost;port=5432`;

    const result = parseEnv(content);

    expect(result.get('CONNECTION_STRING')).toBe('host=localhost;port=5432');
  });

  it('should handle empty content', () => {
    const result = parseEnv('');
    expect(result.size).toBe(0);
  });

  it('should handle content with only comments', () => {
    const content = `# Comment 1
# Comment 2`;

    const result = parseEnv(content);
    expect(result.size).toBe(0);
  });

  it('should trim whitespace around keys and values', () => {
    const content = `  KEY_WITH_SPACES  =  value with spaces  `;

    const result = parseEnv(content);

    expect(result.get('KEY_WITH_SPACES')).toBe('value with spaces');
  });
});

describe('serializeEnv', () => {
  it('should preserve existing content and add new variables', () => {
    const original = `# Database config
DATABASE_URL=postgres://localhost/dev

API_KEY=secret123`;

    const updates = new Map<string, string>();
    updates.set('COMPOSE_PROJECT_NAME', 'my-worktree');
    updates.set('PORT_OFFSET', '427');

    const result = serializeEnv(original, updates);

    expect(result).toContain('DATABASE_URL=postgres://localhost/dev');
    expect(result).toContain('API_KEY=secret123');
    expect(result).toContain('# Database config');
    expect(result).toContain('COMPOSE_PROJECT_NAME=my-worktree');
    expect(result).toContain('PORT_OFFSET=42');
    expect(result).toContain('# Added by gwm for docker-compose isolation');
  });

  it('should update existing keys instead of duplicating', () => {
    const original = `DATABASE_URL=postgres://localhost/dev
COMPOSE_PROJECT_NAME=old-name
PORT_OFFSET=100`;

    const updates = new Map<string, string>();
    updates.set('COMPOSE_PROJECT_NAME', 'new-name');
    updates.set('PORT_OFFSET', '500');

    const result = serializeEnv(original, updates);

    expect(result).toContain('COMPOSE_PROJECT_NAME=new-name');
    expect(result).toContain('PORT_OFFSET=500');
    // Should not have old values
    expect(result).not.toContain('COMPOSE_PROJECT_NAME=old-name');
    expect(result).not.toContain('PORT_OFFSET=100');
    // Should not have duplicate keys
    expect(result.match(/COMPOSE_PROJECT_NAME/g)?.length).toBe(1);
    expect(result.match(/PORT_OFFSET/g)?.length).toBe(1);
  });

  it('should handle empty original content', () => {
    const updates = new Map<string, string>();
    updates.set('COMPOSE_PROJECT_NAME', 'my-worktree');
    updates.set('PORT_OFFSET', '427');

    const result = serializeEnv('', updates);

    expect(result).toContain('# Added by gwm for docker-compose isolation');
    expect(result).toContain('COMPOSE_PROJECT_NAME=my-worktree');
    expect(result).toContain('PORT_OFFSET=42');
  });

  it('should preserve comments in original content', () => {
    const original = `# This is important
KEY1=value1
# Another comment
KEY2=value2`;

    const updates = new Map<string, string>();
    updates.set('NEW_KEY', 'new_value');

    const result = serializeEnv(original, updates);

    expect(result).toContain('# This is important');
    expect(result).toContain('# Another comment');
  });

  it('should handle partial updates (only some keys exist)', () => {
    const original = `COMPOSE_PROJECT_NAME=old-name
OTHER_VAR=keep-me`;

    const updates = new Map<string, string>();
    updates.set('COMPOSE_PROJECT_NAME', 'new-name');
    updates.set('PORT_OFFSET', '999');

    const result = serializeEnv(original, updates);

    expect(result).toContain('COMPOSE_PROJECT_NAME=new-name');
    expect(result).toContain('OTHER_VAR=keep-me');
    expect(result).toContain('PORT_OFFSET=99');
    // COMPOSE_PROJECT_NAME updated in place, PORT_OFFSET added at end
    expect(result.match(/COMPOSE_PROJECT_NAME/g)?.length).toBe(1);
  });
});

describe('computePortOffset', () => {
  it('should return a number in the valid range (0-99)', () => {
    const testNames = [
      'feature-auth_a1b2c3d4',
      'bugfix-login_deadbeef',
      'main',
      'develop',
      'a',
      'very-long-worktree-name-with-many-characters_12345678'
    ];

    for (const name of testNames) {
      const offset = computePortOffset(name);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(100);
      expect(Number.isInteger(offset)).toBe(true);
    }
  });

  it('should be deterministic (same input = same output)', () => {
    const name = 'feature-auth_a1b2c3d4';

    const offset1 = computePortOffset(name);
    const offset2 = computePortOffset(name);
    const offset3 = computePortOffset(name);

    expect(offset1).toBe(offset2);
    expect(offset2).toBe(offset3);
  });

  it('should produce different offsets for different names', () => {
    const names = [
      'feature-auth_a1b2c3d4',
      'feature-auth_x9y8z7w6',
      'bugfix-login_deadbeef',
      'hotfix-crash_cafebabe'
    ];

    const offsets = names.map(computePortOffset);
    const uniqueOffsets = new Set(offsets);

    // With good hash distribution, different names should produce different offsets
    // (statistically very unlikely to have collisions with just 4 inputs)
    expect(uniqueOffsets.size).toBe(names.length);
  });

  it('should handle empty string', () => {
    const offset = computePortOffset('');
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(100);
  });

  it('should handle special characters', () => {
    const offset = computePortOffset('feature_auth-system_123');
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(100);
  });
});
