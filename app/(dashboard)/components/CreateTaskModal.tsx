"use client";

import { useState, useEffect } from "react";
import { createTask, getTeamMembers, type CreateTaskInput, type TeamMember } from "../actions/task-actions";
import { getAllProjects, type ProjectWithStats } from "../actions/project-actions";
import RichTextEditor from "./RichTextEditor";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [formData, setFormData] = useState<CreateTaskInput>({
    title: "",
    description: "",
    assignee_id: "",
    estimated_time_minutes: undefined,
    priority: undefined,
    due_date: undefined,
    project_id: undefined,
  });
  const [estimatedHours, setEstimatedHours] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadTeamMembers();
      loadProjects();
    }
  }, [isOpen]);

  async function loadTeamMembers() {
    setLoadingMembers(true);
    setError(null);
    const result = await getTeamMembers();
    if (result.error) {
      console.error('Error loading team members:', result.error);
      setError(result.error);
    } else {
      console.log('Team members loaded:', result.data);
      // TypeScript knows the type from the function signature
      setTeamMembers((result.data || []) as TeamMember[]);
    }
    setLoadingMembers(false);
  }

  async function loadProjects() {
    setLoadingProjects(true);
    const result = await getAllProjects();
    if (result.error) {
      console.error('Error loading projects:', result.error);
    } else {
      setProjects(result.data || []);
    }
    setLoadingProjects(false);
  }

  function handleClose() {
    setFormData({
      title: "",
      description: "",
      assignee_id: "",
      estimated_time_minutes: undefined,
      priority: undefined,
      due_date: undefined,
      project_id: undefined,
    });
    setEstimatedHours("");
    setEstimatedMinutes("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    // Calculate estimated_time_minutes from hours and minutes
    const hours = parseInt(estimatedHours) || 0;
    const minutes = parseInt(estimatedMinutes) || 0;
    const totalMinutes = hours * 60 + minutes;

    const submitData: CreateTaskInput = {
      ...formData,
      estimated_time_minutes: totalMinutes > 0 ? totalMinutes : undefined,
    };

    const result = await createTask(submitData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      handleClose();
      if (onTaskCreated) {
        onTaskCreated();
      }
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Create New Task</h2>
            <button
              onClick={handleClose}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-950/40 border border-red-900 rounded-md px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Description
            </label>
            <RichTextEditor
              value={formData.description || ""}
              onChange={(value) =>
                setFormData({ ...formData, description: value })
              }
              placeholder="Enter task description (optional)"
              taskId={undefined}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Assign to <span className="text-red-400">*</span>
            </label>
            {loadingMembers ? (
              <div className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400">
                Loading team members...
              </div>
            ) : (
              <select
                required
                value={formData.assignee_id}
                onChange={(e) =>
                  setFormData({ ...formData, assignee_id: e.target.value })
                }
                className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
              >
                <option value="">Select a team member</option>
                {teamMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.profile?.full_name || `User ${member.user_id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Project (optional)
            </label>
            {loadingProjects ? (
              <div className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400">
                Loading projects...
              </div>
            ) : (
              <select
                value={formData.project_id || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    project_id: e.target.value || undefined,
                  })
                }
                className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Estimated Time
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="Hours"
                  className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                />
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  placeholder="Minutes"
                  className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Priority
              </label>
              <select
                value={formData.priority || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as CreateTaskInput["priority"] || undefined,
                  })
                }
                className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
              >
                <option value="">Select priority</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Due Date
            </label>
            <input
              type="datetime-local"
              value={formData.due_date || ""}
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value || undefined })
              }
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] disabled:opacity-60 text-white rounded-md font-medium transition-colors"
            >
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
