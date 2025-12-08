"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import CreateTaskModal from "./CreateTaskModal";
import Avatar from "./Avatar";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();
      if (user) {
        setUser(user);
        const { data } = await supabaseBrowser
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("user_id", user.id)
          .single();
        setProfile(data);
      }
    }
    loadUser();
  }, []);

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.push("/login");
  }

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">Team Management</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowCreateTaskModal(true)}
          className="bg-[#6295ff] hover:bg-[#4b7af0] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          + New Task
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <Avatar
              name={displayName}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
            <span className="text-sm text-zinc-300 hidden md:block">
              {displayName}
            </span>
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-50">
              <Link
                href="/settings"
                className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded-t-md"
                onClick={() => setShowMenu(false)}
              >
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded-b-md"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onTaskCreated={() => {
          setShowCreateTaskModal(false);
          router.refresh();
        }}
      />
    </header>
  );
}

