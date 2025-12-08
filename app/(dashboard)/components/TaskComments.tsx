"use client";

import { useState, useEffect, useRef } from "react";
import { addComment } from "../actions/comment-actions";
import { uploadCommentFile, type FileUploadResult } from "../actions/file-actions";
import RichTextEditor from "./RichTextEditor";
import RichTextDisplay from "./RichTextDisplay";
import Avatar from "./Avatar";
import { supabaseBrowser } from "@/lib/supabaseClient";

interface CommentAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  attachments?: CommentAttachment[] | null;
  user: {
    full_name: string;
    user_id: string;
    avatar_url?: string | null;
  } | null;
}

interface TaskCommentsProps {
  taskId: string;
  comments: Comment[];
  onCommentAdded?: (newComment: Comment) => void;
}

const COMMENTS_PER_PAGE = 3;

export default function TaskComments({
  taskId,
  comments: initialComments,
  onCommentAdded,
}: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(COMMENTS_PER_PAGE);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResult[]>([]);

  // Update local comments when initialComments change
  useEffect(() => {
    setComments(initialComments);
    // Reset visible count when comments change (but keep showing at least 3)
    setVisibleCount(prev => Math.max(COMMENTS_PER_PAGE, Math.min(prev, initialComments.length)));
  }, [initialComments]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Strip HTML tags to check if there's actual content
    const textContent = newComment.replace(/<[^>]*>/g, '').trim();
    if (!textContent && uploadedFiles.length === 0) {
      setError("Comment cannot be empty");
      return;
    }

    setLoading(true);

    // Get current user for optimistic update
    const { data: { user } } = await supabaseBrowser.auth.getUser();
    let currentUser = null;
    if (user) {
      const { data: profile } = await supabaseBrowser
        .from('profiles')
        .select('full_name, user_id')
        .eq('user_id', user.id)
        .single();
      currentUser = profile;
    }

    // Optimistically add comment to UI
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      content: newComment,
      created_at: new Date().toISOString(),
      attachments: uploadedFiles.length > 0 ? uploadedFiles : null,
      user: currentUser,
    };
    setComments(prev => [...prev, optimisticComment]);

    // Clear form
    const commentToSave = newComment;
    const filesToSave = uploadedFiles;
    setNewComment("");
    setUploadedFiles([]);

    // Post comment to server
    const result = await addComment(
      taskId,
      commentToSave,
      filesToSave.length > 0 ? filesToSave : undefined
    );

    if (result.error) {
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setError(result.error);
      setNewComment(commentToSave); // Restore the comment text
      setUploadedFiles(filesToSave); // Restore files
      setLoading(false);
    } else if (result.data) {
      // Replace optimistic comment with real one from server
      setComments(prev => 
        prev.map(c => c.id === optimisticComment.id ? result.data : c)
      );
      // Notify parent if callback provided
      if (onCommentAdded) {
        onCommentAdded(result.data);
      }
      setLoading(false);
    }
  }


  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function isImage(type: string): boolean {
    return type.startsWith('image/');
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  }

  // Get visible comments (show last N comments, newest at bottom)
  const visibleComments = comments.slice(-visibleCount);
  const hasMoreComments = comments.length > visibleCount;

  function handleLoadMore() {
    setVisibleCount(prev => Math.min(prev + COMMENTS_PER_PAGE, comments.length));
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-zinc-300">
        Comments ({comments.length})
      </h3>

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-sm text-zinc-500 text-center py-8 bg-zinc-800 border border-zinc-700 rounded-lg">
          No comments yet
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleComments.map((comment) => (
              <div
                key={comment.id}
                className="bg-zinc-800 border border-zinc-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={comment.user?.full_name || "Unknown"}
                      avatarUrl={comment.user?.avatar_url}
                      size="sm"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">
                        {comment.user?.full_name || "Unknown"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {formatDate(comment.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
                {comment.content && (
                  <div className="mb-2">
                    <RichTextDisplay content={comment.content} className="text-sm" />
                  </div>
                )}
                
                {/* Attachments */}
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {comment.attachments.map((attachment, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {isImage(attachment.type) ? (
                          <div className="relative group">
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="max-w-xs max-h-48 rounded-md border border-zinc-700 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(attachment.url, '_blank')}
                            />
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                            >
                              <span className="text-white text-xs">Click to view full size</span>
                            </a>
                          </div>
                        ) : (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md border border-zinc-600 transition-colors"
                          >
                            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm truncate">{attachment.name}</div>
                              <div className="text-zinc-400 text-xs">{formatFileSize(attachment.size)}</div>
                            </div>
                            <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Load More Button */}
          {hasMoreComments && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Load more ({comments.length - visibleCount} more)
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        {error && (
          <div className="bg-red-950/40 border border-red-900 rounded-md px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        <RichTextEditor
          value={newComment}
          onChange={setNewComment}
          placeholder="Add a comment..."
          taskId={taskId}
          onFilesUploaded={(files) => {
            setUploadedFiles(prev => [...prev, ...files]);
          }}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || (!newComment.replace(/<[^>]*>/g, '').trim() && uploadedFiles.length === 0)}
            className="px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
          >
            {loading ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
