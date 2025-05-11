import { StateCreator } from "zustand";
import { countTokens } from "../utils/tokenCounter";
import { TaskItem } from "../interfaces/task";
import { PromptItem } from "./promptSlice";
import { WEmit } from "@/services/WEvent/WEventClient";

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileItem[];
}

export interface FileSlice {
  // File-specific state
  workingDirectory: string;
  fileList: FileItem[];
  selectedFiles: Set<string>;
  tokenCount: number;
  excludedPatterns: string[];
  showHiddenFiles: boolean;

  // NEW: For the "Auto Browser Flow" checkbox
  autoBrowserFlow: boolean;
  setAutoBrowserFlow: (value: boolean) => void;

  // NEW: For auto model recommendations
  autoRouteLlm: boolean;
  setAutoRouteLlm: (value: boolean) => void;

  // File-specific actions
  setWorkingDirectory: (directory: string) => void;
  setFileList: (files: FileItem[]) => Promise<void>;
  toggleFileSelection: (path: string) => Promise<void>;
  removeFiles: () => void;
  clearSelection: () => void;
  selectAll: () => Promise<void>;
  updateTokenCount: () => Promise<void>;

  // Settings
  setExcludedPatterns: (patterns: string[]) => void;
  setShowHiddenFiles: (visible: boolean) => void;
}

/**
 * Utility to turn a given pattern into a RegExp.
 * If it already contains ^ or $, we assume it's deliberately anchored by the user.
 * Otherwise, we anchor it ourselves so that "build" doesn't match "buildView.js".
 */
function createRegexFromPattern(pattern: string): RegExp {
  if (pattern.startsWith("^") || pattern.endsWith("$")) {
    return new RegExp(pattern);
  }
  return new RegExp(`^${pattern}$`);
}

export const createFileSlice: StateCreator<
  FileSlice & {
    taskHistory?: TaskItem[];
    prompts?: PromptItem[];
    theme?: "light" | "dark";
  },
  [],
  [],
  FileSlice
> = (set, get) => ({
  // Defaults
  workingDirectory: "",
  fileList: [],
  selectedFiles: new Set(),
  tokenCount: 0,
  excludedPatterns: [
    "^wonderprompts$",
    ".DS_Store",
    "Thumbs.db",
    ".git",
    ".vscode",
    ".idea",
    "build",
    "dist",
    "out",
    "coverage",
    ".cache",
    "node_modules",
    ".env",
    ".env.*",
    "^release$",
    "^package-lock\\.json$",
    ".json",
    ".icns",
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
    ".flv",
    ".wmv",
    ".mp3",
    ".wav",
    ".flac",
    ".ogg",
    ".aac",
    ".pdf",
    ".zip",
    ".tar",
    ".rar",
    ".7z",
    ".gz",
    ".bz2",
    ".xz",
    ".iso",
    ".dmg",
    ".exe",
    ".bin",
    ".obj",
    ".dll",
    ".so",
    ".ttf",
    ".woff",
    ".woff2",
    ".eot",
    ".gif",
    ".tiff",
    ".bmp",
    ".svg",
    ".psd",
    ".ai",
    ".sketch",
    ".ico",
    ".lock",
    ".png",
    ".webp",
    ".jpg",
    ".jpeg",
  ],
  showHiddenFiles: false,

  // NEW: "Auto Browser Flow" is ON by default
  autoBrowserFlow: true,
  setAutoBrowserFlow: (value) => {
    set({ autoBrowserFlow: value });
  },

  // NEW: auto model recommendation control
  autoRouteLlm: true,
  setAutoRouteLlm: (value) => {
    set({ autoRouteLlm: value });
  },

  setWorkingDirectory: (directory) => {
    set({ workingDirectory: directory });
  },

  setFileList: async (files) => {
    const excludePatterns = get().excludedPatterns;
    const showHidden = get().showHiddenFiles;

    function filterFiles(items: FileItem[]): FileItem[] {
      return items
        .filter((item) => {
          if (
            excludePatterns.some((pattern) =>
              createRegexFromPattern(pattern).test(item.name),
            )
          ) {
            return false;
          }
          if (!showHidden && item.name.startsWith(".")) {
            return false;
          }
          return true;
        })
        .map((item) => ({
          ...item,
          children: item.children ? filterFiles(item.children) : undefined,
        }));
    }

    const filtered = filterFiles(files);
    const allPaths = new Set<string>();
    const collectPaths = (item: FileItem) => {
      allPaths.add(item.path);
      item.children?.forEach(collectPaths);
    };
    filtered.forEach(collectPaths);

    if (get().selectedFiles.size === 0) {
      set({ fileList: filtered, selectedFiles: allPaths });
      await get().updateTokenCount();
      return;
    }

    const validSelections = new Set(
      Array.from(get().selectedFiles).filter((path) => allPaths.has(path)),
    );
    set({ fileList: filtered, selectedFiles: validSelections });
    await get().updateTokenCount();
  },

  toggleFileSelection: async (path) => {
    const state = get();
    const newSelection = new Set(state.selectedFiles);

    const findItemByPath = (
      items: FileItem[],
      searchPath: string,
    ): FileItem | null => {
      for (const item of items) {
        if (item.path === searchPath) return item;
        if (item.children) {
          const found = findItemByPath(item.children, searchPath);
          if (found) return found;
        }
      }
      return null;
    };

    const getAllPaths = (item: FileItem): string[] => {
      const paths = [item.path];
      if (item.children) {
        item.children.forEach((child) => {
          paths.push(...getAllPaths(child));
        });
      }
      return paths;
    };

    const item = findItemByPath(state.fileList, path);
    if (item) {
      const allPaths = getAllPaths(item);
      const isSelected = newSelection.has(path);
      if (isSelected) {
        allPaths.forEach((p) => newSelection.delete(p));
      } else {
        allPaths.forEach((p) => newSelection.add(p));
      }
    }

    set({ selectedFiles: newSelection });
    await get().updateTokenCount();
  },

  removeFiles: () => {
    set((state) => {
      const pathsToRemove = new Set(state.selectedFiles);
      function filterFiles(items: FileItem[]): FileItem[] {
        return items
          .filter((item) => !pathsToRemove.has(item.path))
          .map((item) => ({
            ...item,
            children: item.children ? filterFiles(item.children) : undefined,
          }));
      }
      const newFileList = filterFiles(state.fileList);
      return {
        fileList: newFileList,
        selectedFiles: new Set(),
        tokenCount: 0,
      };
    });
  },

  clearSelection: () => {
    set({ selectedFiles: new Set(), tokenCount: 0 });
  },

  selectAll: async () => {
    const state = get();
    const allPaths = new Set<string>();

    const collectPaths = (item: FileItem) => {
      allPaths.add(item.path);
      item.children?.forEach(collectPaths);
    };
    state.fileList.forEach(collectPaths);
    set({ selectedFiles: allPaths });
    await get().updateTokenCount();
  },

  updateTokenCount: async () => {
    const count = await countTokens(get().selectedFiles);
    set({ tokenCount: count });
  },

  setExcludedPatterns: (patterns: string[]) => {
    set({ excludedPatterns: patterns });
  },

  setShowHiddenFiles: (visible: boolean) => {
    set({ showHiddenFiles: visible });
  },
});
