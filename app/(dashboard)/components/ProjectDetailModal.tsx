"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getProjectTasks,
  getProjectTimesheet,
  type ProjectWithStats,
  type CreateProjectInput,
} from "../actions/project-actions";
import { updateTaskStatus } from "../actions/task-actions";
import CreateProjectModal from "./CreateProjectModal";
import Link from "next/link";

interface ProjectDetailModalProps {
  project: ProjectWithStats;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: (
    projectId: string,
    input: Partial<CreateProjectInput>
  ) => Promise<boolean>;
  onProjectDeleted: (projectId: string) => Promise<void>;
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

export default function ProjectDetailModal({
  project,
  isOpen,
  onClose,
  onProjectUpdated,
  onProjectDeleted,
}: ProjectDetailModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "tasks" | "timeline" | "timesheet" | "budget"
  >("overview");
  const [tasks, setTasks] = useState<any[]>([]);
  const [timesheetData, setTimesheetData] = useState<any>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingTimesheet, setLoadingTimesheet] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [timesheetStartDate, setTimesheetStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay()); // Start of week
    return date.toISOString().split("T")[0];
  });
  const [timesheetEndDate, setTimesheetEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay() + 6); // End of week
    return date.toISOString().split("T")[0];
  });

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "tasks") {
        loadTasks();
      } else if (activeTab === "timesheet") {
        loadTimesheet();
      }
    }
  }, [isOpen, activeTab]);

  async function loadTasks() {
    setLoadingTasks(true);
    const result = await getProjectTasks(project.id);
    if (result.error) {
      console.error("Error loading tasks:", result.error);
    } else {
      setTasks(result.data || []);
    }
    setLoadingTasks(false);
  }

  async function loadTimesheet() {
    setLoadingTimesheet(true);
    const result = await getProjectTimesheet(
      project.id,
      timesheetStartDate,
      timesheetEndDate
    );
    if (result.error) {
      console.error("Error loading timesheet:", result.error);
    } else {
      setTimesheetData(result.data);
    }
    setLoadingTimesheet(false);
  }

  async function handleTaskStatusChange(taskId: string, newStatus: string) {
    const result = await updateTaskStatus(
      taskId,
      newStatus as "todo" | "in_progress" | "in_review" | "complete"
    );
    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      await loadTasks();
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-zinc-800 flex-shrink-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-semibold text-white">{project.name}</h2>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${
                      project.status === "active"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : project.status === "completed"
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        : project.status === "on_hold"
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        : project.status === "cancelled"
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="text-zinc-400">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Edit
                </button>
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

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-zinc-800">
              {[
                { id: "overview", label: "Overview" },
                { id: "tasks", label: "Tasks" },
                { id: "timeline", label: "Timeline" },
                { id: "timesheet", label: "Timesheet" },
                { id: "budget", label: "Budget" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(tab.id as typeof activeTab)
                  }
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-[#6295ff] text-[#6295ff]"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">Progress</h3>
                    <span className="text-lg font-semibold text-white">
                      {project.progress_percentage || 0}%
                    </span>
                  </div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6295ff] transition-all"
                      style={{ width: `${project.progress_percentage || 0}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="text-zinc-400 text-sm mb-1">Total Tasks</div>
                    <div className="text-2xl font-semibold text-white">
                      {project.task_count || 0}
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="text-zinc-400 text-sm mb-1">Completed</div>
                    <div className="text-2xl font-semibold text-green-400">
                      {project.completed_task_count || 0}
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="text-zinc-400 text-sm mb-1">Time Tracked</div>
                    <div className="text-2xl font-semibold text-white">
                      {project.total_tracked_minutes
                        ? formatTime(project.total_tracked_minutes)
                        : "0h"}
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="text-zinc-400 text-sm mb-1">Total Cost</div>
                    <div className="text-2xl font-semibold text-white">
                      {formatCurrency(project.total_cost || 0)}
                    </div>
                  </div>
                </div>

                {/* Dates */}
                {(project.start_date || project.end_date) && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Timeline</h3>
                    <div className="space-y-2 text-sm">
                      {project.start_date && (
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400">Start:</span>
                          <span className="text-white">
                            {new Date(project.start_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {project.end_date && (
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400">End:</span>
                          <span className="text-white">
                            {new Date(project.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Budget */}
                {project.budget && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">Budget</h3>
                      <span
                        className={`text-lg font-semibold ${
                          (project.total_cost || 0) > project.budget
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {formatCurrency(project.total_cost || 0)} /{" "}
                        {formatCurrency(project.budget)}
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
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
                    <div className="mt-2 text-sm text-zinc-400">
                      {project.budget - (project.total_cost || 0) > 0
                        ? `${formatCurrency(
                            project.budget - (project.total_cost || 0)
                          )} remaining`
                        : "Over budget"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "tasks" && (
              <div>
                {loadingTasks ? (
                  <div className="text-center py-8 text-zinc-400">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400">
                    No tasks linked to this project yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <Link
                              href={`/tasks/${task.id}`}
                              className="text-white font-medium hover:text-[#6295ff] transition-colors"
                            >
                              {task.title}
                            </Link>
                            {task.description && (
                              <p className="text-zinc-400 text-sm mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                                  task.status
                                )}`}
                              >
                                {task.status}
                              </span>
                              {task.assignee && (
                                <span className="text-xs text-zinc-400">
                                  Assigned to: {task.assignee.full_name}
                                </span>
                              )}
                              {task.total_tracked_minutes > 0 && (
                                <span className="text-xs text-zinc-400">
                                  {formatTime(task.total_tracked_minutes)}
                                </span>
                              )}
                            </div>
                          </div>
                          <select
                            value={task.status}
                            onChange={(e) =>
                              handleTaskStatusChange(task.id, e.target.value)
                            }
                            className="ml-4 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                          >
                            <option value="todo">Todo</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="complete">Complete</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "timeline" && (
              <div>
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Project Timeline</h3>
                  {project.start_date && project.end_date ? (
                    <div className="space-y-4">
                      {/* Simple Gantt visualization */}
                      <div className="relative">
                        <div className="h-12 bg-zinc-800 rounded-lg relative overflow-hidden">
                          <div
                            className="absolute h-full bg-[#6295ff] rounded-lg"
                            style={{
                              left: "0%",
                              width: `${project.progress_percentage || 0}%`,
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-between px-4 text-xs text-white">
                            <span>
                              {new Date(project.start_date).toLocaleDateString()}
                            </span>
                            <span>
                              {new Date(project.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Task timeline */}
                      {tasks.length > 0 && (
                        <div className="mt-6 space-y-2">
                          <h4 className="text-sm font-medium text-white mb-3">Tasks</h4>
                          {tasks.map((task) => (
                            <div key={task.id} className="flex items-center gap-3">
                              <div className="w-32 text-sm text-zinc-400 truncate">
                                {task.title}
                              </div>
                              <div className="flex-1 h-6 bg-zinc-800 rounded relative">
                                {task.due_date && (
                                  <div
                                    className={`absolute h-full rounded ${
                                      task.status === "complete"
                                        ? "bg-green-500"
                                        : task.status === "in_progress"
                                        ? "bg-blue-500"
                                        : "bg-zinc-700"
                                    }`}
                                    style={{
                                      width: task.status === "complete" ? "100%" : "50%",
                                    }}
                                  />
                                )}
                              </div>
                              <span className="text-xs text-zinc-400">
                                {task.due_date
                                  ? new Date(task.due_date).toLocaleDateString()
                                  : "No due date"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-400">
                      Set start and end dates to view timeline
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "timesheet" && (
              <div>
                <div className="mb-4 flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={timesheetStartDate}
                      onChange={(e) => {
                        setTimesheetStartDate(e.target.value);
                      }}
                      className="rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={timesheetEndDate}
                      onChange={(e) => {
                        setTimesheetEndDate(e.target.value);
                      }}
                      className="rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff]"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={loadTimesheet}
                      className="px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] text-white rounded-md font-medium transition-colors"
                    >
                      Load
                    </button>
                  </div>
                </div>

                {loadingTimesheet ? (
                  <div className="text-center py-8 text-zinc-400">Loading timesheet...</div>
                ) : timesheetData && timesheetData.tasks.length > 0 ? (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-zinc-800 border-b border-zinc-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                            Task
                          </th>
                          {Array.from(
                            new Set(
                              timesheetData.tasks.flatMap((t: any) =>
                                Object.keys(t.daily_time)
                              )
                            )
                          )
                            .sort()
                            .map((date: string) => (
                              <th
                                key={date}
                                className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase"
                              >
                                {new Date(date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </th>
                            ))}
                          <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-700">
                        {timesheetData.tasks.map((task: any) => (
                          <tr key={task.task_id}>
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{task.task_title}</div>
                              <div className="text-xs text-zinc-400">{task.task_status}</div>
                            </td>
                            {Array.from(
                              new Set(
                                timesheetData.tasks.flatMap((t: any) =>
                                  Object.keys(t.daily_time)
                                )
                              )
                            )
                              .sort()
                              .map((date: string) => (
                                <td key={date} className="px-4 py-3 text-center text-white">
                                  {task.daily_time[date]
                                    ? formatTime(task.daily_time[date])
                                    : "-"}
                                </td>
                              ))}
                            <td className="px-4 py-3 text-right text-white font-medium">
                              {formatTime(task.total_minutes)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-zinc-800/50 border-t-2 border-zinc-700">
                          <td className="px-4 py-3 font-semibold text-white">Total</td>
                          {Array.from(
                            new Set(
                              timesheetData.tasks.flatMap((t: any) =>
                                Object.keys(t.daily_time)
                              )
                            )
                          )
                            .sort()
                            .map((date: string) => {
                              const dayTotal = timesheetData.tasks.reduce(
                                (sum: number, t: any) =>
                                  sum + (t.daily_time[date] || 0),
                                0
                              );
                              return (
                                <td
                                  key={date}
                                  className="px-4 py-3 text-center text-white font-semibold"
                                >
                                  {dayTotal > 0 ? formatTime(dayTotal) : "-"}
                                </td>
                              );
                            })}
                          <td className="px-4 py-3 text-right text-white font-semibold">
                            {formatTime(timesheetData.week_total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-400">
                    No time entries found for this period.
                  </div>
                )}
              </div>
            )}

            {activeTab === "budget" && (
              <div className="space-y-6">
                {project.budget ? (
                  <>
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Budget Overview</h3>
                        <span
                          className={`text-2xl font-semibold ${
                            (project.total_cost || 0) > project.budget
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {formatCurrency(project.total_cost || 0)} /{" "}
                          {formatCurrency(project.budget)}
                        </span>
                      </div>
                      <div className="h-4 bg-zinc-800 rounded-full overflow-hidden mb-4">
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
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-zinc-400 mb-1">Remaining</div>
                          <div
                            className={`text-xl font-semibold ${
                              project.budget - (project.total_cost || 0) > 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {formatCurrency(
                              Math.max(0, project.budget - (project.total_cost || 0))
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-400 mb-1">Utilization</div>
                          <div className="text-xl font-semibold text-white">
                            {Math.round(
                              ((project.total_cost || 0) / project.budget) * 100
                            )}
                            %
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Time Tracked</span>
                          <span className="text-white">
                            {project.total_tracked_minutes
                              ? formatTime(project.total_tracked_minutes)
                              : "0h"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Hourly Rate (default)</span>
                          <span className="text-white">$50.00</span>
                        </div>
                        <div className="pt-3 border-t border-zinc-700 flex items-center justify-between">
                          <span className="text-white font-medium">Total Cost</span>
                          <span className="text-white font-semibold text-lg">
                            {formatCurrency(project.total_cost || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
                    <p className="text-zinc-400 mb-4">
                      No budget set for this project. Set a budget to track costs.
                    </p>
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] text-white rounded-md font-medium transition-colors"
                    >
                      Set Budget
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <CreateProjectModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onProjectCreated={async (input) => {
            const success = await onProjectUpdated(project.id, input);
            if (success) {
              setShowEditModal(false);
            }
            return success;
          }}
          project={{
            name: project.name,
            description: project.description || undefined,
            start_date: project.start_date || undefined,
            end_date: project.end_date || undefined,
            budget: project.budget || undefined,
            status: project.status as CreateProjectInput["status"],
            id: project.id,
          }}
        />
      )}
    </>
  );
}

