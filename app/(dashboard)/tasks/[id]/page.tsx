"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTaskDetails, updateTaskStatus } from "../../actions/task-actions";
import TimeTracker from "../../components/TimeTracker";
import TimeEntriesList from "../../components/TimeEntriesList";
import TaskComments from "../../components/TaskComments";
import { supabaseBrowser } from "@/lib/supabaseClient";

interface TaskDetails {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "in_review" | "complete";
  priority: string | null;
  due_date: string | null;
  estimated_time_minutes: number | null;
  total_tracked_minutes?: number | null;
  assignee_id: string | null;
  creator_id: string | null;
  assignee: {
    full_name: string;
    user_id: string;
  } | null;
  creator: {
    full_name: string;
    user_id: string;
  } | null;
  time_entries: any[];
  comments: any[];
}

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (id) {
      loadTaskDetails();
      loadCurrentUser();
    }
  }, [id]);

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadTaskDetails() {
    setLoading(true);
    setError(null);
    const result = await getTaskDetails(id);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setTask(result.data as TaskDetails);
      setLoading(false);
    }
  }

  async function handleStatusChange(
    newStatus: "todo" | "in_progress" | "in_review" | "complete"
  ) {
    const oldStatus = task?.status;
    
    // Optimistic update - update local state immediately
    if (task) {
      setTask({ ...task, status: newStatus });
    }
    
    setUpdatingStatus(true);
    const result = await updateTaskStatus(id, newStatus);

    if (result.error) {
      // Rollback on error
      if (task && oldStatus) {
        setTask({ ...task, status: oldStatus });
      }
      setError(result.error);
      setUpdatingStatus(false);
    } else {
      // Reload task details to get fresh data
      await loadTaskDetails();
      setUpdatingStatus(false);
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getPriorityColor(priority: string | null): string {
    switch (priority) {
      case "urgent":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "low":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "complete":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "in_progress":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "in_review":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  }

  const isAssignee = task?.assignee_id === currentUserId;
  const isCreator = task?.creator_id === currentUserId;
  const canUpdateStatus = isAssignee || isCreator;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-400">Loading task...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-950/40 border border-red-900 rounded-md px-4 py-3 text-sm text-red-400">
          {error}
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6">
        <p className="text-zinc-400">Task not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-semibold text-white mb-4">
              {task.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`px-3 py-1.5 text-sm font-medium rounded border ${getStatusColor(
                  task.status
                )}`}
              >
                {task.status.replace("_", " ").toUpperCase()}
              </span>
              {task.priority && (
                <span
                  className={`px-3 py-1.5 text-sm font-medium rounded border ${getPriorityColor(
                    task.priority
                  )}`}
                >
                  {task.priority.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Update */}
        {canUpdateStatus && (
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-zinc-400">Status:</span>
            <select
              value={task.status}
              onChange={(e) =>
                handleStatusChange(
                  e.target.value as
                    | "todo"
                    | "in_progress"
                    | "in_review"
                    | "complete"
                )
              }
              disabled={updatingStatus}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[#6295ff] disabled:opacity-60"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Task Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">
              Description
            </h3>
            <p className="text-zinc-300 whitespace-pre-wrap">
              {task.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">
                Assigned to
              </h3>
              <p className="text-white">
                {task.assignee?.full_name || "Unassigned"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">
                Created by
              </h3>
              <p className="text-white">
                {task.creator?.full_name || "Unknown"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">
                Due Date
              </h3>
              <p className="text-white">{formatDate(task.due_date)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">
                Estimated Time
              </h3>
              <p className="text-white">
                {task.estimated_time_minutes
                  ? `${Math.floor(task.estimated_time_minutes / 60)}h ${task.estimated_time_minutes % 60}m`
                  : "Not set"}
              </p>
            </div>
          </div>
        </div>

        {/* Time Tracking */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Time Tracking
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeTracker
              taskId={id}
              isAssignee={isAssignee || false}
              onTimeAdded={(taskId, addedMinutes) => {
                // Update local task state optimistically
                const newTotal = (task?.total_tracked_minutes || 0) + addedMinutes;
                if (task) {
                  setTask({
                    ...task,
                    total_tracked_minutes: newTotal,
                  });
                }
                // Reload task details in background to get fresh data (time entries list)
                loadTaskDetails();
              }}
            />
            <TimeEntriesList
              entries={task.time_entries || []}
              estimatedMinutes={task.estimated_time_minutes}
              onEntryDeleted={loadTaskDetails}
            />
          </div>
        </div>

        {/* Comments */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <TaskComments
            taskId={id}
            comments={task.comments || []}
            onCommentAdded={(newComment) => {
              // Update task state with new comment
              if (task) {
                setTask({
                  ...task,
                  comments: [...(task.comments || []), newComment],
                });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

