import { create } from "zustand";
import { useUIStore } from "./uiStore";

/** Matches the .thread-exit transition in globals.css */
export const THREAD_EXIT_MS = 200;

export interface Thread {
  id: string;
  accountId: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: number;
  messageCount: number;
  isRead: boolean;
  isStarred: boolean;
  isPinned: boolean;
  isMuted: boolean;
  hasAttachments: boolean;
  labelIds: string[];
  fromName: string | null;
  fromAddress: string | null;
}

interface ThreadState {
  threads: Thread[];
  threadMap: Map<string, Thread>;
  selectedThreadId: string | null;
  selectedThreadIds: Set<string>;
  isLoading: boolean;
  searchQuery: string;
  searchThreadIds: Set<string> | null; // null = no active search
  setThreads: (threads: Thread[]) => void;
  selectThread: (id: string | null) => void;
  toggleThreadSelection: (id: string) => void;
  selectThreadRange: (id: string) => void;
  clearMultiSelect: () => void;
  selectAll: () => void;
  selectAllFromHere: () => void;
  setLoading: (loading: boolean) => void;
  updateThread: (id: string, updates: Partial<Thread>) => void;
  removeThread: (id: string) => void;
  removeThreads: (ids: string[]) => void;
  /** Threads currently playing their exit animation */
  removingThreadIds: Set<string>;
  /**
   * Threads that can be opened without being in the list — following a link
   * from the contact sidebar, say. Kept apart from `threadMap` so reloading
   * the list neither drops them nor disturbs what the user is browsing.
   */
  cachedThreads: Map<string, Thread>;
  cacheThread: (thread: Thread) => void;
  /**
   * Fade a thread out, then drop it. The row is removed from the model only
   * after the animation, so an archive or move reads as the row leaving rather
   * than the list snapping shut.
   */
  beginThreadRemoval: (ids: string | string[]) => void;
  setSearch: (query: string, threadIds: Set<string> | null) => void;
  clearSearch: () => void;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  threads: [],
  threadMap: new Map(),
  selectedThreadId: null,
  selectedThreadIds: new Set(),
  isLoading: false,
  searchQuery: "",
  searchThreadIds: null,
  removingThreadIds: new Set<string>(),
  cachedThreads: new Map<string, Thread>(),

  setThreads: (threads) =>
    set({
      threads,
      threadMap: new Map(threads.map((t) => [t.id, t])),
      // A reload replaces the list wholesale — nothing is mid-exit any more.
      // cachedThreads deliberately survives: a thread opened from the contact
      // sidebar is not part of the list and must keep rendering.
      removingThreadIds: new Set<string>(),
    }),
  selectThread: (selectedThreadId) => set({ selectedThreadId, selectedThreadIds: new Set() }),
  toggleThreadSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedThreadIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedThreadIds: next };
    }),
  selectThreadRange: (id) => {
    const state = get();
    const threads = state.threads;
    // Find the anchor: last selected thread or the currently viewed thread
    const anchor = state.selectedThreadId ?? [...state.selectedThreadIds].pop();
    if (!anchor) {
      set({ selectedThreadIds: new Set([id]) });
      return;
    }
    const anchorIdx = threads.findIndex((t) => t.id === anchor);
    const targetIdx = threads.findIndex((t) => t.id === id);
    if (anchorIdx === -1 || targetIdx === -1) return;
    const start = Math.min(anchorIdx, targetIdx);
    const end = Math.max(anchorIdx, targetIdx);
    const rangeIds = threads.slice(start, end + 1).map((t) => t.id);
    set((s) => ({
      selectedThreadIds: new Set([...s.selectedThreadIds, ...rangeIds]),
    }));
  },
  clearMultiSelect: () => set({ selectedThreadIds: new Set() }),
  selectAll: () => {
    const threads = get().threads;
    set({ selectedThreadIds: new Set(threads.map((t) => t.id)) });
  },
  selectAllFromHere: () => {
    const { threads, selectedThreadId } = get();
    const idx = threads.findIndex((t) => t.id === selectedThreadId);
    const startIdx = idx === -1 ? 0 : idx;
    const ids = threads.slice(startIdx).map((t) => t.id);
    set((s) => ({
      selectedThreadIds: new Set([...s.selectedThreadIds, ...ids]),
    }));
  },
  setLoading: (isLoading) => set({ isLoading }),
  updateThread: (id, updates) =>
    set((state) => {
      const threads = state.threads.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      );
      const threadMap = new Map(state.threadMap);
      const existing = threadMap.get(id);
      if (existing) threadMap.set(id, { ...existing, ...updates });
      return { threads, threadMap };
    }),
  cacheThread: (thread) =>
    set((state) => {
      const cachedThreads = new Map(state.cachedThreads);
      cachedThreads.set(thread.id, thread);
      return { cachedThreads };
    }),
  beginThreadRemoval: (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return;

    set((state) => {
      const removing = new Set(state.removingThreadIds);
      for (const id of list) removing.add(id);
      return { removingThreadIds: removing };
    });

    // Reduced motion means no animation to wait for
    const delay = useUIStore.getState().reduceMotion ? 0 : THREAD_EXIT_MS;
    setTimeout(() => {
      useThreadStore.getState().removeThreads(list);
      set((state) => {
        const removing = new Set(state.removingThreadIds);
        for (const id of list) removing.delete(id);
        return { removingThreadIds: removing };
      });
    }, delay);
  },
  removeThread: (id) =>
    set((state) => {
      const threadMap = new Map(state.threadMap);
      threadMap.delete(id);
      const next = new Set(state.selectedThreadIds);
      next.delete(id);
      return {
        threads: state.threads.filter((t) => t.id !== id),
        threadMap,
        selectedThreadId: state.selectedThreadId === id ? null : state.selectedThreadId,
        selectedThreadIds: next,
      };
    }),
  removeThreads: (ids) =>
    set((state) => {
      const idsSet = new Set(ids);
      const threadMap = new Map(state.threadMap);
      for (const id of ids) threadMap.delete(id);
      const next = new Set(state.selectedThreadIds);
      for (const id of ids) next.delete(id);
      return {
        threads: state.threads.filter((t) => !idsSet.has(t.id)),
        threadMap,
        selectedThreadId: state.selectedThreadId && idsSet.has(state.selectedThreadId) ? null : state.selectedThreadId,
        selectedThreadIds: next,
      };
    }),
  setSearch: (query, threadIds) => set({ searchQuery: query, searchThreadIds: threadIds }),
  clearSearch: () => set({ searchQuery: "", searchThreadIds: null }),
}));
