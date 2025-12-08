"use client";

import { useState, useEffect } from "react";
import {
  getTeamMembersWithStats,
  getTeamStats,
  getMemberActivity,
  updateMemberRole,
  removeMember,
  getCurrentUserRole,
  type TeamMemberWithStats,
  type TeamStats,
  type MemberActivity,
} from "../actions/team-actions";
import { supabaseBrowser } from "@/lib/supabaseClient";
import Avatar from "../components/Avatar";

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}m`;
  }
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberWithStats[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const [selectedMember, setSelectedMember] = useState<TeamMemberWithStats | null>(null);
  const [memberActivity, setMemberActivity] = useState<MemberActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [memberToUpdate, setMemberToUpdate] = useState<TeamMemberWithStats | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  useEffect(() => {
    if (selectedMember) {
      loadMemberActivity(selectedMember.user_id);
    }
  }, [selectedMember]);

  async function loadData() {
    setLoading(true);
    setError(null);

    const [membersResult, statsResult, roleResult] = await Promise.all([
      getTeamMembersWithStats(),
      getTeamStats(),
      getCurrentUserRole(),
    ]);

    if (membersResult.error) {
      setError(membersResult.error);
    } else {
      setMembers(membersResult.data || []);
    }

    if (statsResult.error) {
      console.error("Error loading stats:", statsResult.error);
    } else {
      setStats(statsResult.data || null);
    }

    if (roleResult.error) {
      console.error("Error loading role:", roleResult.error);
    } else {
      setCurrentUserRole(roleResult.role || "member");
    }

    setLoading(false);
  }

  async function loadMemberActivity(userId: string) {
    setLoadingActivity(true);
    const result = await getMemberActivity(userId, 30);
    if (result.error) {
      console.error("Error loading activity:", result.error);
    } else {
      setMemberActivity(result.data || []);
    }
    setLoadingActivity(false);
  }

  async function handleRoleChange(userId: string, newRole: "admin" | "member") {
    setUpdatingRole(true);
    const result = await updateMemberRole(userId, newRole);
    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      await loadData();
      setShowRoleChangeModal(false);
      setMemberToUpdate(null);
    }
    setUpdatingRole(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Are you sure you want to remove this member from the team?")) {
      return;
    }
    const result = await removeMember(userId);
    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      await loadData();
      if (selectedMember?.user_id === userId) {
        setSelectedMember(null);
      }
    }
  }

  const isAdmin = currentUserRole === "admin";

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-400">Loading team data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-2">Team</h2>
        <p className="text-zinc-400">Manage your team members and view statistics</p>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 rounded-md px-4 py-3 text-sm text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Team Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm mb-1">Total Members</div>
            <div className="text-2xl font-semibold text-white">{stats.total_members}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm mb-1">Active Members</div>
            <div className="text-2xl font-semibold text-green-400">{stats.active_members}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm mb-1">Total Tasks</div>
            <div className="text-2xl font-semibold text-white">{stats.total_tasks}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm mb-1">Completed</div>
            <div className="text-2xl font-semibold text-green-400">{stats.completed_tasks}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-zinc-400 text-sm mb-1">Time Tracked</div>
            <div className="text-2xl font-semibold text-white">
              {formatTime(stats.total_time_tracked_minutes)}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member Directory */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Team Members</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className={`bg-zinc-800 border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedMember?.user_id === member.user_id
                      ? "border-[#6295ff] bg-zinc-800/50"
                      : "border-zinc-700 hover:border-zinc-600"
                  }`}
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={member.profile?.full_name || "Unknown"}
                      avatarUrl={member.profile?.avatar_url}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium truncate">
                          {member.profile?.full_name || "Unknown"}
                        </h4>
                        {member.role === "admin" && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-xs font-medium">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-zinc-400 space-y-1">
                        <div>
                          {member.tasks_assigned || 0} tasks • {member.tasks_completed || 0}{" "}
                          completed
                        </div>
                        <div>{formatTime(member.total_time_tracked_minutes || 0)} tracked</div>
                        <div className="text-xs">
                          Last active: {formatDate(member.last_activity)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Member Profile & Activity */}
        <div className="lg:col-span-1">
          {selectedMember ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
              {/* Member Profile */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar
                    name={selectedMember.profile?.full_name || "Unknown"}
                    avatarUrl={selectedMember.profile?.avatar_url}
                    size="xl"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedMember.profile?.full_name || "Unknown"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedMember.role === "admin"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "bg-zinc-700 text-zinc-300 border border-zinc-600"
                        }`}
                      >
                        {selectedMember.role === "admin" ? "Admin" : "Member"}
                      </span>
                      {isAdmin && selectedMember.user_id !== currentUserId && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setMemberToUpdate(selectedMember);
                              setShowRoleChangeModal(true);
                            }}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
                            title="Change Role"
                          >
                            ⚙️
                          </button>
                          <button
                            onClick={() => handleRemoveMember(selectedMember.user_id)}
                            className="px-2 py-1 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded text-xs transition-colors"
                            title="Remove Member"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="text-zinc-400 text-xs mb-1">Tasks Assigned</div>
                    <div className="text-xl font-semibold text-white">
                      {selectedMember.tasks_assigned || 0}
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="text-zinc-400 text-xs mb-1">Completed</div>
                    <div className="text-xl font-semibold text-green-400">
                      {selectedMember.tasks_completed || 0}
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 col-span-2">
                    <div className="text-zinc-400 text-xs mb-1">Time Tracked</div>
                    <div className="text-xl font-semibold text-white">
                      {formatTime(selectedMember.total_time_tracked_minutes || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Feed */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Recent Activity</h4>
                {loadingActivity ? (
                  <div className="text-sm text-zinc-400">Loading activity...</div>
                ) : memberActivity.length === 0 ? (
                  <div className="text-sm text-zinc-400">No recent activity</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {memberActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="text-sm text-zinc-400 border-l-2 border-zinc-700 pl-3 py-1"
                      >
                        <div className="text-white">{activity.description}</div>
                        <div className="text-xs mt-0.5">{formatDate(activity.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <p className="text-zinc-400 text-center">Select a team member to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleChangeModal && memberToUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full m-4">
            <h3 className="text-lg font-semibold text-white mb-2">Change Member Role</h3>
            <p className="text-zinc-400 mb-4">
              Change role for {memberToUpdate.profile?.full_name || "this member"}:
            </p>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="member"
                  defaultChecked={memberToUpdate.role === "member"}
                  className="text-[#6295ff]"
                />
                <span className="text-white">Member</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  defaultChecked={memberToUpdate.role === "admin"}
                  className="text-[#6295ff]"
                />
                <span className="text-white">Admin</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const selectedRole = (
                    document.querySelector('input[name="role"]:checked') as HTMLInputElement
                  )?.value as "admin" | "member";
                  if (selectedRole) {
                    handleRoleChange(memberToUpdate.user_id, selectedRole);
                  }
                }}
                disabled={updatingRole}
                className="flex-1 px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] disabled:opacity-60 text-white rounded-md font-medium transition-colors"
              >
                {updatingRole ? "Updating..." : "Update Role"}
              </button>
              <button
                onClick={() => {
                  setShowRoleChangeModal(false);
                  setMemberToUpdate(null);
                }}
                disabled={updatingRole}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
