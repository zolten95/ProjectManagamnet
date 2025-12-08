'use server';

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

const STUDIO_DIRECTION_TEAM_ID = "92e8f38d-5161-4d70-bbdd-772d23cc7373";

export interface CreateProjectInput {
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
}

export interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  status: string;
  team_id: string;
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_task_count?: number;
  total_tracked_minutes?: number;
  total_cost?: number;
  progress_percentage?: number;
}

export async function createProject(input: CreateProjectInput) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      team_id: STUDIO_DIRECTION_TEAM_ID,
      name: input.name,
      description: input.description || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      budget: input.budget || null,
      status: input.status || 'planning',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    return { error: error.message };
  }

  revalidatePath('/projects');
  return { data };
}

export async function updateProject(projectId: string, input: Partial<CreateProjectInput>) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('projects')
    .update({
      name: input.name,
      description: input.description,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      budget: input.budget || null,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    return { error: error.message };
  }

  revalidatePath('/projects');
  revalidatePath(`/projects/${projectId}`);
  return { data };
}

export async function deleteProject(projectId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID);

  if (error) {
    console.error('Error deleting project:', error);
    return { error: error.message };
  }

  revalidatePath('/projects');
  return { success: true };
}

export async function getAllProjects(): Promise<{ data?: ProjectWithStats[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data: projectsData, error } = await supabase
    .from('projects')
    .select('*')
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return { error: error.message };
  }

  // Enrich projects with statistics
  const projectsWithStats = await Promise.all(
    (projectsData || []).map(async (project: any) => {
      // Get task count and completed task count
      const { data: tasks, count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: false })
        .eq('project_id', project.id);

      const completedTaskCount = tasks?.filter((t: any) => t.status === 'complete').length || 0;
      const totalTasks = taskCount || 0;
      const progressPercentage = totalTasks > 0 ? Math.round((completedTaskCount / totalTasks) * 100) : 0;

      // Get total tracked time for all tasks in this project
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('minutes')
        .in('task_id', tasks?.map((t: any) => t.id) || []);

      const totalTrackedMinutes = timeEntries?.reduce((sum: number, entry: any) => sum + entry.minutes, 0) || 0;

      // Calculate cost (assuming average hourly rate of $50 - this could be configurable)
      // For now, we'll use a simple calculation
      const hourlyRate = 50; // Default hourly rate
      const totalCost = (totalTrackedMinutes / 60) * hourlyRate;

      return {
        ...project,
        task_count: totalTasks,
        completed_task_count: completedTaskCount,
        total_tracked_minutes: totalTrackedMinutes,
        total_cost: totalCost,
        progress_percentage: progressPercentage,
      };
    })
  );

  return { data: projectsWithStats };
}

export async function getProjectById(projectId: string): Promise<{ data?: ProjectWithStats; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return { error: error.message };
  }

  // Get task count and completed task count
  const { data: tasks, count: taskCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: false })
    .eq('project_id', projectId);

  const completedTaskCount = tasks?.filter((t: any) => t.status === 'complete').length || 0;
  const totalTasks = taskCount || 0;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTaskCount / totalTasks) * 100) : 0;

  // Get total tracked time
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('minutes')
    .in('task_id', tasks?.map((t: any) => t.id) || []);

  const totalTrackedMinutes = timeEntries?.reduce((sum: number, entry: any) => sum + entry.minutes, 0) || 0;

  // Calculate cost
  const hourlyRate = 50; // Default hourly rate
  const totalCost = (totalTrackedMinutes / 60) * hourlyRate;

  const projectWithStats = {
    ...project,
    task_count: totalTasks,
    completed_task_count: completedTaskCount,
    total_tracked_minutes: totalTrackedMinutes,
    total_cost: totalCost,
    progress_percentage: progressPercentage,
  };

  return { data: projectWithStats };
}

export async function getProjectTasks(projectId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching project tasks:', error);
    return { error: error.message };
  }

  // Enrich tasks with metadata (profiles and time tracking)
  const tasksWithMetadata = await Promise.all(
    (tasks || []).map(async (task: any) => {
      // Get assignee profile
      let assignee = null;
      if (task.assignee_id) {
        const { data: assigneeData } = await supabase
          .from('profiles')
          .select('full_name, user_id')
          .eq('user_id', task.assignee_id)
          .single();
        assignee = assigneeData;
      }

      // Get creator profile
      let creator = null;
      if (task.creator_id) {
        const { data: creatorData } = await supabase
          .from('profiles')
          .select('full_name, user_id')
          .eq('user_id', task.creator_id)
          .single();
        creator = creatorData;
      }

      // Get total tracked time
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('minutes')
        .eq('task_id', task.id);

      const totalTrackedMinutes = timeEntries?.reduce((sum: number, entry: any) => sum + entry.minutes, 0) || 0;

      return {
        ...task,
        assignee,
        creator,
        total_tracked_minutes: totalTrackedMinutes,
      };
    })
  );

  return { data: tasksWithMetadata };
}

export async function getProjectTimesheet(projectId: string, startDate: string, endDate: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get all tasks for this project
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, title, status, assignee_id')
    .eq('project_id', projectId);

  if (tasksError || !tasks) {
    return { error: tasksError?.message || 'Failed to fetch tasks' };
  }

  const taskIds = tasks.map(t => t.id);

  if (taskIds.length === 0) {
    return { data: { tasks: [], week_total: 0 } };
  }

  // Get time entries for these tasks within date range
  const { data: timeEntries, error: entriesError } = await supabase
    .from('time_entries')
    .select('task_id, minutes, date, user_id')
    .in('task_id', taskIds)
    .gte('date', startDate)
    .lte('date', endDate);

  if (entriesError) {
    return { error: entriesError.message };
  }

  // Group by task
  const taskMap = new Map<string, any>();
  
  tasks.forEach(task => {
    taskMap.set(task.id, {
      task_id: task.id,
      task_title: task.title,
      task_status: task.status,
      assignee_id: task.assignee_id,
      daily_time: {} as { [date: string]: number },
      total_minutes: 0,
    });
  });

  // Aggregate time entries
  timeEntries?.forEach(entry => {
    const task = taskMap.get(entry.task_id);
    if (task) {
      const dateStr = entry.date;
      if (!task.daily_time[dateStr]) {
        task.daily_time[dateStr] = 0;
      }
      task.daily_time[dateStr] += entry.minutes;
      task.total_minutes += entry.minutes;
    }
  });

  const tasksArray = Array.from(taskMap.values());
  const weekTotal = tasksArray.reduce((sum, task) => sum + task.total_minutes, 0);

  return {
    data: {
      tasks: tasksArray,
      week_total: weekTotal,
    },
  };
}

