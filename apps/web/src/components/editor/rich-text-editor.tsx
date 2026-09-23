"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Tiptap replaces the raw HTML textarea the Comlabs implementation used.
 * Output is clean HTML, which the server sanitizes again before storing —
 * the editor is a convenience, never the security boundary.
 */

interface ToolbarButton {
  label: string;
  title: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const BUTTONS: ToolbarButton[] = [
  { label: "B", title: "Bold", isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { label: "I", title: "Italic", isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: "H2", title: "Heading 2", isActive: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "H3", title: "Heading 3", isActive: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "“”", title: "Quote", isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "•", title: "Bullet list", isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "1.", title: "Numbered list", isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "</>", title: "Code block", isActive: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  readOnly,
  onRequestUpload,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  /** Returns the hosted URL for a dropped or picked image. */
  onRequestUpload?: (file: File) => Promise<string>;
}) {
  // `handleDrop` is defined before `editor` exists, so it reaches the instance
  // through a ref that is kept in sync below.
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    // Rendered on the client only; SSR would mismatch on the contenteditable.
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ HTMLAttributes: { loading: "lazy", decoding: "async" } }),
    ],
    content: value,
    editorProps: {
      attributes: { class: "tiptap", "data-placeholder": placeholder ?? "" },
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/") || !onRequestUpload) return false;
        event.preventDefault();
        void onRequestUpload(file).then((url) => {
          editorRef.current?.chain().focus().setImage({ src: url }).run();
        });
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previous ?? "https://");
    if (href === null) return;
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }, [editor]);

  const pickImage = useCallback(() => {
    if (!editor || !onRequestUpload) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await onRequestUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    };
    input.click();
  }, [editor, onRequestUpload]);

  if (!editor) {
    return <div className="min-h-[24rem] rounded-lg border border-[var(--color-line)] bg-white" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-line)] px-2 py-1.5">
          {BUTTONS.map((button) => (
            <button
              key={button.label}
              type="button"
              title={button.title}
              aria-pressed={button.isActive(editor)}
              onClick={() => button.run(editor)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                button.isActive(editor)
                  ? "bg-neutral-900 text-white"
                  : "text-[var(--color-muted)] hover:bg-neutral-100"
              }`}
            >
              {button.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
          <button type="button" onClick={insertLink} className="rounded px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:bg-neutral-100">
            Link
          </button>
          {onRequestUpload && (
            <button type="button" onClick={pickImage} className="rounded px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:bg-neutral-100">
              Image
            </button>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
