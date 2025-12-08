"use client";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

export default function Avatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const initials = getInitials(name);

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold text-white bg-[#6295ff] flex-shrink-0 overflow-hidden ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

