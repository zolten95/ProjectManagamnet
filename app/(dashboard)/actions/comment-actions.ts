'use server';

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export async function addComment(
  taskId: string,
  content: string,
  attachments?: Array<{ url: string; name: string; type: string; size: number }>
) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  if (!content.trim() && (!attachments || attachments.length === 0)) {
    return { error: 'Comment cannot be empty' };
  }

  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      user_id: user.id,
      content: content.trim() || null,
      attachments: attachments && attachments.length > 0 ? attachments : null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error adding comment:', error);
    return { error: error.message };
  }

  // Get user profile separately
  let userProfile = null;
  if (data.user_id) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, user_id, avatar_url')
      .eq('user_id', data.user_id)
      .single();
    userProfile = profileData;
  }

  const commentWithUser = {
    ...data,
    user: userProfile,
  };

  revalidatePath('/');
  revalidatePath('/all-tasks');
  return { data: commentWithUser };
}

export async function getComments(taskId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data: commentsData, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    return { error: error.message };
  }

  // Get user profiles for comments separately
  const comments = await Promise.all(
    (commentsData || []).map(async (comment) => {
      if (comment.user_id) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, user_id, avatar_url')
          .eq('user_id', comment.user_id)
          .single();
        return { ...comment, user: userData };
      }
      return { ...comment, user: null };
    })
  );

  return { data: comments || [] };
}
