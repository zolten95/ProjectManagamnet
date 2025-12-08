"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
  type CreateProjectInput,
  type ProjectWithStats,
} from "../actions/project-actions";
import CreateProjectModal from "../components/CreateProjectModal";
import ProjectDetailModal from "../components/ProjectDetailModal";

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "completed":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "on_hold":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "cancelled":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const result = await getAllProjects();
    if (result.error) {
      console.error("Error loading projects:", result.error);
    } else {
      setProjects(result.data || []);
    }
    setLoading(false);
  }

  async function handleCreateProject(input: CreateProjectInput) {
    const result = await createProject(input);
    if (result.error) {
      alert(`Error: ${result.error}`);
      return false;
    }
    await loadProjects();
    return true;
  }

  async function handleUpdateProject(projectId: string, input: Partial<CreateProjectInput>) {
    const result = await updateProject(projectId, input);
    if (result.error) {
      alert(`Error: ${result.error}`);
      return false;
    }
    await loadProjects();
    if (selectedProject?.id === projectId) {
      setSelectedProject(result.data as ProjectWithStats);
    }
    return true;
  }

  async function handleDeleteProject(projectId: string) {
    if (!confirm("Are you sure you want to delete this project? This will unlink all associated tasks.")) {
      return;
    }
    const result = await deleteProject(projectId);
    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      await loadProjects();
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">Projects</h2>
          <p className="text-zinc-400">
            Manage projects, track progress, and monitor budgets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === "grid"
                  ? "bg-[#6295ff] text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-[#6295ff] text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-zinc-400 mb-6">
            Create your first project to start organizing tasks and tracking progress
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-[#6295ff] hover:bg-[#4b7af0] text-white rounded-lg font-medium transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors cursor-pointer"
              onClick={() => setSelectedProject(project)}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                    project.status
                  )}`}
                >
                  {project.status}
                </span>
              </div>

              {project.description && (
                <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="space-y-3">
                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">Progress</span>
                    <span className="text-xs font-medium text-white">
                      {project.progress_percentage || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6295ff] transition-all"
                      style={{ width: `${project.progress_percentage || 0}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-zinc-400 text-xs mb-1">Tasks</div>
                    <div className="text-white font-medium">
                      {project.completed_task_count || 0} / {project.task_count || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-400 text-xs mb-1">Time</div>
                    <div className="text-white font-medium">
                      {project.total_tracked_minutes
                        ? formatTime(project.total_tracked_minutes)
                        : "0h"}
                    </div>
                  </div>
                </div>

                {/* Budget */}
                {project.budget && (
                  <div className="pt-3 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Budget</span>
                      <span className="text-sm font-medium text-white">
                        {formatCurrency(project.total_cost || 0)} /{" "}
                        {formatCurrency(project.budget)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full transition-all ${
                          (project.total_cost || 0) > project.budget
                            ? "bg-red-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            ((project.total_cost || 0) / project.budget) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Dates */}
                {(project.start_date || project.end_date) && (
                  <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                    {project.start_date && (
                      <div>
                        Start: {new Date(project.start_date).toLocaleDateString()}
                      </div>
                    )}
                    {project.end_date && (
                      <div>
                        End: {new Date(project.end_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-zinc-800/30 cursor-pointer"
                  onClick={() => setSelectedProject(project)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-white font-medium">{project.name}</div>
                      {project.description && (
                        <div className="text-zinc-400 text-sm mt-1 line-clamp-1">
                          {project.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                        project.status
                      )}`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#6295ff] transition-all"
                          style={{ width: `${project.progress_percentage || 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-white">
                        {project.progress_percentage || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white">
                    {project.completed_task_count || 0} / {project.task_count || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-white">
                    {project.total_tracked_minutes
                      ? formatTime(project.total_tracked_minutes)
                      : "0h"}
                  </td>
                  <td className="px-6 py-4">
                    {project.budget ? (
                      <div className="text-sm">
                        <div className="text-white">
                          {formatCurrency(project.total_cost || 0)} /{" "}
                          {formatCurrency(project.budget)}
                        </div>
                        <div
                          className={`text-xs mt-1 ${
                            (project.total_cost || 0) > project.budget
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {project.budget - (project.total_cost || 0) > 0
                            ? `${formatCurrency(project.budget - (project.total_cost || 0))} remaining`
                            : "Over budget"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-sm">No budget</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleCreateProject}
        />
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          onProjectUpdated={handleUpdateProject}
          onProjectDeleted={handleDeleteProject}
        />
      )}
    </div>
  );
}
