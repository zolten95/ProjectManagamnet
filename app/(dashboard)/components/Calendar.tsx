"use client";

import { useState } from "react";

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  onClose: () => void;
}

export default function Calendar({
  selectedDate,
  onDateSelect,
  minDate,
  maxDate = new Date(),
  onClose,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function getDaysInMonth(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add days from previous month to fill first week
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push(prevDate);
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    // Add days from next month to fill last week
    const remaining = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remaining; day++) {
      days.push(new Date(year, month + 1, day));
    }

    return days;
  }

  function isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  function isInWeek(date: Date, weekStart: Date): boolean {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return date >= weekStart && date <= weekEnd;
  }

  function getWeekStart(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day;
    const weekStart = new Date(date.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  function isDateDisabled(date: Date): boolean {
    if (minDate && date < minDate) return true;
    if (date > maxDate) return true;
    return false;
  }

  function handleDateClick(date: Date) {
    if (isDateDisabled(date)) return;
    onDateSelect(date);
    onClose();
  }

  function handlePreviousMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (nextMonth <= maxDate) {
      setCurrentMonth(nextMonth);
    }
  }

  const days = getDaysInMonth(currentMonth);
  const selectedWeekStart = getWeekStart(selectedDate);

  return (
    <div className="absolute top-full left-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 p-4 min-w-[320px]">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePreviousMonth}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          disabled={minDate ? currentMonth <= new Date(minDate.getFullYear(), minDate.getMonth(), 1) : false}
        >
          <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-white font-semibold">
          {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          disabled={currentMonth.getMonth() >= maxDate.getMonth() && currentMonth.getFullYear() >= maxDate.getFullYear()}
        >
          <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-zinc-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, idx) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isSelected = isSameDay(date, selectedDate);
          const isInSelectedWeek = isInWeek(date, selectedWeekStart);
          const isDisabled = isDateDisabled(date);
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(date)}
              disabled={isDisabled}
              className={`
                aspect-square p-2 text-sm rounded transition-colors
                ${!isCurrentMonth ? "text-zinc-600" : "text-zinc-300"}
                ${isDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-zinc-800 cursor-pointer"}
                ${isInSelectedWeek && isCurrentMonth ? "bg-blue-500/20" : ""}
                ${isSelected ? "bg-[#6295ff] text-white font-semibold" : ""}
                ${isToday && !isSelected ? "ring-2 ring-[#6295ff] ring-offset-2 ring-offset-zinc-900" : ""}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

