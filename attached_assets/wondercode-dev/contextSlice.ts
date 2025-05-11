import { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { FileItem } from "./fileSlice";
import { PromptItem } from "./promptSlice";
import { TaskItem } from "../interfaces/task";

export interface ContextItem {
  id: string;
  title: string;
  description: string;
  files: string[]; // full file paths
  attachedPrompts: string[]; // array of prompt IDs
}

/**
 * ContextSlice stores user-defined contexts.
 * The user can create multiple contexts, each with:
 *   - an ID, title, description,
 *   - a set of files,
 *   - attached prompt IDs
 * We also track a `draftSelectedContextId` to let the user pick a context for a new task,
 * so that the TaskTab can quickly load that context's files & prompts.
 */
export interface ContextSlice {
  contexts: ContextItem[]; // all saved contexts
  draftSelectedContextId: string | null;

  addContext: (
    title: string,
    description: string,
    files: string[],
    attachedPrompts: string[],
  ) => void;
  updateContext: (
    id: string,
    title: string,
    description: string,
    files: string[],
    attachedPrompts: string[],
  ) => void;
  deleteContext: (id: string) => void;

  setDraftSelectedContextId: (contextId: string | null) => void;

  loadContextToStore: (id: string) => void;
}

export const createContextSlice: StateCreator<
  ContextSlice & {
    fileList?: FileItem[];
    selectedFiles?: Set<string>;
    setFileList?: (files: FileItem[]) => Promise<void>;
    setDraftAttachedPrompts?: (prompts: string[]) => void;
    prompts?: PromptItem[];
    taskHistory?: TaskItem[];
    updateTokenCount?: () => Promise<void>;
  },
  [],
  [],
  ContextSlice
> = (set, get) => ({
  contexts: [],
  draftSelectedContextId: null,

  addContext: (title, description, files, attachedPrompts) => {
    const newContext: ContextItem = {
      id: uuidv4(),
      title: title.trim(),
      description: description.trim(),
      files,
      attachedPrompts,
    };
    set((state) => ({
      contexts: [...state.contexts, newContext],
    }));
  },

  updateContext: (id, title, description, files, attachedPrompts) => {
    set((state) => ({
      contexts: state.contexts.map((ctx) =>
        ctx.id === id
          ? {
              ...ctx,
              title: title.trim(),
              description: description.trim(),
              files,
              attachedPrompts,
            }
          : ctx,
      ),
    }));
  },

  deleteContext: (id) => {
    set((state) => ({
      contexts: state.contexts.filter((ctx) => ctx.id !== id),
    }));
  },

  setDraftSelectedContextId: (contextId) => {
    set({ draftSelectedContextId: contextId });
  },

  /**
   * loadContextToStore:
   *  - If given "none" or an empty string, deselect all files and clear attached prompts.
   *  - Otherwise, sets the store's selectedFiles and draftAttachedPrompts from the context,
   *    then calls updateTokenCount().
   */
  loadContextToStore: (id) => {
    const state = get();
    if (!id || id === "none") {
      // Deselect all files and clear prompts
      set(() => ({
        selectedFiles: new Set<string>(),
      }));
      if (state.setDraftAttachedPrompts) {
        state.setDraftAttachedPrompts([]);
      }
      if (state.updateTokenCount) {
        void state.updateTokenCount();
      }
      return;
    }

    const ctx = state.contexts.find((c) => c.id === id);
    if (!ctx) return;

    // We set the store's selectedFiles
    set(() => ({
      selectedFiles: new Set(ctx.files),
    }));

    // Also set the store's draftAttachedPrompts
    if (state.setDraftAttachedPrompts) {
      state.setDraftAttachedPrompts(ctx.attachedPrompts);
    }

    // Ensure token count is updated
    if (state.updateTokenCount) {
      void state.updateTokenCount();
    }
  },
});
