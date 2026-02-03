import { describe, it, expect } from 'vitest';
import { parseEnv, serializeEnv } from '../env.js';

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

    const result = serializeEnv(original, updates);

    expect(result).toContain('DATABASE_URL=postgres://localhost/dev');
    expect(result).toContain('API_KEY=secret123');
    expect(result).toContain('# Database config');
    expect(result).toContain('COMPOSE_PROJECT_NAME=my-worktree');
    expect(result).toContain('# Added by gwm for docker-compose isolation');
  });

  it('should update existing keys instead of duplicating', () => {
    const original = `DATABASE_URL=postgres://localhost/dev
COMPOSE_PROJECT_NAME=old-name`;

    const updates = new Map<string, string>();
    updates.set('COMPOSE_PROJECT_NAME', 'new-name');

    const result = serializeEnv(original, updates);

    expect(result).toContain('COMPOSE_PROJECT_NAME=new-name');
    // Should not have old value
    expect(result).not.toContain('COMPOSE_PROJECT_NAME=old-name');
    // Should not have duplicate keys
    expect(result.match(/COMPOSE_PROJECT_NAME/g)?.length).toBe(1);
  });

  it('should handle empty original content', () => {
    const updates = new Map<string, string>();
    updates.set('COMPOSE_PROJECT_NAME', 'my-worktree');

    const result = serializeEnv('', updates);

    expect(result).toContain('# Added by gwm for docker-compose isolation');
    expect(result).toContain('COMPOSE_PROJECT_NAME=my-worktree');
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
    updates.set('NEW_VAR', 'new-value');

    const result = serializeEnv(original, updates);

    expect(result).toContain('COMPOSE_PROJECT_NAME=new-name');
    expect(result).toContain('OTHER_VAR=keep-me');
    expect(result).toContain('NEW_VAR=new-value');
    // COMPOSE_PROJECT_NAME updated in place, NEW_VAR added at end
    expect(result.match(/COMPOSE_PROJECT_NAME/g)?.length).toBe(1);
  });
});
