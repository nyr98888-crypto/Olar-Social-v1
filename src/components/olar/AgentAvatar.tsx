"use client";

/** Shared marketing-agent portrait — object-top so hair/face aren't cropped. */
export function AgentAvatar({
  size = "md",
  className = "",
  showOnline = true,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  showOnline?: boolean;
}) {
  const box =
    size === "lg"
      ? "h-14 w-14"
      : size === "sm"
        ? "h-9 w-9"
        : "h-12 w-12";
  const dot =
    size === "lg"
      ? "h-3.5 w-3.5"
      : size === "sm"
        ? "h-2.5 w-2.5"
        : "h-3 w-3";

  return (
    <div
      className={`relative ${box} shrink-0 overflow-hidden rounded-full border-2 border-cyan-400 shadow-sm ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing-agent.jpg"
        alt="מנהלת השיווק שלך"
        className="h-full w-full object-cover object-top"
      />
      {showOnline ? (
        <span
          className={`absolute bottom-0 end-0 ${dot} rounded-full border-2 border-white bg-emerald-500`}
        />
      ) : null}
    </div>
  );
}
