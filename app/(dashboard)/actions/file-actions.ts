'use client';

import { supabaseBrowser } from "@/lib/supabaseClient";

export interface FileUploadResult {
  url: string;
  name: string;
  type: string;
  size: number;
}

export async function uploadCommentFile(
  file: File,
  taskId: string
): Promise<{ data?: FileUploadResult; error?: string }> {
  const { data: { user }, error: userError } = await supabaseBrowser.auth.getUser();
  if (userError || !user) {
    return { error: 'Not authenticated' };
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { error: 'File size must be less than 10MB' };
  }

  // Validate file type - be more lenient with MIME types
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
  const allowedFileTypes = [
    ...allowedImageTypes,
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
    'application/xml',
    'text/xml',
  ];

  // Get file extension for fallback validation
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
    'pdf',
    'doc', 'docx',
    'xls', 'xlsx',
    'ppt', 'pptx',
    'txt', 'csv', 'md',
    'zip', 'rar',
    'json', 'xml',
  ];

  // Check MIME type first, then fall back to extension if MIME type is empty or not recognized
  const hasValidMimeType = file.type && allowedFileTypes.includes(file.type);
  const hasValidExtension = fileExt && allowedExtensions.includes(fileExt);
  
  // Allow if either MIME type or extension is valid, or if MIME type is empty (browser might not detect it)
  if (!hasValidMimeType && !hasValidExtension && file.type !== '') {
    return { 
      error: `File type not allowed. Detected type: "${file.type || 'unknown'}", extension: ".${fileExt || 'none'}"` 
    };
  }

  try {
    // Create a unique file name (reuse fileExt from validation above)
    const fileName = `${taskId}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt || 'file'}`;
    const filePath = `task-comments/${fileName}`;

    // Try to upload directly - this will give us the actual error
    const { data: uploadData, error: uploadError } = await supabaseBrowser.storage
      .from('task-attachments')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      // Try to list buckets to show what's available
      const { data: buckets } = await supabaseBrowser.storage.listBuckets();
      const availableBuckets = buckets?.map(b => `${b.name} (${b.public ? 'public' : 'private'})`).join(', ') || 'none found';
      
      // Provide more helpful error messages
      if (uploadError.message?.includes('Bucket not found') || 
          uploadError.message?.includes('not found') ||
          uploadError.message?.includes('does not exist') ||
          uploadError.statusCode === 404) {
        return { 
          error: `Bucket "task-attachments" not found.\n\nAvailable buckets: ${availableBuckets}\n\nPlease check:\n1. Bucket name must be exactly "task-attachments" (case-sensitive, no spaces)\n2. Go to Supabase Dashboard → Storage\n3. Verify the bucket exists\n4. If missing, create it and set to Public`
        };
      }
      
      if (uploadError.message?.includes('new row violates row-level security') || 
          uploadError.message?.includes('permission') || 
          uploadError.message?.includes('policy') ||
          uploadError.message?.includes('denied') ||
          uploadError.statusCode === 403) {
        return { 
          error: `Permission denied. Bucket exists but upload is blocked.\n\nFix this:\n1. Go to Supabase Dashboard → Storage → Policies\n2. Click "New Policy" for "task-attachments"\n3. Use this SQL:\n\nCREATE POLICY "Allow authenticated uploads"\nON storage.objects FOR INSERT\nTO authenticated\nWITH CHECK (bucket_id = 'task-attachments');\n\n4. Also create a SELECT policy:\n\nCREATE POLICY "Allow authenticated reads"\nON storage.objects FOR SELECT\nTO authenticated\nUSING (bucket_id = 'task-attachments');`
        };
      }
      
      return { 
        error: `Upload failed: ${uploadError.message}\n\nAvailable buckets: ${availableBuckets}\n\nError code: ${uploadError.statusCode || 'unknown'}` 
      };
    }

    // Get public URL
    const { data: urlData } = supabaseBrowser.storage
      .from('task-attachments')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return { error: 'Failed to get file URL' };
    }

    return {
      data: {
        url: urlData.publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      },
    };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return { error: error.message || 'Failed to upload file' };
  }
}

