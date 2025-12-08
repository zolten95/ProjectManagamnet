"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTaskDetails, updateTaskStatus, updateTaskDescription, updateTask, deleteTask, duplicateTask, convertTaskToTemplate, getTeamMembers, type UpdateTaskInput, type TeamMember } from "../actions/task-actions";
import TimeTracker from "./TimeTracker";
import TimeEntriesList from "./TimeEntriesList";
import TaskComments from "./TaskComments";
import RichTextEditor from "./RichTextEditor";
import RichTextDisplay from "./RichTextDisplay";
import { supabaseBrowser } from "@/lib/supabaseClient";

interface TaskDetailModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: (taskId?: string, updates?: Partial<{ status: string; total_tracked_minutes?: number }>) => void;
}

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

export default function TaskDetailModal({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
}: TaskDetailModalProps) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [editingTask, setEditingTask] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [converting, setConverting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    assignee_id: "",
    priority: "" as "low" | "normal" | "high" | "urgent" | "",
    due_date: "",
    estimated_hours: "",
    estimated_minutes: "",
  });

  useEffect(() => {
    if (isOpen && taskId) {
      loadTaskDetails();
      loadCurrentUser();
      loadTeamMembers();
    }
  }, [isOpen, taskId]);

  useEffect(() => {
    if (task && !editingTask) {
      setFormData({
        title: task.title,
        assignee_id: task.assignee_id || "",
        priority: (task.priority as any) || "",
        due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "",
        estimated_hours: task.estimated_time_minutes ? Math.floor(task.estimated_time_minutes / 60).toString() : "",
        estimated_minutes: task.estimated_time_minutes ? (task.estimated_time_minutes % 60).toString() : "",
      });
    }
  }, [task, editingTask]);

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadTeamMembers() {
    setLoadingMembers(true);
    const result = await getTeamMembers();
    if (result.data) {
      setTeamMembers(result.data);
    }
    setLoadingMembers(false);
  }

  async function loadTaskDetails() {
    setLoading(true);
    setError(null);
    const result = await getTaskDetails(taskId);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setTask(result.data as TaskDetails);
      setDescriptionValue(result.data?.description || "");
      setLoading(false);
    }
  }

  async function handleSaveDescription() {
    if (!task) return;
    setSavingDescription(true);
    const result = await updateTaskDescription(task.id, descriptionValue);
    if (result.error) {
      setError(result.error);
      setSavingDescription(false);
    } else {
      setTask({ ...task, description: descriptionValue });
      setEditingDescription(false);
      setSavingDescription(false);
    }
  }

  async function handleSaveTask() {
    if (!task) return;
    setSavingTask(true);
    setError(null);

    const estimatedMinutes = 
      (parseInt(formData.estimated_hours) || 0) * 60 + 
      (parseInt(formData.estimated_minutes) || 0);

    const updateData: UpdateTaskInput = {
      title: formData.title,
      assignee_id: formData.assignee_id || null,
      priority: formData.priority || null,
      due_date: formData.due_date || null,
      estimated_time_minutes: estimatedMinutes || null,
    };

    const result = await updateTask(task.id, updateData);
    if (result.error) {
      setError(result.error);
      setSavingTask(false);
    } else {
      await loadTaskDetails();
      setEditingTask(false);
      setSavingTask(false);
      if (onTaskUpdated) {
        onTaskUpdated(task.id);
      }
    }
  }

  async function handleDeleteTask() {
    if (!task) return;
    const result = await deleteTask(task.id);
    if (result.error) {
      setError(result.error);
    } else {
      onClose();
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      router.refresh();
    }
    setShowDeleteConfirm(false);
  }

  async function handleDuplicateTask() {
    if (!task) return;
    setDuplicating(true);
    const result = await duplicateTask(task.id);
    if (result.error) {
      setError(result.error);
    } else {
      onClose();
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      router.refresh();
    }
    setDuplicating(false);
  }

  async function handleConvertToTemplate() {
    if (!task) return;
    setConverting(true);
    const result = await convertTaskToTemplate(task.id);
    if (result.error) {
      setError(result.error);
    } else {
      onClose();
      if (onTaskUpdated) {
        onTaskUpdated();
      }
      router.refresh();
    }
    setConverting(false);
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
    const result = await updateTaskStatus(taskId, newStatus);

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
      // Notify parent with specific updates
      if (onTaskUpdated) {
        onTaskUpdated(taskId, { status: newStatus });
      }
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

  if (!isOpen) return null;

  const isAssignee = task?.assignee_id === currentUserId;
  const isCreator = task?.creator_id === currentUserId;
  const canUpdateStatus = isAssignee || isCreator;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              {editingTask && canUpdateStatus ? (
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="text-2xl font-semibold text-white bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 w-full mb-2 focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                  placeholder="Task title"
                />
              ) : (
                <h2 className="text-2xl font-semibold text-white mb-2">
                  {loading ? "Loading..." : task?.title}
                </h2>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                    task?.status || "todo"
                  )}`}
                >
                  {task?.status?.replace("_", " ").toUpperCase() || "TODO"}
                </span>
                {task?.priority && (
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(
                      task.priority
                    )}`}
                  >
                    {task.priority.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {canUpdateStatus && !editingTask && (
                <>
                  <button
                    onClick={() => setEditingTask(true)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors"
                    title="Edit Task"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDuplicateTask}
                    disabled={duplicating}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60"
                    title="Duplicate Task"
                  >
                    {duplicating ? "Duplicating..." : "Duplicate"}
                  </button>
                  <button
                    onClick={handleConvertToTemplate}
                    disabled={converting}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-60"
                    title="Convert to Template"
                  >
                    {converting ? "Converting..." : "Template"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-md text-sm font-medium transition-colors border border-red-900/50"
                    title="Delete Task"
                  >
                    Delete
                  </button>
                </>
              )}
              {editingTask && canUpdateStatus && (
                <>
                  <button
                    onClick={handleSaveTask}
                    disabled={savingTask}
                    className="px-3 py-1.5 bg-[#6295ff] hover:bg-[#4b7af0] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {savingTask ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingTask(false);
                      if (task) {
                        setFormData({
                          title: task.title,
                          assignee_id: task.assignee_id || "",
                          priority: (task.priority as any) || "",
                          due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "",
                          estimated_hours: task.estimated_time_minutes ? Math.floor(task.estimated_time_minutes / 60).toString() : "",
                          estimated_minutes: task.estimated_time_minutes ? (task.estimated_time_minutes % 60).toString() : "",
                        });
                      }
                    }}
                    disabled={savingTask}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Status Update */}
          {canUpdateStatus && !loading && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Status:</span>
              <select
                value={task?.status || "todo"}
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-zinc-400">Loading task details...</p>
            </div>
          ) : error ? (
            <div className="bg-red-950/40 border border-red-900 rounded-md px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          ) : task ? (
            <div className="space-y-6">
              {/* Task Info */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-zinc-400">
                      Description
                    </h3>
                    {canUpdateStatus && !editingDescription && (
                      <button
                        onClick={() => setEditingDescription(true)}
                        className="text-xs text-[#6295ff] hover:text-[#4b7af0] transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingDescription && canUpdateStatus ? (
                    <div className="space-y-2">
                      <RichTextEditor
                        value={descriptionValue}
                        onChange={setDescriptionValue}
                        placeholder="Enter task description..."
                        taskId={task.id}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveDescription}
                          disabled={savingDescription}
                          className="px-3 py-1.5 bg-[#6295ff] hover:bg-[#4b7af0] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors"
                        >
                          {savingDescription ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingDescription(false);
                            setDescriptionValue(task.description || "");
                          }}
                          disabled={savingDescription}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <RichTextDisplay
                      content={task.description}
                      className="text-zinc-300"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-1">
                      Assigned to
                    </h3>
                    {editingTask && canUpdateStatus ? (
                      <select
                        value={formData.assignee_id}
                        onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                        disabled={loadingMembers}
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.profile?.full_name || `User ${member.user_id.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-white">
                        {task.assignee?.full_name || "Unassigned"}
                      </p>
                    )}
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
                    {editingTask && canUpdateStatus ? (
                      <input
                        type="datetime-local"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                      />
                    ) : (
                      <p className="text-white">{formatDate(task.due_date)}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-1">
                      Priority
                    </h3>
                    {editingTask && canUpdateStatus ? (
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                      >
                        <option value="">None</option>
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    ) : (
                      <p className="text-white">
                        {task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "Not set"}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-1">
                      Estimated Time
                    </h3>
                    {editingTask && canUpdateStatus ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          value={formData.estimated_hours}
                          onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                          placeholder="Hours"
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                        />
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={formData.estimated_minutes}
                          onChange={(e) => setFormData({ ...formData, estimated_minutes: e.target.value })}
                          placeholder="Minutes"
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                        />
                      </div>
                    ) : (
                      <p className="text-white">
                        {task.estimated_time_minutes
                          ? `${Math.floor(task.estimated_time_minutes / 60)}h ${task.estimated_time_minutes % 60}m`
                          : "Not set"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Time Tracking */}
              <div className="border-t border-zinc-800 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Time Tracking
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TimeTracker
                    taskId={taskId}
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
                      // Notify parent component immediately with optimistic update
                      if (onTaskUpdated) {
                        onTaskUpdated(taskId, { total_tracked_minutes: newTotal });
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
              <div className="border-t border-zinc-800 pt-6">
                <TaskComments
                  taskId={taskId}
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
          ) : null}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full m-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Task</h3>
            <p className="text-zinc-400 mb-6">
              Are you sure you want to delete "{task?.title}"? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteTask}
                className="flex-1 px-4 py-2 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-md font-medium transition-colors border border-red-900/50"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
