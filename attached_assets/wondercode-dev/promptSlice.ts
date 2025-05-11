import { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { FileItem } from "./fileSlice";
import { TaskItem } from "../interfaces/task";

// Import the seed data
import seedPrompts from "@/seed/prompts.json" assert { type: "json" };

export interface PromptItem {
  id: string;
  title: string;
  content: string;
}

export interface PromptSlice {
  prompts: PromptItem[];

  addPrompt: (title: string, content: string) => void;
  updatePrompt: (id: string, title: string, content: string) => void;
  deletePrompt: (id: string) => void;
}

export const createPromptSlice: StateCreator<
  PromptSlice & {
    fileList?: FileItem[];
    taskHistory?: TaskItem[];
  },
  [],
  [],
  PromptSlice
> = (set) => ({
  // Load default prompts from the seed file:
  prompts: seedPrompts.prompts,

  addPrompt: (title, content) => {
    const newPrompt = {
      id: uuidv4(),
      title,
      content,
    };
    set((state) => ({
      prompts: [...state.prompts, newPrompt],
    }));
  },

  updatePrompt: (id, title, content) => {
    set((state) => ({
      prompts: state.prompts.map((prompt) =>
        prompt.id === id ? { ...prompt, title, content } : prompt,
      ),
    }));
  },

  deletePrompt: (id) => {
    set((state) => ({
      prompts: state.prompts.filter((prompt) => prompt.id !== id),
    }));
  },
});
