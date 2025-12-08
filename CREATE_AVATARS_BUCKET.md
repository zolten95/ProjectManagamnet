# How to Create Avatars Bucket in Supabase

## Method 1: Via Supabase Dashboard (Recommended)

### Step-by-Step Instructions:

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Storage**
   - Click on "Storage" in the left sidebar
   - You should see a list of buckets (might be empty)

3. **Create New Bucket**
   - Click the "New bucket" button (usually top right)
   - Fill in the form:
     - **Name**: `avatars` (must be exactly this name)
     - **Public bucket**: ✅ **Check this box** (very important!)
     - **File size limit**: `5242880` (5 MB in bytes) or leave empty for no limit
     - **Allowed MIME types**: Leave empty (allows all image types)

4. **Click "Create bucket"**

5. **Set up Storage Policies (RLS)**
   - After creating the bucket, click on it
   - Go to "Policies" tab
   - Click "New Policy"
   - Choose "For full customization" or use these policies:

### Storage Policies (RLS)

You need to create these policies to allow users to upload/update/delete their own avatars:

#### Policy 1: Allow authenticated users to upload their own avatars
- **Policy name**: `Users can upload their own avatars`
- **Allowed operation**: INSERT
- **Target roles**: authenticated
- **Policy definition**:
```sql
(bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 2: Allow authenticated users to update their own avatars
- **Policy name**: `Users can update their own avatars`
- **Allowed operation**: UPDATE
- **Target roles**: authenticated
- **Policy definition**:
```sql
(bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 3: Allow authenticated users to delete their own avatars
- **Policy name**: `Users can delete their own avatars`
- **Allowed operation**: DELETE
- **Target roles**: authenticated
- **Policy definition**:
```sql
(bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 4: Allow public read access (for displaying avatars)
- **Policy name**: `Public read access for avatars`
- **Allowed operation**: SELECT
- **Target roles**: public
- **Policy definition**:
```sql
bucket_id = 'avatars'::text
```

## Method 2: Via Supabase CLI (Alternative)

If you have Supabase CLI installed:

```bash
# Create the bucket
supabase storage create avatars --public

# The bucket will be created as public automatically
```

## Quick SQL Script (For Policies Only)

**Note**: You cannot create the bucket itself via SQL, but you can set up the policies after creating the bucket via UI.

Run this SQL in Supabase SQL Editor **after** creating the bucket via UI:

```sql
-- Policy 1: Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow public read access (for displaying avatars)
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

## Verification

After creating the bucket and policies:

1. Go back to your app
2. Try uploading an avatar
3. It should work without errors

## Troubleshooting

**Error: "Bucket not found"**
- Make sure the bucket name is exactly `avatars` (lowercase, no spaces)
- Make sure you created it in the correct project

**Error: "Permission denied"**
- Make sure the bucket is marked as **Public**
- Make sure you've created the storage policies above

**Error: "Upload failed"**
- Check that the policies are correctly set up
- Make sure the user is authenticated

