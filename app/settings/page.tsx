"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseClient";
import AvatarUpload from "../(dashboard)/components/AvatarUpload";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    role: "",
    defaultView: "board" as "board" | "list",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabaseBrowser.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabaseBrowser
          .from("profiles")
          .select("full_name, role, default_view, avatar_url")
          .eq("user_id", user.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        if (profile) {
          setFormData({
            fullName: profile.full_name || "",
            role: profile.role || "",
            defaultView: (profile.default_view as "board" | "list") || "board",
          });
          setAvatarUrl(profile.avatar_url || null);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError(err.message || "Failed to load profile.");
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

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

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message || "Failed to save settings. Please try again.");
    } finally {
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
    <div className="min-h-screen flex flex-col bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-black">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Back to Dashboard
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md space-y-6 border border-zinc-800 rounded-xl p-8 bg-zinc-900 shadow-lg"
        >
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-white">Account Settings</h2>
            <p className="text-sm text-zinc-400">
              Update your profile information
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

          {success && (
            <p className="text-sm text-green-400 bg-green-950/40 border border-green-900 rounded-md px-3 py-2">
              Settings saved successfully!
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
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </main>
    </div>
  );
}

