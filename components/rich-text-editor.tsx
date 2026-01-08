"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  toolbarClassName?: string;
  editorClassName?: string;
  isPurpleDark?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  onBlur,
  placeholder = "Type your idea...",
  autoFocus = false,
  className,
  toolbarClassName,
  editorClassName,
  isPurpleDark = false,
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-sky-600 underline cursor-pointer hover:text-sky-700",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:absolute before:opacity-50 before:pointer-events-none",
      }),
    ],
    content,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(
          "outline-none min-h-[60px] max-h-[120px] overflow-y-auto prose prose-sm max-w-none",
          "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
          isPurpleDark
            ? "prose-invert text-white"
            : "text-stone-800 prose-stone",
          editorClassName,
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    setLinkUrl("");
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  const buttonBaseClass = cn(
    "p-1 rounded transition-colors",
    isPurpleDark
      ? "hover:bg-white/15 text-white/80"
      : "hover:bg-stone-900/10 text-stone-600",
  );

  const buttonActiveClass = cn(
    isPurpleDark ? "bg-white/20 text-white" : "bg-stone-900/15 text-stone-800",
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Toolbar */}
      <div
        className={cn("flex items-center gap-0.5 flex-wrap", toolbarClassName)}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            buttonBaseClass,
            editor.isActive("bold") && buttonActiveClass,
          )}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            buttonBaseClass,
            editor.isActive("italic") && buttonActiveClass,
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            buttonBaseClass,
            editor.isActive("underline") && buttonActiveClass,
          )}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            buttonBaseClass,
            editor.isActive("strike") && buttonActiveClass,
          )}
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div
          className={cn(
            "w-px h-4 mx-1",
            isPurpleDark ? "bg-white/20" : "bg-stone-300",
          )}
        />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            buttonBaseClass,
            editor.isActive("bulletList") && buttonActiveClass,
          )}
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            buttonBaseClass,
            editor.isActive("orderedList") && buttonActiveClass,
          )}
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div
          className={cn(
            "w-px h-4 mx-1",
            isPurpleDark ? "bg-white/20" : "bg-stone-300",
          )}
        />

        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                buttonBaseClass,
                editor.isActive("link") && buttonActiveClass,
              )}
              title="Add Link"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-2"
            align="start"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setLink();
                  }
                }}
                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={setLink}
                className="px-2 py-1 text-sm bg-sky-500 text-white rounded hover:bg-sky-600"
              >
                Add
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {editor.isActive("link") && (
          <button
            type="button"
            onClick={removeLink}
            className={buttonBaseClass}
            title="Remove Link"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}

// Utility to render HTML content safely
export function RichTextContent({
  content,
  className,
  isPurpleDark = false,
}: {
  content: string;
  className?: string;
  isPurpleDark?: boolean;
}) {
  // If content is plain text (no HTML tags), wrap it in a paragraph
  const htmlContent =
    content && !content.includes("<") ? `<p>${content}</p>` : content;

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        "prose-a:text-sky-600 prose-a:underline hover:prose-a:text-sky-700",
        isPurpleDark ? "prose-invert text-white" : "text-stone-800 prose-stone",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
