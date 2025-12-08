"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { updateTaskStatus } from "./actions/task-actions";

interface TaskWithMetadata {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  priority: string | null;
  estimated_time_minutes: number | null;
  total_tracked_minutes?: number;
  comment_count?: number;
}

export default function MyTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    if (!user) return;

    setLoading(true);

    // Load user's default view preference
    const { data: profile } = await supabaseBrowser
      .from("profiles")
      .select("default_view")
      .eq("user_id", user.id)
      .single();

    if (profile?.default_view) {
      setViewMode(profile.default_view as "board" | "list");
    }

    // Load tasks assigned to current user
    const { data: tasksData, error } = await supabaseBrowser
      .from("tasks")
      .select("*")
      .eq("assignee_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tasks:", error);
      setLoading(false);
      return;
    }

    // Load time entries and comments for each task
    const tasksWithMetadata = await Promise.all(
      (tasksData || []).map(async (task: any) => {
        // Get total tracked time
        const { data: timeEntries } = await supabaseBrowser
          .from("time_entries")
          .select("minutes")
          .eq("task_id", task.id);

        const totalTrackedMinutes =
          timeEntries?.reduce((sum: number, entry: any) => sum + entry.minutes, 0) || 0;

        // Get comment count
        const { count: commentCount } = await supabaseBrowser
          .from("task_comments")
          .select("*", { count: "exact", head: true })
          .eq("task_id", task.id);

        return {
          ...task,
          total_tracked_minutes: totalTrackedMinutes,
          comment_count: commentCount || 0,
        };
      })
    );

    setTasks(tasksWithMetadata);
    setLoading(false);
  }

  function updateTaskInState(taskId: string, updates: Partial<TaskWithMetadata>) {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  }

  function updateTaskTimeTracking(taskId: string, addedMinutes: number) {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, total_tracked_minutes: (task.total_tracked_minutes || 0) + addedMinutes }
        : task
    ));
  }

  function handleTaskUpdate(taskId?: string, updates?: Partial<TaskWithMetadata>) {
    if (taskId && updates) {
      // Partial update - only update the specific task
      updateTaskInState(taskId, updates);
    } else {
      // Full refresh - fallback for cases where we don't have specific updates
      loadTasks();
    }
  }

  async function handleViewModeChange(mode: "board" | "list") {
    setViewMode(mode);
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    if (user) {
      await supabaseBrowser
        .from("profiles")
        .update({ default_view: mode })
        .eq("user_id", user.id);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-400">Loading tasks...</p>
      </div>
    );
  }

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    in_review: tasks.filter((t) => t.status === "in_review"),
    complete: tasks.filter((t) => t.status === "complete"),
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">My Tasks</h2>
        <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-md border border-zinc-800">
          <button
            onClick={() => handleViewModeChange("board")}
            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
              viewMode === "board"
                ? "bg-[#6295ff] text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => handleViewModeChange("list")}
            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
              viewMode === "list"
                ? "bg-[#6295ff] text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {viewMode === "board" ? (
        <div className="grid grid-cols-4 gap-4">
          {[
            { key: "todo", label: "To Do", tasks: tasksByStatus.todo },
            {
              key: "in_progress",
              label: "In Progress",
              tasks: tasksByStatus.in_progress,
            },
            { key: "in_review", label: "In Review", tasks: tasksByStatus.in_review },
            { key: "complete", label: "Complete", tasks: tasksByStatus.complete },
          ].map((column) => (
            <div
              key={column.key}
              className="flex flex-col"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const dropZone = e.currentTarget.querySelector('.space-y-3');
                if (dropZone) {
                  dropZone.classList.add("border-[#6295ff]", "bg-zinc-800/30");
                }
              }}
              onDragLeave={(e) => {
                const dropZone = e.currentTarget.querySelector('.space-y-3');
                if (dropZone) {
                  dropZone.classList.remove("border-[#6295ff]", "bg-zinc-800/30");
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dropZone = e.currentTarget.querySelector('.space-y-3');
                if (dropZone) {
                  dropZone.classList.remove("border-[#6295ff]", "bg-zinc-800/30");
                }
                const taskId = e.dataTransfer.getData("taskId");
                const currentTask = tasks.find((t) => t.id === taskId);
                if (taskId && currentTask && column.key !== currentTask.status) {
                  const newStatus = column.key as "todo" | "in_progress" | "in_review" | "complete";
                  const oldStatus = currentTask.status;
                  
                  // Optimistic update - update UI immediately
                  updateTaskInState(taskId, { status: newStatus });
                  
                  // Server update in background
                  const result = await updateTaskStatus(taskId, newStatus);
                  if (result.error) {
                    // Rollback on error
                    console.error('Error updating task status:', result.error);
                    updateTaskInState(taskId, { status: oldStatus });
                  }
                }
              }}
            >
              <div className="mb-3">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
                  {column.label} ({column.tasks.length})
                </h3>
              </div>
              <div className="space-y-3 flex-1 min-h-[400px] rounded-lg p-2 transition-colors border-2 border-dashed border-transparent">
                {column.tasks.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    No tasks
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onTaskClick={() => router.push(`/tasks/${task.id}`)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800 border-b border-zinc-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                    No tasks found
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-zinc-800 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/tasks/${task.id}`}
                          className="text-white font-medium hover:text-[#6295ff] transition-colors"
                        >
                          {task.title}
                        </Link>
                        {task.comment_count && task.comment_count > 0 && (
                          <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded">
                            {task.comment_count}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <div className="text-zinc-400 text-sm mt-1 line-clamp-1">
                          {task.description}
                        </div>
                      )}
                      {task.estimated_time_minutes && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="text-xs text-zinc-500">
                            {formatTime(task.estimated_time_minutes)} est.
                          </div>
                          {task.total_tracked_minutes && task.total_tracked_minutes > 0 && (
                            <div className="text-xs text-zinc-500">
                              • {formatTime(task.total_tracked_minutes)} tracked
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-zinc-800 text-zinc-300 capitalize">
                        {task.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm capitalize">
                      {task.priority || "normal"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

function TaskCard({ task, onTaskClick }: { task: TaskWithMetadata; onTaskClick: () => void }) {
  const wasDraggedRef = useRef(false);

  function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }

  const timeProgress =
    task.estimated_time_minutes && task.estimated_time_minutes > 0
      ? (task.total_tracked_minutes || 0) / task.estimated_time_minutes
      : null;

  function handleClick(e: React.MouseEvent) {
    // Prevent navigation if this was a drag operation
    if (wasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      // Reset flag after a short delay
      setTimeout(() => {
        wasDraggedRef.current = false;
      }, 100);
      return;
    }
    onTaskClick();
  }

  function handleDragStart(e: React.DragEvent) {
    wasDraggedRef.current = false;
    e.dataTransfer.setData("taskId", task.id);
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  }

  function handleDrag(e: React.DragEvent) {
    // Mark that dragging has occurred
    wasDraggedRef.current = true;
  }

  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    // Keep the flag true briefly to prevent click event
    // It will be reset in handleClick or after timeout
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 200);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors cursor-move active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <button
          onClick={handleClick}
          className="text-white font-medium flex-1 text-left hover:text-[#6295ff] transition-colors"
        >
          {task.title}
        </button>
        {task.comment_count && task.comment_count > 0 && (
          <span className="bg-zinc-800 text-zinc-300 text-xs px-1.5 py-0.5 rounded ml-2">
            {task.comment_count}
          </span>
        )}
      </div>
      {task.description && (
        <p className="text-zinc-400 text-sm line-clamp-2 mb-2">
          {task.description}
        </p>
      )}
      
      {/* Time Progress */}
      {task.estimated_time_minutes && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span>
              {formatTime(task.total_tracked_minutes || 0)} / {formatTime(task.estimated_time_minutes)}
            </span>
            {timeProgress !== null && (
              <span className={timeProgress > 1 ? "text-red-400" : "text-green-400"}>
                {Math.round(timeProgress * 100)}%
              </span>
            )}
          </div>
          {timeProgress !== null && (
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  timeProgress > 1 ? "bg-red-500" : "bg-green-500"
                }`}
                style={{
                  width: `${Math.min(timeProgress * 100, 100)}%`,
                }}
              ></div>
            </div>
          )}
        </div>
      )}

      {task.due_date && (
        <div className="mt-2 text-xs text-zinc-500">
          Due: {new Date(task.due_date).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}m`;
  }
}

