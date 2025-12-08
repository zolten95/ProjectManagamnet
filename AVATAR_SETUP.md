# Avatar Setup Guide

## Supabase Storage Setup

Za funkcionalnost avatara, potrebno je kreirati Storage bucket u Supabase:

### Koraci:

1. **Otvori Supabase Dashboard**
   - Idi na Storage sekciju
   - Klikni "New bucket"

2. **Kreiraj bucket:**
   - **Name**: `avatars`
   - **Public bucket**: ✅ (označi kao Public)
   - **File size limit**: 5 MB (ili više po potrebi)
   - **Allowed MIME types**: `image/*` (ili ostavi prazno za sve tipove)

3. **Storage Policies (RLS)**
   - Supabase će automatski kreirati osnovne policy-je
   - Možeš dodati custom policy ako želiš dodatnu kontrolu:
   
   ```sql
   -- Allow authenticated users to upload their own avatars
   CREATE POLICY "Users can upload their own avatars"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'avatars' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

   -- Allow authenticated users to update their own avatars
   CREATE POLICY "Users can update their own avatars"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'avatars' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

   -- Allow authenticated users to delete their own avatars
   CREATE POLICY "Users can delete their own avatars"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'avatars' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

   -- Allow public read access
   CREATE POLICY "Public read access for avatars"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'avatars');
   ```

## Funkcionalnosti

### Upload Avatar
- Korisnici mogu upload-ovati sliku profila tokom setup-a ili u Settings stranici
- Slika se automatski crop-uje u krug (400x400px)
- Maksimalna veličina: 5MB
- Podržani formati: svi image tipovi

### Avatar Display
- Ako korisnik ima upload-ovanu sliku, prikazuje se slika
- Ako nema sliku, prikazuju se inicijali (npr. "MV" za Milan Vracar)
- Avatar se prikazuje na:
  - Header (user menu)
  - Team stranica (member cards)
  - Task comments
  - Settings stranica

### Update Avatar
- Korisnici mogu promijeniti avatar u Settings stranici
- Stara slika se automatski briše kada se upload-uje nova
- Mogu ukloniti avatar klikom na "Remove Photo"

## Komponente

- **Avatar.tsx**: Komponenta za prikaz avatara (slika ili inicijali)
- **AvatarUpload.tsx**: Komponenta za upload i crop slike
- **avatar-actions.ts**: Server actions za upload/remove avatar-a

## Database Schema

`profiles` tabela već ima `avatar_url` kolonu koja se koristi za čuvanje URL-a slike.

