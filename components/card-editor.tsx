"use client";

import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  List,
  ListTodo,
  Loader2,
  Sparkles,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TiptapContent } from "@/db/schema";
import { cn } from "@/lib/utils";

// Re-export utilities from lib for backwards compatibility
export {
  createTiptapContent,
  extractTextFromTiptap,
  isContentEmpty,
} from "@/lib/tiptap-utils";

interface CardEditorProps {
  content: TiptapContent;
  onChange?: (content: TiptapContent) => void;
  onBlur?: () => void;
  editable?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  // Props for AI refine feature
  cardId?: string;
  userId?: string;
  allowRefine?: boolean;
}

export function CardEditor({
  content,
  onChange,
  onBlur,
  editable = true,
  autoFocus = false,
  placeholder = "Type your idea...",
  className,
  cardId,
  userId,
  allowRefine = false,
}: CardEditorProps) {
  const [isRefining, setIsRefining] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need
        codeBlock: false,
        blockquote: false,
        heading: false,
        horizontalRule: false,
        code: false,
        // Enable underline (included in StarterKit)
        underline: {},
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content as JSONContent,
    editable,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as TiptapContent;
      onChange?.(json);
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[60px] h-full",
      },
    },
    immediatelyRender: false,
  });

  // Update content when prop changes (for real-time sync from OTHER users)
  // CRITICAL: Only sync from props when NOT actively editing (editable=false)
  // When editable=true, the editor owns its content - don't overwrite from props
  // This prevents character loss during fast typing
  useEffect(() => {
    if (!editor || !content || editable) return;

    // Only update if content is actually different from editor's current state
    const currentContent = JSON.stringify(editor.getJSON());
    const newContent = JSON.stringify(content);
    if (currentContent !== newContent) {
      editor.commands.setContent(content as JSONContent);
    }
  }, [editor, content, editable]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor?.chain().focus().toggleStrike().run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleTaskList = useCallback(() => {
    editor?.chain().focus().toggleTaskList().run();
  }, [editor]);

  const handleRefine = useCallback(async () => {
    if (!editor || !cardId || !userId || isRefining) return;

    // Get selected text
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    if (!selectedText.trim()) return;

    // Get full content for context
    const fullContent = editor.getJSON() as TiptapContent;

    setIsRefining(true);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          fullContent,
          cardId,
          userId,
        }),
      });

      if (res.ok) {
        const { refined } = await res.json();
        if (refined?.content) {
          // Replace selection with Tiptap JSON content
          editor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent(refined.content)
            .run();
        }
      }
    } catch (error) {
      console.error("Refine error:", error);
    } finally {
      setIsRefining(false);
    }
  }, [editor, cardId, userId, isRefining]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("card-editor relative", className)}>
      {editable && (
        <TiptapBubbleMenu
          editor={editor}
          shouldShow={({ editor: e, state }) => {
            // Only show when there's a text selection (not just cursor)
            const { from, to } = state.selection;
            return from !== to && !e.state.selection.empty;
          }}
          options={{
            placement: "top",
          }}
          className="z-[9999] flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl"
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBold();
            }}
            className={cn(
              "rounded p-1.5 text-popover-foreground hover:bg-muted transition-colors",
              editor.isActive("bold") && "bg-primary text-primary-foreground",
            )}
            title="Bold (Ctrl+B)"
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleItalic();
            }}
            className={cn(
              "rounded p-1.5 text-popover-foreground hover:bg-muted transition-colors",
              editor.isActive("italic") && "bg-primary text-primary-foreground",
            )}
            title="Italic (Ctrl+I)"
          >
            <Italic className="size-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleUnderline();
            }}
            className={cn(
              "rounded p-1.5 text-popover-foreground hover:bg-muted transition-colors",
              editor.isActive("underline") &&
                "bg-primary text-primary-foreground",
            )}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="size-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleStrike();
            }}
            className={cn(
              "rounded p-1.5 text-popover-foreground hover:bg-muted transition-colors",
              editor.isActive("strike") && "bg-primary text-primary-foreground",
            )}
            title="Strikethrough"
          >
            <Strikethrough className="size-4" />
          </button>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBulletList();
            }}
            className={cn(
              "rounded p-1.5 text-popover-foreground hover:bg-muted transition-colors",
              editor.isActive("bulletList") &&
                "bg-primary text-primary-foreground",
            )}
            title="Bullet List"
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleTaskList();
            }}
            className={cn(
              "rounded p-1.5 text-popover-foreground hover:bg-muted transition-colors",
              editor.isActive("taskList") &&
                "bg-primary text-primary-foreground",
            )}
            title="Todo List"
          >
            <ListTodo className="size-4" />
          </button>
          {allowRefine && cardId && userId && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleRefine();
                }}
                disabled={isRefining}
                className={cn(
                  "rounded p-1.5 text-popover-foreground hover:bg-muted transition-colors",
                  isRefining && "opacity-50 cursor-wait",
                )}
                title="Refine with AI"
              >
                {isRefining ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </button>
            </>
          )}
        </TiptapBubbleMenu>
      )}
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}
