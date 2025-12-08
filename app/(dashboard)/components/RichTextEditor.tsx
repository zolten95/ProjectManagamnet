"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect } from "react";
import { uploadCommentFile, type FileUploadResult } from "../actions/file-actions";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  taskId?: string;
  onFilesUploaded?: (files: FileUploadResult[]) => void;
  disabled?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter text...",
  taskId,
  onFilesUploaded,
  disabled = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[#6295ff] underline",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-md",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[150px] px-3 py-2 text-white",
      },
    },
  });

  // Update editor content when value prop changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  const addImage = useCallback(async () => {
    if (!editor || !taskId) return;

    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const result = await uploadCommentFile(file, taskId);
      if (result.error) {
        alert(`Failed to upload image: ${result.error}`);
        return;
      }

      if (result.data) {
        editor.chain().focus().setImage({ src: result.data.url }).run();
        if (onFilesUploaded) {
          onFilesUploaded([result.data]);
        }
      }
    };
  }, [editor, taskId, onFilesUploaded]);

  const addLink = useCallback(() => {
    if (!editor) return;

    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addFile = useCallback(async () => {
    if (!editor || !taskId) return;

    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("multiple", "true");
    input.setAttribute("accept", "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv");
    input.click();

    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;

      const uploadPromises = files.map((file) => uploadCommentFile(file, taskId));
      const results = await Promise.all(uploadPromises);

      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        alert(`Failed to upload ${errors.length} file(s): ${errors[0].error}`);
        return;
      }

      const uploadedFiles = results.filter((r) => r.data).map((r) => r.data!);

      uploadedFiles.forEach((file) => {
        if (file.type.startsWith("image/")) {
          editor.chain().focus().setImage({ src: file.url }).run();
        } else {
          editor.chain().focus().insertContent(`<a href="${file.url}" target="_blank" rel="noopener noreferrer" class="text-[#6295ff] underline">${file.name}</a> `).run();
        }
      });

      if (onFilesUploaded && uploadedFiles.length > 0) {
        onFilesUploaded(uploadedFiles);
      }
    };
  }, [editor, taskId, onFilesUploaded]);

  if (!editor) {
    return <div className="text-zinc-400">Loading editor...</div>;
  }

  return (
    <div className="rich-text-editor">
      <style jsx global>{`
        .rich-text-editor .ProseMirror {
          outline: none;
          min-height: 150px;
          padding: 12px;
          background: rgb(39 39 42);
          border: 1px solid rgb(63 63 70);
          border-top: none;
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
          color: white;
        }
        .rich-text-editor .ProseMirror:focus {
          border-color: rgb(98 149 255);
          box-shadow: 0 0 0 2px rgba(98, 149, 255, 0.2);
        }
        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgb(113 113 122);
          pointer-events: none;
          height: 0;
        }
        .rich-text-editor .ProseMirror a {
          color: rgb(98 149 255);
          text-decoration: underline;
        }
        .rich-text-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
        }
        .rich-text-editor .ProseMirror ul,
        .rich-text-editor .ProseMirror ol {
          padding-left: 1.5rem;
        }
        .rich-text-editor .ProseMirror h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .rich-text-editor .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .rich-text-editor .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .rich-text-editor .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          padding: 8px;
          background: rgb(24 24 27);
          border: 1px solid rgb(63 63 70);
          border-bottom: none;
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
        }
        .rich-text-editor .toolbar button {
          padding: 6px 10px;
          background: transparent;
          border: none;
          color: rgb(212 212 216);
          cursor: pointer;
          border-radius: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .rich-text-editor .toolbar button:hover {
          background: rgb(39 39 42);
          color: rgb(98 149 255);
        }
        .rich-text-editor .toolbar button.is-active {
          background: rgb(39 39 42);
          color: rgb(98 149 255);
        }
        .rich-text-editor .toolbar button svg {
          width: 16px;
          height: 16px;
        }
      `}</style>
      
      {/* Toolbar */}
      <div className="toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "is-active" : ""}
          title="Bold"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "is-active" : ""}
          title="Italic"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? "is-active" : ""}
          title="Strikethrough"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        </button>
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
          title="Heading 3"
        >
          H3
        </button>
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "is-active" : ""}
          title="Bullet List"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "is-active" : ""}
          title="Numbered List"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </button>
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={addLink}
          className={editor.isActive("link") ? "is-active" : ""}
          title="Add Link"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
        {taskId && (
          <>
            <button
              type="button"
              onClick={addImage}
              title="Add Image"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={addFile}
              title="Add File"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </>
        )}
        <div className="w-px h-6 bg-zinc-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear Formatting"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}
