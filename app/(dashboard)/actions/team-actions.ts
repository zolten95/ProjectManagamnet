'use server';

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

const STUDIO_DIRECTION_TEAM_ID = "92e8f38d-5161-4d70-bbdd-772d23cc7373";

export interface TeamMemberWithStats {
  user_id: string;
  role: string | null;
  profile: {
    full_name: string;
    user_id: string;
    avatar_url?: string | null;
  } | null;
  tasks_assigned?: number;
  tasks_completed?: number;
  total_time_tracked_minutes?: number;
  last_activity?: string | null;
}

export interface TeamStats {
  total_members: number;
  total_tasks: number;
  completed_tasks: number;
  total_time_tracked_minutes: number;
  active_members: number;
}

export interface MemberActivity {
  id: string;
  type: 'task_created' | 'task_completed' | 'task_updated' | 'comment_added' | 'time_tracked';
  description: string;
  created_at: string;
  task_id?: string | null;
}

export async function getCurrentUserRole(): Promise<{ role?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data: teamMember, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .eq('user_id', user.id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { role: teamMember?.role || 'member' };
}

export async function getTeamMembersWithStats(): Promise<{ data?: TeamMemberWithStats[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get team members
  const { data: teamMembersData, error: teamMembersError } = await supabase
    .from('team_members')
    .select('user_id, role')
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .order('created_at', { ascending: true });

  if (teamMembersError) {
    return { error: teamMembersError.message };
  }

  // Enrich with statistics and profiles
  const membersWithStats = await Promise.all(
    (teamMembersData || []).map(async (member: any) => {
      const userId = member.user_id;
      
      // Get profile separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, user_id, avatar_url')
        .eq('user_id', userId)
        .single();
      
      // Get task statistics
      const { data: tasks, count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: false })
        .eq('assignee_id', userId);

      const completedTasks = tasks?.filter((t: any) => t.status === 'complete').length || 0;
      const totalTasks = taskCount || 0;

      // Get total time tracked
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('minutes, created_at')
        .eq('user_id', userId);

      const totalTimeTracked = timeEntries?.reduce((sum: number, entry: any) => sum + entry.minutes, 0) || 0;
      
      // Get last activity (most recent time entry or task update)
      let lastActivity = null;
      if (timeEntries && timeEntries.length > 0) {
        const latestTimeEntry = timeEntries.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        lastActivity = latestTimeEntry.created_at;
      }

      // Get latest task update
      if (tasks && tasks.length > 0) {
        const latestTask = tasks.sort((a: any, b: any) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];
        if (!lastActivity || new Date(latestTask.updated_at) > new Date(lastActivity)) {
          lastActivity = latestTask.updated_at;
        }
      }

      return {
        user_id: userId,
        role: member.role,
        profile: profileData,
        tasks_assigned: totalTasks,
        tasks_completed: completedTasks,
        total_time_tracked_minutes: totalTimeTracked,
        last_activity: lastActivity,
      };
    })
  );

  return { data: membersWithStats };
}

export async function getTeamStats(): Promise<{ data?: TeamStats; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get total members
  const { count: totalMembers } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID);

  // Get total tasks
  const { data: tasks, count: totalTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: false })
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID);

  const completedTasks = tasks?.filter((t: any) => t.status === 'complete').length || 0;

  // Get total time tracked
  const taskIds = tasks?.map((t: any) => t.id) || [];
  let totalTimeTracked = 0;
  if (taskIds.length > 0) {
    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('minutes')
      .in('task_id', taskIds);

    totalTimeTracked = timeEntries?.reduce((sum: number, entry: any) => sum + entry.minutes, 0) || 0;
  }

  // Get active members (members who have tracked time or completed tasks in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: recentActivities } = await supabase
    .from('time_entries')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo.toISOString());

  const activeUserIds = new Set(recentActivities?.map((e: any) => e.user_id) || []);
  
  // Also check for completed tasks
  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('assignee_id')
    .eq('status', 'complete')
    .gte('updated_at', thirtyDaysAgo.toISOString());

  recentTasks?.forEach((t: any) => {
    if (t.assignee_id) {
      activeUserIds.add(t.assignee_id);
    }
  });

  return {
    data: {
      total_members: totalMembers || 0,
      total_tasks: totalTasks || 0,
      completed_tasks: completedTasks,
      total_time_tracked_minutes: totalTimeTracked,
      active_members: activeUserIds.size,
    },
  };
}

