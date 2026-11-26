/**
 * Local draft storage for the posting experience (Prompt.md §12).
 *
 * Drafts are genuinely persisted on the device, so a partially completed
 * form survives a relaunch. Server-side publishing lands with each
 * marketplace stage; until then "save" honestly means saved on this device,
 * and the UI says so rather than implying a listing is live.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'desi-jugaad:drafts:v1';

export type DraftValues = Record<string, string | boolean>;

export interface Draft {
  id: string;
  type: string;
  title: string;
  values: DraftValues;
  createdAt: string;
  updatedAt: string;
}

function parseAll(raw: string | null): Draft[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is Draft =>
        !!d &&
        typeof d === 'object' &&
        typeof (d as Draft).id === 'string' &&
        typeof (d as Draft).type === 'string' &&
        typeof (d as Draft).values === 'object' &&
        (d as Draft).values !== null,
    );
  } catch {
    return [];
  }
}

async function readAll(): Promise<Draft[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return parseAll(raw);
  } catch {
    return [];
  }
}

async function writeAll(drafts: Draft[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function newId(): string {
  // Prefer the platform's UUID source when available.
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const draftsRepo = {
  async list(): Promise<Draft[]> {
    const drafts = await readAll();
    return drafts.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  async get(id: string): Promise<Draft | null> {
    const drafts = await readAll();
    return drafts.find((d) => d.id === id) ?? null;
  },

  async count(): Promise<number> {
    return (await readAll()).length;
  },

  async save(input: { id?: string; type: string; title: string; values: DraftValues }): Promise<Draft> {
    const drafts = await readAll();
    const now = new Date().toISOString();
    const existing = input.id ? drafts.find((d) => d.id === input.id) : undefined;

    const draft: Draft = {
      id: existing?.id ?? newId(),
      type: input.type,
      title: input.title.trim() || 'Untitled draft',
      values: input.values,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const next = existing
      ? drafts.map((d) => (d.id === draft.id ? draft : d))
      : [draft, ...drafts];

    await writeAll(next);
    return draft;
  },

  async remove(id: string): Promise<void> {
    const drafts = await readAll();
    await writeAll(drafts.filter((d) => d.id !== id));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};

/** Renders a draft's title from its configured title field. */
export function draftTitle(typeTitleField: string, values: DraftValues): string {
  const raw = values[typeTitleField];
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 80);
  const firstText = Object.values(values).find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  return (firstText ?? 'Untitled draft').slice(0, 80);
}

export function formatDraftDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
