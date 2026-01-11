import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

export interface AppConfig {
  worktreesDir?: string;
}

export interface ConfigLoadResult {
  config: AppConfig;
  source?: string;
  error?: string;
}

const CONFIG_FILENAME = '.gwmrc';

function findConfigPath(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

function parseConfig(raw: string): AppConfig {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid JSON in .gwmrc');
  }

  if (typeof parsed === 'string') {
    if (!parsed.trim()) {
      throw new Error('worktreesDir must be a non-empty string');
    }
    return { worktreesDir: parsed };
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const worktreesDir = (parsed as { worktreesDir?: unknown }).worktreesDir;
    if (worktreesDir === undefined) {
      return {};
    }
    if (typeof worktreesDir !== 'string' || !worktreesDir.trim()) {
      throw new Error('worktreesDir must be a non-empty string');
    }
    return { worktreesDir };
  }

  throw new Error('Unsupported .gwmrc format');
}

function expandHome(value: string): string {
  if (value === '~') {
    return homedir();
  }
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(homedir(), value.slice(2));
  }
  return value;
}

export function resolveWorktreesDir(value: string, baseDir: string): string {
  const trimmed = value.trim();
  const expanded = expandHome(trimmed);
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }
  return path.resolve(baseDir, expanded);
}

export function loadConfig(): ConfigLoadResult {
  const localConfig = findConfigPath(process.cwd());
  let configPath: string | null = localConfig;
  if (!configPath) {
    const globalConfig = path.join(homedir(), CONFIG_FILENAME);
    if (existsSync(globalConfig)) {
      configPath = globalConfig;
    }
  }

  if (!configPath) {
    return { config: {} };
  }

  try {
    const raw = readFileSync(configPath, 'utf8');
    return { config: parseConfig(raw), source: configPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read .gwmrc';
    return { config: {}, source: configPath, error: `${message} (${configPath})` };
  }
}