export async function getMemberActivity(userId: string, limit: number = 20): Promise<{ data?: MemberActivity[]; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const activities: MemberActivity[] = [];

  // Get tasks created by user
  const { data: createdTasks } = await supabase
    .from('tasks')
    .select('id, title, created_at')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  createdTasks?.forEach((task: any) => {
    activities.push({
      id: `task_created_${task.id}`,
      type: 'task_created',
      description: `Created task "${task.title}"`,
      created_at: task.created_at,
      task_id: task.id,
    });
  });

  // Get tasks completed by user
  const { data: completedTasks } = await supabase
    .from('tasks')
    .select('id, title, updated_at')
    .eq('assignee_id', userId)
    .eq('status', 'complete')
    .order('updated_at', { ascending: false })
    .limit(limit);

  completedTasks?.forEach((task: any) => {
    activities.push({
      id: `task_completed_${task.id}`,
      type: 'task_completed',
      description: `Completed task "${task.title}"`,
      created_at: task.updated_at,
      task_id: task.id,
    });
  });

  // Get comments added by user
  const { data: comments } = await supabase
    .from('task_comments')
    .select('id, task_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  comments?.forEach((comment: any) => {
    activities.push({
      id: `comment_${comment.id}`,
      type: 'comment_added',
      description: 'Added a comment',
      created_at: comment.created_at,
      task_id: comment.task_id,
    });
  });

  // Get time entries
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('id, minutes, created_at, task_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  timeEntries?.forEach((entry: any) => {
    const hours = Math.floor(entry.minutes / 60);
    const mins = entry.minutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    activities.push({
      id: `time_${entry.id}`,
      type: 'time_tracked',
      description: `Tracked ${timeStr}`,
      created_at: entry.created_at,
      task_id: entry.task_id,
    });
  });

  // Sort by date and limit
  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { data: activities.slice(0, limit) };
}

export async function updateMemberRole(userId: string, newRole: 'admin' | 'member'): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Check if current user is admin
  const { data: currentUserMember } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .eq('user_id', user.id)
    .single();

  if (currentUserMember?.role !== 'admin') {
    return { error: 'Only admins can change member roles' };
  }

  // Prevent removing last admin
  if (newRole === 'member' && userId === user.id) {
    const { count: adminCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
      .eq('role', 'admin');

    if ((adminCount || 0) <= 1) {
      return { error: 'Cannot remove the last admin' };
    }
  }

  const { error } = await supabase
    .from('team_members')
    .update({ role: newRole })
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .eq('user_id', userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/team');
  return { success: true };
}

export async function removeMember(userId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Check if current user is admin
  const { data: currentUserMember } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .eq('user_id', user.id)
    .single();

  if (currentUserMember?.role !== 'admin') {
    return { error: 'Only admins can remove members' };
  }

  // Prevent removing yourself
  if (userId === user.id) {
    return { error: 'Cannot remove yourself' };
  }

  // Prevent removing last admin
  const { data: memberToRemove } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .eq('user_id', userId)
    .single();

  if (memberToRemove?.role === 'admin') {
    const { count: adminCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
      .eq('role', 'admin');

    if ((adminCount || 0) <= 1) {
      return { error: 'Cannot remove the last admin' };
    }
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', STUDIO_DIRECTION_TEAM_ID)
    .eq('user_id', userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/team');
  return { success: true };
}

