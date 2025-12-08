"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTimesheetData, getUserAccountDate, type TimesheetData } from "../actions/timesheet-actions";
import { addManualTimeEntry, stopTimer, deleteTimeEntry } from "../actions/time-actions";
import CreateTaskModal from "../components/CreateTaskModal";
import Calendar from "../components/Calendar";
import { supabaseBrowser } from "@/lib/supabaseClient";

function getWeekDates(date: Date): { start: Date; end: Date; dates: Date[] } {
  const dateCopy = new Date(date);
  const day = dateCopy.getDay();
  const diff = dateCopy.getDate() - day; // Sunday is 0
  const start = new Date(dateCopy);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  
  return { start, end, dates };
}

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function formatWeekRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatTime(minutes: number): string {
  if (minutes === 0) return "0h";
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

function getStatusColor(status: string): string {
  switch (status) {
    case "complete":
      return "bg-green-500";
    case "in_progress":
      return "bg-blue-500";
    case "in_review":
      return "bg-yellow-500";
    default:
      return "bg-zinc-500";
  }
}

export default function TimesheetPage() {
  const router = useRouter();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [timesheetData, setTimesheetData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountDate, setAccountDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"timesheet" | "entries">("timesheet");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingCell, setEditingCell] = useState<{ taskId: string; date: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [runningTimers, setRunningTimers] = useState<{ [taskId: string]: { startTime: string; elapsed: number } }>({});
  const [contextMenu, setContextMenu] = useState<{ taskId: string; date: string; x: number; y: number } | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const weekDates = getWeekDates(new Date(currentWeek));
  const startDateStr = weekDates.start.toISOString().split('T')[0];
  const endDateStr = weekDates.end.toISOString().split('T')[0];

  useEffect(() => {
    loadAccountDate();
    loadTimesheetData();
    loadRunningTimers();
  }, [currentWeek]);

  useEffect(() => {
    // Update running timers every second
    const interval = setInterval(() => {
      setRunningTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(taskId => {
          const start = new Date(updated[taskId].startTime).getTime();
          const now = Date.now();
          updated[taskId].elapsed = Math.floor((now - start) / 1000);
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close calendar when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar]);

  async function loadRunningTimers() {
    const timers: { [taskId: string]: { startTime: string; elapsed: number } } = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_')) {
        const taskId = key.replace('timer_', '');
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const { startTime } = JSON.parse(data);
            const start = new Date(startTime).getTime();
            const now = Date.now();
            timers[taskId] = {
              startTime,
              elapsed: Math.floor((now - start) / 1000),
            };
          } catch (e) {
            // Invalid data
          }
        }
      }
    }
    setRunningTimers(timers);
  }

  async function loadAccountDate() {
    const result = await getUserAccountDate();
    if (result.data) {
      setAccountDate(new Date(result.data));
    }
  }

  async function loadTimesheetData() {
    setLoading(true);
    const result = await getTimesheetData(startDateStr, endDateStr);
    if (result.error) {
      console.error('Error loading timesheet:', result.error);
      setLoading(false);
      return;
    }
    setTimesheetData(result.data || null);
    setLoading(false);
  }

  function handlePreviousWeek() {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  }

  function handleNextWeek() {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    // Don't allow future weeks beyond today
    if (newDate <= new Date()) {
      setCurrentWeek(newDate);
    }
  }

  function handleCalendarDateSelect(date: Date) {
    setCurrentWeek(date);
    setShowCalendar(false);
  }

  async function handleStartTimer(taskId: string) {
    const startTime = new Date().toISOString();
    setRunningTimers(prev => ({
      ...prev,
      [taskId]: { startTime, elapsed: 0 },
    }));
    localStorage.setItem(`timer_${taskId}`, JSON.stringify({ startTime, taskId }));
  }

  async function handleStopTimer(taskId: string) {
    const timer = runningTimers[taskId];
    if (!timer) return;

    // Calculate minutes - server will enforce minimum 1 minute
    const startTime = new Date(timer.startTime);
    const endTime = new Date();
    const calculatedMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    // Enforce minimum 1 minute on client side too
    const minutes = calculatedMinutes < 1 ? 1 : calculatedMinutes;

    const result = await stopTimer(taskId, timer.startTime);
    if (!result.error) {
      const newTimers = { ...runningTimers };
      delete newTimers[taskId];
      setRunningTimers(newTimers);
      localStorage.removeItem(`timer_${taskId}`);
      await loadTimesheetData();
    } else {
      console.error('Error stopping timer:', result.error);
      alert(result.error);
    }
  }

  function handleCellClick(e: React.MouseEvent, taskId: string, date: string) {
    // Right-click for context menu
    if (e.button === 2) {
      e.preventDefault();
      const task = timesheetData?.tasks.find(t => t.task_id === taskId);
      const minutes = task?.daily_time[date] || 0;
      if (minutes > 0) {
        setContextMenu({ taskId, date, x: e.clientX, y: e.clientY });
      }
      return;
    }
    
    // Left-click for editing
    const task = timesheetData?.tasks.find(t => t.task_id === taskId);
    const minutes = task?.daily_time[date] || 0;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    setEditValue(hours > 0 || mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : "");
    setEditingCell({ taskId, date });
  }

  async function handleDeleteTimeForDay(taskId: string, date: string) {
    if (!confirm("Are you sure you want to delete all time entries for this day?")) {
      return;
    }

    // Fetch time entries for this task to delete ones matching the date
    const { data: { user } } = await supabaseBrowser.auth.getUser();
    if (!user) return;

    // Get all time entries for this task
    const { data: timeEntries } = await supabaseBrowser
      .from('time_entries')
      .select('id, started_at, created_at')
      .eq('task_id', taskId)
      .eq('user_id', user.id);

    if (!timeEntries || timeEntries.length === 0) return;

    // Filter entries that match the date
    const dateStart = new Date(date + 'T00:00:00');
    const dateEnd = new Date(date + 'T23:59:59');
    
    const entriesToDelete = timeEntries.filter((entry: any) => {
      // Check if entry date matches the target date
      const entryDate = entry.started_at 
        ? new Date(entry.started_at)
        : new Date(entry.created_at);
      return entryDate >= dateStart && entryDate <= dateEnd;
    });

    // Delete each matching entry
    for (const entry of entriesToDelete) {
      const result = await deleteTimeEntry(entry.id);
      if (result.error) {
        console.error('Error deleting time entry:', result.error);
        alert(result.error);
        break;
      }
    }

    setContextMenu(null);
    await loadTimesheetData();
  }

  async function handleCellSave() {
    if (!editingCell) return;
    
    const [hoursStr, minsStr] = editValue.split(':');
    const hours = parseInt(hoursStr) || 0;
    const minutes = parseInt(minsStr) || 0;
    let totalMinutes = hours * 60 + minutes;

    if (totalMinutes < 0) {
      alert("Time cannot be negative");
      return;
    }

    // Enforce minimum 1 minute if time is entered (0 is allowed to delete all time)
    if (totalMinutes > 0 && totalMinutes < 1) {
      totalMinutes = 1;
    }

    // Get current time for this day
    const task = timesheetData?.tasks.find(t => t.task_id === editingCell.taskId);
    const currentMinutes = task?.daily_time[editingCell.date] || 0;
    const difference = totalMinutes - currentMinutes;

    if (difference !== 0) {
      if (difference < 0) {
        // User wants to reduce time - delete entries for this day and re-add if needed
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (user) {
          const dateStart = new Date(editingCell.date + 'T00:00:00');
          const dateEnd = new Date(editingCell.date + 'T23:59:59');
          
          const { data: timeEntries } = await supabaseBrowser
            .from('time_entries')
            .select('id, started_at, created_at')
            .eq('task_id', editingCell.taskId)
            .eq('user_id', user.id);

          if (timeEntries) {
            // Filter entries for this specific date
            const entriesToDelete = timeEntries.filter((entry: any) => {
              const entryDate = entry.started_at 
                ? new Date(entry.started_at)
                : new Date(entry.created_at);
              return entryDate >= dateStart && entryDate <= dateEnd;
            });

            // Delete entries for this day
            for (const entry of entriesToDelete) {
              await deleteTimeEntry(entry.id);
            }
          }

          // If new amount is > 0, add it
          if (totalMinutes > 0) {
            const result = await addManualTimeEntry({
              task_id: editingCell.taskId,
              minutes: totalMinutes,
              description: `Timesheet entry for ${editingCell.date}`,
            });

            if (result.error) {
              console.error('Error saving time entry:', result.error);
              alert(result.error);
            }
          }
        }
      } else {
        // Add time entry
        const result = await addManualTimeEntry({
          task_id: editingCell.taskId,
          minutes: difference,
          description: `Timesheet entry for ${editingCell.date}`,
        });

        if (result.error) {
          console.error('Error saving time entry:', result.error);
          alert(result.error);
        }
      }

      // Reload data
      await loadTimesheetData();
    }

    setEditingCell(null);
    setEditValue("");
  }

  function handleCellCancel() {
    setEditingCell(null);
    setEditValue("");
  }

  if (loading && !timesheetData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-400">Loading timesheet...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with Week Navigation */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePreviousWeek}
              className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
              disabled={accountDate ? weekDates.start <= accountDate : false}
            >
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="relative" ref={calendarRef}>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="text-xl font-semibold text-white min-w-[200px] text-center hover:text-[#6295ff] transition-colors"
              >
                {formatWeekRange(weekDates.start, weekDates.end)} ▼
              </button>
              {showCalendar && (
                <Calendar
                  selectedDate={currentWeek}
                  onDateSelect={handleCalendarDateSelect}
                  minDate={accountDate || undefined}
                  maxDate={new Date()}
                  onClose={() => setShowCalendar(false)}
                />
              )}
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
              disabled={weekDates.end >= new Date()}
            >
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors">
              $ Billable status
            </button>
            <button className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors">
              Tag
            </button>
            <button className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors">
              Tracked time
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab("timesheet")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "timesheet"
                ? "text-white border-b-2 border-[#6295ff]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Timesheet
          </button>
          <button
            onClick={() => setActiveTab("entries")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "entries"
                ? "text-white border-b-2 border-[#6295ff]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Time entries
          </button>
        </div>
      </div>

      {activeTab === "timesheet" ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[300px_repeat(7,1fr)_120px] gap-0 bg-zinc-800 border-b border-zinc-700">
            <div className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">
              Task / Location
            </div>
            {weekDates.dates.map((date, idx) => {
              const dayTotal = timesheetData?.daily_totals[date.toISOString().split('T')[0]] || 0;
              const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx];
              return (
                <div key={idx} className="px-4 py-3 text-sm font-medium text-zinc-400 text-center border-l border-zinc-700">
                  <div>{dayName}, {formatDate(date)}</div>
                  <div className="text-xs text-zinc-500 mt-1">({formatTime(dayTotal)})</div>
                </div>
              );
            })}
            <div className="px-4 py-3 text-sm font-medium text-zinc-400 text-center border-l border-zinc-700">
              Total ({formatTime(timesheetData?.week_total || 0)})
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-zinc-800">
            {timesheetData?.tasks.map((task) => (
              <div
                key={task.task_id}
                className="grid grid-cols-[300px_repeat(7,1fr)_120px] gap-0 hover:bg-zinc-800/50 transition-colors"
              >
                {/* Task / Location Column */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(task.task_status)}`}></div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/tasks/${task.task_id}`}
                      className="text-white font-medium truncate hover:text-[#6295ff] transition-colors text-left w-full block"
                    >
                      {task.task_title}
                    </Link>
                    <div className="text-xs text-zinc-500 truncate">
                      StudioDirection workspace
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (runningTimers[task.task_id]) {
                        handleStopTimer(task.task_id);
                      } else {
                        handleStartTimer(task.task_id);
                      }
                    }}
                    className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
                    title={runningTimers[task.task_id] ? "Stop timer" : "Start timer"}
                  >
                    {runningTimers[task.task_id] ? (
                      <div className="relative">
                        <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5.5 3.5A1.5 1.5 0 017 2h6a1.5 1.5 0 011.5 1.5v13a1.5 1.5 0 01-1.5 1.5H7a1.5 1.5 0 01-1.5-1.5v-13z" />
                        </svg>
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                      </div>
                    ) : (
                      <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    )}
                  </button>
                  <button className="p-1.5 hover:bg-zinc-700 rounded transition-colors">
                    <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </div>

                {/* Day Columns */}
                {weekDates.dates.map((date, idx) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const minutes = task.daily_time[dateStr] || 0;
                  const isEditing = editingCell?.taskId === task.task_id && editingCell?.date === dateStr;

                  return (
                    <div
                      key={idx}
                      className="px-4 py-3 text-center border-l border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors"
                      onClick={(e) => handleCellClick(e, task.task_id, dateStr)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleCellClick(e, task.task_id, dateStr);
                      }}
                    >
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave();
                              if (e.key === 'Escape') handleCellCancel();
                            }}
                            className="w-16 px-2 py-1 bg-zinc-800 border border-[#6295ff] text-white text-sm rounded focus:outline-none"
                            placeholder="0:00"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="text-zinc-300 text-sm">
                          {runningTimers[task.task_id] && dateStr === new Date().toISOString().split('T')[0]
                            ? formatTime(minutes + Math.floor(runningTimers[task.task_id].elapsed / 60))
                            : formatTime(minutes)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total Column */}
                <div className="px-4 py-3 text-center border-l border-zinc-700">
                  <div className="text-white font-medium text-sm">
                    {formatTime(task.total_minutes)}
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {(!timesheetData?.tasks || timesheetData.tasks.length === 0) && (
              <div className="px-4 py-12 text-center text-zinc-500">
                No tasks assigned to you. Click "+ Add task" to create a new task.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <p className="text-zinc-400">Time entries list view - Coming soon</p>
        </div>
      )}

      {/* Add Task Button */}
      <div className="mt-6">
        <button
          onClick={() => setShowCreateTask(true)}
          className="px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] text-white rounded-md font-medium transition-colors"
        >
          + Add task
        </button>
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          isOpen={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          onTaskCreated={() => {
            setShowCreateTask(false);
            loadTimesheetData();
          }}
        />
      )}


      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 min-w-[150px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            <button
              onClick={() => {
                handleDeleteTimeForDay(contextMenu.taskId, contextMenu.date);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete time
            </button>
          </div>
        </>
      )}
    </div>
  );
}

