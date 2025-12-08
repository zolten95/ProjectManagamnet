"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAllTasks, getTeamMembers, bulkUpdateTasks, type GetAllTasksFilters, type TaskWithMetadata, type TeamMember } from "../actions/task-actions";
import { supabaseBrowser } from "@/lib/supabaseClient";

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

export default function AllTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithMetadata[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState<GetAllTasksFilters>({
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [dueDateFrom, setDueDateFrom] = useState<string>("");
  const [dueDateTo, setDueDateTo] = useState<string>("");

  useEffect(() => {
    loadTeamMembers();
    loadTasks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tasks, searchQuery, statusFilter, assigneeFilter, priorityFilter, dueDateFrom, dueDateTo, filters.sort_by, filters.sort_order]);

  async function loadTeamMembers() {
    const result = await getTeamMembers();
    if (result.data) {
      setTeamMembers(result.data);
    }
  }

  async function loadTasks() {
    setLoading(true);
    
    // Load all tasks without filters (we'll filter client-side)
    const result = await getAllTasks({
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    
    if (result.error) {
      console.error("Error loading tasks:", result.error);
      setLoading(false);
      return;
    }
    
    setTasks(result.data || []);
    setLoading(false);
  }

  function applyFilters() {
    let filtered = [...tasks];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          (task.description && task.description.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    // Apply assignee filter
    if (assigneeFilter) {
      filtered = filtered.filter((task) => task.assignee_id === assigneeFilter);
    }

    // Apply priority filter
    if (priorityFilter) {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    // Apply due date filters
    if (dueDateFrom) {
      filtered = filtered.filter(
        (task) => task.due_date && task.due_date >= dueDateFrom
      );
    }

    if (dueDateTo) {
      filtered = filtered.filter(
        (task) => task.due_date && task.due_date <= dueDateTo
      );
    }

    // Apply sorting
    const sortBy = filters.sort_by || 'created_at';
    const sortOrder = filters.sort_order || 'desc';

    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        case 'assignee':
          aValue = a.assignee?.full_name || '';
          bValue = b.assignee?.full_name || '';
          break;
        default: // created_at
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    setFilteredTasks(filtered);
  }

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedTasks(new Set(filteredTasks.map((t) => t.id)));
    } else {
      setSelectedTasks(new Set());
    }
  }

  function handleSelectTask(taskId: string) {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  }

  async function handleBulkStatusChange(newStatus: string) {
    if (selectedTasks.size === 0) return;

    setBulkActionLoading(true);
    const result = await bulkUpdateTasks(Array.from(selectedTasks), {
      status: newStatus,
    });

    if (result.error) {
      alert(`Error: ${result.error}`);
      setBulkActionLoading(false);
      return;
    }

    setSelectedTasks(new Set());
    setShowBulkActions(false);
    await loadTasks();
    setBulkActionLoading(false);
  }

  async function handleBulkAssign(newAssigneeId: string) {
    if (selectedTasks.size === 0) return;

    setBulkActionLoading(true);
    const result = await bulkUpdateTasks(Array.from(selectedTasks), {
      assignee_id: newAssigneeId,
    });

    if (result.error) {
      alert(`Error: ${result.error}`);
      setBulkActionLoading(false);
      return;
    }

    setSelectedTasks(new Set());
    setShowBulkActions(false);
    await loadTasks();
    setBulkActionLoading(false);
  }

  function exportToCSV() {
    const headers = [
      "Title",
      "Status",
      "Assignee",
      "Priority",
      "Due Date",
      "Estimated Time",
      "Tracked Time",
      "Comments",
      "Created At",
    ];

    const rows = filteredTasks.map((task) => [
      task.title,
      task.status,
      task.assignee?.full_name || "Unassigned",
      task.priority || "normal",
      task.due_date ? new Date(task.due_date).toLocaleDateString() : "",
      task.estimated_time_minutes
        ? formatTime(task.estimated_time_minutes)
        : "",
      task.total_tracked_minutes
        ? formatTime(task.total_tracked_minutes)
        : "0h",
      task.comment_count?.toString() || "0",
      new Date(task.created_at).toLocaleDateString(),
    ]);

    const csvContent =
      headers.join(",") +
      "\n" +
      rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tasks-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportToPDF() {
    // Simple PDF export using window.print() - can be enhanced with a library later
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tasks Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            @media print { @page { margin: 1cm; } }
          </style>
        </head>
        <body>
          <h1>All Tasks - ${new Date().toLocaleDateString()}</h1>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Estimated</th>
                <th>Tracked</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTasks
                .map(
                  (task) => `
                <tr>
                  <td>${task.title}</td>
                  <td>${task.status}</td>
                  <td>${task.assignee?.full_name || "Unassigned"}</td>
                  <td>${task.priority || "normal"}</td>
                  <td>${
                    task.due_date
                      ? new Date(task.due_date).toLocaleDateString()
                      : ""
                  }</td>
                  <td>${
                    task.estimated_time_minutes
                      ? formatTime(task.estimated_time_minutes)
                      : ""
                  }</td>
                  <td>${
                    task.total_tracked_minutes
                      ? formatTime(task.total_tracked_minutes)
                      : "0h"
                  }</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }

  useEffect(() => {
    setShowBulkActions(selectedTasks.size > 0);
  }, [selectedTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-400">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">All Tasks</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md text-sm font-medium transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md text-sm font-medium transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            >
              <option value="">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Assignee
            </label>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            >
              <option value="">All Assignees</option>
              {teamMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.profile?.full_name || "Unknown"}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Due Date From */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Due Date From
            </label>
            <input
              type="date"
              value={dueDateFrom}
              onChange={(e) => setDueDateFrom(e.target.value)}
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            />
          </div>

          {/* Due Date To */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Due Date To
            </label>
            <input
              type="date"
              value={dueDateTo}
              onChange={(e) => setDueDateTo(e.target.value)}
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Sort By
            </label>
            <select
              value={filters.sort_by}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  sort_by: e.target.value as GetAllTasksFilters["sort_by"],
                })
              }
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            >
              <option value="created_at">Date Created</option>
              <option value="priority">Priority</option>
              <option value="due_date">Due Date</option>
              <option value="assignee">Assignee</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Order
            </label>
            <select
              value={filters.sort_order}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  sort_order: e.target.value as "asc" | "desc",
                })
              }
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#6295ff] text-sm"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchQuery ||
          statusFilter ||
          assigneeFilter ||
          priorityFilter ||
          dueDateFrom ||
          dueDateTo) && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("");
                setAssigneeFilter("");
                setPriorityFilter("");
                setDueDateFrom("");
                setDueDateTo("");
              }}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="bg-[#6295ff]/20 border border-[#6295ff]/30 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-white font-medium">
              {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusChange(e.target.value);
                    e.target.value = "";
                  }
                }}
                disabled={bulkActionLoading}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[#6295ff] disabled:opacity-60"
              >
                <option value="">Change Status...</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="complete">Complete</option>
              </select>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAssign(e.target.value);
                    e.target.value = "";
                  }
                }}
                disabled={bulkActionLoading}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-[#6295ff] disabled:opacity-60"
              >
                <option value="">Assign To...</option>
                <option value="">Unassign</option>
                {teamMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.profile?.full_name || "Unknown"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedTasks(new Set());
              setShowBulkActions(false);
            }}
            className="text-zinc-400 hover:text-white transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800 border-b border-zinc-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      filteredTasks.length > 0 &&
                      selectedTasks.size === filteredTasks.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-zinc-600 text-[#6295ff] focus:ring-[#6295ff]"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Assignee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Comments
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-zinc-400"
                  >
                    No tasks found
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task.id)}
                        onChange={() => handleSelectTask(task.id)}
                        className="rounded border-zinc-600 text-[#6295ff] focus:ring-[#6295ff]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-white font-medium hover:text-[#6295ff] transition-colors"
                      >
                        {task.title}
                      </Link>
                      {task.description && (
                        <div className="text-zinc-400 text-sm mt-1 line-clamp-1">
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-sm">
                      {task.assignee?.full_name || (
                        <span className="text-zinc-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(
                          task.priority
                        )}`}
                      >
                        {task.priority || "normal"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {task.estimated_time_minutes ? (
                        <div>
                          <div>
                            {formatTime(task.total_tracked_minutes || 0)} /{" "}
                            {formatTime(task.estimated_time_minutes)}
                          </div>
                        </div>
                      ) : task.total_tracked_minutes ? (
                        formatTime(task.total_tracked_minutes)
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.comment_count && task.comment_count > 0 ? (
                        <span className="bg-zinc-700 text-zinc-300 text-xs px-1.5 py-0.5 rounded">
                          {task.comment_count}
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Count */}
      <div className="mt-4 text-sm text-zinc-400">
        Showing {filteredTasks.length} of {tasks.length} task
        {tasks.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
