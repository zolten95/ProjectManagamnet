"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import AvatarUpload from "../(dashboard)/components/AvatarUpload";

const STUDIO_DIRECTION_TEAM_ID = "92e8f38d-5161-4d70-bbdd-772d23cc7373";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    role: "",
    defaultView: "board" as "board" | "list",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function checkProfile() {
      try {
        const {
          data: { user },
        } = await supabaseBrowser.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Check if profile is already complete
        const { data: profile, error: profileError } = await supabaseBrowser
          .from("profiles")
          .select("full_name, role, default_view, avatar_url")
          .eq("user_id", user.id)
          .single();

        // If profile doesn't exist yet, that's fine - we'll create it
        if (profileError && profileError.code !== "PGRST116") {
          console.error("Error fetching profile:", profileError);
        }

        // Debug logging
        console.log("Profile data:", profile);
        console.log("default_view value:", profile?.default_view);
        console.log("Is default_view set?", profile?.default_view && profile.default_view !== null && profile.default_view !== '');

        // Only consider profile complete if default_view is explicitly set (not null/empty)
        // This ensures users who just signed up (with auto-generated full_name) still see setup
        const hasDefaultView = profile?.default_view && 
                               profile.default_view !== null && 
                               profile.default_view !== '' && 
                               profile.default_view.trim() !== '';

        if (hasDefaultView) {
          // Profile already complete, redirect to dashboard
          console.log("Profile complete, redirecting to dashboard");
          router.push("/");
          return;
        }

        console.log("Profile incomplete, showing setup form");

        // Prefill if partial data exists
        if (profile) {
          setFormData({
            fullName: profile.full_name || "",
            role: profile.role || "",
            defaultView: (profile.default_view as "board" | "list") || "board",
          });
          setAvatarUrl(profile.avatar_url || null);
        }

        // Ensure user is in StudioDirection workspace
        await ensureTeamMembership(user.id);

        setLoading(false);
      } catch (err) {
        console.error("Error checking profile:", err);
        setError("Failed to load profile. Please refresh.");
        setLoading(false);
      }
    }

    checkProfile();
  }, [router]);

  async function ensureTeamMembership(userId: string) {
    // Check if user is already a team member
    const { data: existing } = await supabaseBrowser
      .from("team_members")
      .select("user_id")
      .eq("team_id", STUDIO_DIRECTION_TEAM_ID)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      // Add user to team as member
      await supabaseBrowser.from("team_members").insert({
        team_id: STUDIO_DIRECTION_TEAM_ID,
        user_id: userId,
        role: "member",
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Ensure team membership
      await ensureTeamMembership(user.id);

      // Upsert profile
      const { error: profileError } = await supabaseBrowser
        .from("profiles")
        .upsert({
          user_id: user.id,
          full_name: formData.fullName,
          role: formData.role || null,
          default_view: formData.defaultView,
        });

      if (profileError) {
        throw profileError;
      }

      // Redirect to dashboard
      router.push("/");
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message || "Failed to save profile. Please try again.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 border border-zinc-800 rounded-xl p-8 bg-zinc-900 shadow-lg"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-white">
            Complete your profile
          </h1>
          <p className="text-sm text-zinc-400">
            Let&apos;s set up your account
          </p>
        </div>

        <div className="flex justify-center">
          <AvatarUpload
            currentAvatarUrl={avatarUrl}
            userName={formData.fullName || "User"}
            onAvatarUpdated={(url) => setAvatarUrl(url)}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label className="block text-sm text-zinc-300" htmlFor="fullName">
            Display Name <span className="text-red-400">*</span>
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-zinc-300" htmlFor="role">
            Role / Title
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) =>
              setFormData({ ...formData, role: e.target.value })
            }
            className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">Select a role</option>
            <option value="Developer">Developer</option>
            <option value="Designer">Designer</option>
            <option value="PM">Product Manager</option>
            <option value="Manager">Manager</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">
            Default View <span className="text-red-400">*</span>
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="defaultView"
                value="board"
                checked={formData.defaultView === "board"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultView: e.target.value as "board" | "list",
                  })
                }
                className="text-[#6295ff]"
              />
              <span className="text-zinc-300">Board view (columns)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="defaultView"
                value="list"
                checked={formData.defaultView === "list"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultView: e.target.value as "board" | "list",
                  })
                }
                className="text-[#6295ff]"
              />
              <span className="text-zinc-300">List view (table)</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#6295ff] hover:bg-[#4b7af0] disabled:opacity-60 text-white rounded-md py-2.5 font-medium transition-colors"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}

