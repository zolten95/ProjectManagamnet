'use server';

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

const STUDIO_DIRECTION_TEAM_ID = "92e8f38d-5161-4d70-bbdd-772d23cc7373";

export interface TeamMember {
  user_id: string;
  role: string | null;
  profile: {
    full_name: string;
    user_id: string;
  } | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignee_id: string;
  estimated_time_minutes?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  project_id?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignee_id?: string;
  estimated_time_minutes?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null;
  due_date?: string | null;
  project_id?: string | null;
}

export async function createTask(input: CreateTaskInput) {
  const supabase = await createSupabaseServerClient();
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Create task auth error:', userError);
    console.error('User:', user);
    return { error: 'Not authenticated' };
  }

  // Create task with default status 'todo'
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      team_id: STUDIO_DIRECTION_TEAM_ID,
      title: input.title,
      description: input.description || null,
      assignee_id: input.assignee_id,
      creator_id: user.id,
      status: 'todo',
      estimated_time_minutes: input.estimated_time_minutes || null,
      priority: input.priority || null,
      due_date: input.due_date || null,
      project_id: input.project_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  return { data };
}

export async function updateTaskStatus(taskId: string, status: 'todo' | 'in_progress' | 'in_review' | 'complete') {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Check if user is assignee or creator
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id, creator_id')
    .eq('id', taskId)
    .single();

  if (!task || (task.assignee_id !== user.id && task.creator_id !== user.id)) {
    return { error: 'Not authorized to update this task' };
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task status:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  return { data };
}

export async function updateTaskDescription(taskId: string, description: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Check if user is assignee or creator
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id, creator_id')
    .eq('id', taskId)
    .single();

  if (!task || (task.assignee_id !== user.id && task.creator_id !== user.id)) {
    return { error: 'Not authorized to update this task' };
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ description: description || null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task description:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  revalidatePath(`/tasks/${taskId}`);
  return { data };
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Check if user is assignee or creator
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id, creator_id')
    .eq('id', taskId)
    .single();

  if (!task || (task.assignee_id !== user.id && task.creator_id !== user.id)) {
    return { error: 'Not authorized to update this task' };
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.assignee_id !== undefined) updateData.assignee_id = input.assignee_id || null;
  if (input.estimated_time_minutes !== undefined) updateData.estimated_time_minutes = input.estimated_time_minutes || null;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.due_date !== undefined) updateData.due_date = input.due_date || null;
  if (input.project_id !== undefined) updateData.project_id = input.project_id || null;

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  revalidatePath(`/tasks/${taskId}`);
  return { data };
}

export async function deleteTask(taskId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Check if user is assignee or creator
  const { data: task } = await supabase
    .from('tasks')
    .select('assignee_id, creator_id')
    .eq('id', taskId)
    .single();

  if (!task || (task.assignee_id !== user.id && task.creator_id !== user.id)) {
    return { error: 'Not authorized to delete this task' };
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Error deleting task:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  return { success: true };
}

export async function duplicateTask(taskId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get the original task
  const { data: originalTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (fetchError || !originalTask) {
    return { error: fetchError?.message || 'Task not found' };
  }

  // Create a duplicate with "Copy of" prefix
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      team_id: originalTask.team_id,
      title: `Copy of ${originalTask.title}`,
      description: originalTask.description,
      assignee_id: originalTask.assignee_id,
      creator_id: user.id,
      status: 'todo', // Reset status to todo
      estimated_time_minutes: originalTask.estimated_time_minutes,
      priority: originalTask.priority,
      due_date: originalTask.due_date,
      project_id: originalTask.project_id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error duplicating task:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  return { data };
}

export async function convertTaskToTemplate(taskId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get the original task
  const { data: originalTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (fetchError || !originalTask) {
    return { error: fetchError?.message || 'Task not found' };
  }

  // For now, we'll create a new task with template naming
  // In the future, you might want a separate templates table
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      team_id: originalTask.team_id,
      title: `[Template] ${originalTask.title}`,
      description: originalTask.description,
      assignee_id: null, // Templates don't have assignees
      creator_id: user.id,
      status: 'todo',
      estimated_time_minutes: originalTask.estimated_time_minutes,
      priority: originalTask.priority,
      due_date: null, // Templates don't have due dates
      project_id: originalTask.project_id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error converting task to template:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  return { data };
}

export async function getTaskDetails(taskId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get task first
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    console.error('Error fetching task:', taskError);
    return { error: taskError?.message || 'Task not found' };
  }

  // Get assignee and creator profiles separately
  let assignee = null;
  let creator = null;

  if (task.assignee_id) {
    const { data: assigneeData } = await supabase
      .from('profiles')
      .select('full_name, user_id')
      .eq('user_id', task.assignee_id)
      .single();
    assignee = assigneeData;
  }

  if (task.creator_id) {
    const { data: creatorData } = await supabase
      .from('profiles')
      .select('full_name, user_id')
      .eq('user_id', task.creator_id)
      .single();
    creator = creatorData;
  }

  // Get time entries
  const { data: timeEntriesData } = await supabase
    .from('time_entries')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  // Get user profiles for time entries
  const timeEntries = await Promise.all(
    (timeEntriesData || []).map(async (entry) => {
      if (entry.user_id) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, user_id')
          .eq('user_id', entry.user_id)
          .single();
        return { ...entry, user: userData };
      }
      return { ...entry, user: null };
    })
  );

  // Get comments
  const { data: commentsData } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  // Get user profiles for comments
  const comments = await Promise.all(
    (commentsData || []).map(async (comment) => {
      if (comment.user_id) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, user_id')
          .eq('user_id', comment.user_id)
          .single();
        return { ...comment, user: userData };
      }
      return { ...comment, user: null };
    })
  );

  return {
    data: {
      ...task,
      assignee,
      creator,
      time_entries: timeEntries || [],
      comments: comments || [],
    },
  };
}

export interface GetAllTasksFilters {
  status?: string;
  assignee_id?: string;
  priority?: string;
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
  sort_by?: 'created_at' | 'priority' | 'due_date' | 'assignee';
  sort_order?: 'asc' | 'desc';
}

export interface TaskWithMetadata {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  priority: string | null;
  estimated_time_minutes: number | null;
  assignee_id: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
  assignee: {
    full_name: string;
    user_id: string;
  } | null;
  creator: {
    full_name: string;
    user_id: string;
  } | null;
  total_tracked_minutes?: number;
  comment_count?: number;
}

export async function getAllTasks(filters?: GetAllTasksFilters): Promise<{ data?: TaskWithMetadata[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Start building query
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID);

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.assignee_id) {
    query = query.eq('assignee_id', filters.assignee_id);
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters?.due_date_from) {
    query = query.gte('due_date', filters.due_date_from);
  }

  if (filters?.due_date_to) {
    query = query.lte('due_date', filters.due_date_to);
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  // Apply sorting
  const sortBy = filters?.sort_by || 'created_at';
  const sortOrder = filters?.sort_order || 'desc';
  
  if (sortBy === 'assignee') {
    // For assignee sorting, we'll need to sort after fetching
    query = query.order('created_at', { ascending: sortOrder === 'asc' });
  } else {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  const { data: tasksData, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return { error: error.message };
  }

  // Enrich tasks with metadata
  const tasksWithMetadata = await Promise.all(
    (tasksData || []).map(async (task: any) => {
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

      const totalTrackedMinutes =
        timeEntries?.reduce((sum: number, entry: any) => sum + entry.minutes, 0) || 0;

      // Get comment count
      const { count: commentCount } = await supabase
        .from('task_comments')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', task.id);

      return {
        ...task,
        assignee,
        creator,
        total_tracked_minutes: totalTrackedMinutes,
        comment_count: commentCount || 0,
      };
    })
  );

  // Sort by assignee if needed (after fetching profiles)
  if (sortBy === 'assignee') {
    tasksWithMetadata.sort((a, b) => {
      const aName = a.assignee?.full_name || '';
      const bName = b.assignee?.full_name || '';
      return sortOrder === 'asc' 
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName);
    });
  }

  return { data: tasksWithMetadata };
}

export async function bulkUpdateTasks(
  taskIds: string[],
  updates: { status?: string; assignee_id?: string }
): Promise<{ data?: any[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) {
    updateData.status = updates.status;
  }

  if (updates.assignee_id !== undefined) {
    updateData.assignee_id = updates.assignee_id || null;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .in('id', taskIds)
    .select();

  if (error) {
    console.error('Error bulk updating tasks:', error);
    return { error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/all-tasks');
  return { data };
}

export async function getTeamMembers(): Promise<{ data?: TeamMember[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Auth error:', userError);
    return { error: 'Not authenticated' };
  }

  // First, try to get team members from team_members table
  const { data: teamMembersData, error: teamMembersError } = await supabase
    .from('team_members')
    .select(`
      user_id,
      role,
      profile:profiles!team_members_user_id_fkey(full_name, user_id)
    `)
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .order('created_at', { ascending: true });

  if (teamMembersError) {
    console.error('Error fetching team members:', teamMembersError);
    // Fallback: get all users with profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .not('full_name', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return { error: profilesError.message };
    }

    return { 
      data: (profilesData || []).map(p => ({
        user_id: p.user_id,
        role: null,
        profile: { full_name: p.full_name, user_id: p.user_id }
      }))
    };
  }

  // If we have team members, normalize the data to ensure profile is always an object or null
  if (teamMembersData && teamMembersData.length > 0) {
    return { 
      data: teamMembersData.map(member => {
        // Handle case where profile might be an array or object
        let profile = null;
        if (member.profile) {
          if (Array.isArray(member.profile)) {
            // If profile is an array, take the first element
            profile = member.profile[0] || null;
          } else {
            // If profile is already an object, use it directly
            profile = member.profile;
          }
        }
        
        return {
          user_id: member.user_id,
          role: member.role,
          profile: profile
        };
      })
    };
  }

  // Fallback: if no team members found, get all users with profiles
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .not('full_name', 'is', null);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return { error: profilesError.message };
  }

  return { 
    data: (profilesData || []).map(p => ({
      user_id: p.user_id,
      role: null,
      profile: { full_name: p.full_name, user_id: p.user_id }
    }))
  };
}
