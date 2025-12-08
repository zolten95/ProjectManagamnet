'use server';

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export async function uploadAvatar(formData: FormData): Promise<{ data?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  const file = formData.get('file') as File;
  if (!file) {
    return { error: 'No file provided' };
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { error: 'File size must be less than 5MB' };
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { error: 'File must be an image' };
  }

  try {
    // Delete old avatar if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single();

    if (profile?.avatar_url) {
      // Extract file path from URL
      const urlParts = profile.avatar_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const folderName = urlParts[urlParts.length - 2];
      if (fileName && folderName) {
        await supabase.storage
          .from('avatars')
          .remove([`${folderName}/${fileName}`]);
      }
    }

    // Create a unique file name
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('The resource was not found')) {
        return { 
          error: 'Avatar storage bucket not found. Please create a bucket named "avatars" in Supabase Storage and set it to Public.' 
        };
      }
      
      return { error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return { error: 'Failed to get file URL' };
    }

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('user_id', user.id);

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath('/settings');
    revalidatePath('/team');
    return { data: urlData.publicUrl };
  } catch (error: any) {
    console.error('Error uploading avatar:', error);
    return { error: error.message || 'Failed to upload avatar' };
  }
}

export async function removeAvatar(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  try {
    // Get current avatar URL
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single();

    if (profile?.avatar_url) {
      // Extract file path from URL
      const urlParts = profile.avatar_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const folderName = urlParts[urlParts.length - 2];
      if (fileName && folderName) {
        await supabase.storage
          .from('avatars')
          .remove([`${folderName}/${fileName}`]);
      }
    }

    // Remove avatar URL from profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('user_id', user.id);

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath('/settings');
    revalidatePath('/team');
    return { success: true };
  } catch (error: any) {
    console.error('Error removing avatar:', error);
    return { error: error.message || 'Failed to remove avatar' };
  }
}

