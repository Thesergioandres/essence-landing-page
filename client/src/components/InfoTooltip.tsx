type InfoTooltipProps = {
  text: string;
  size?: "sm" | "md";
  tone?: "neutral" | "muted" | "warning" | "danger" | "accent";
  className?: string;
};

const toneClassMap: Record<NonNullable<InfoTooltipProps["tone"]>, string> = {
  neutral: "border-gray-600 text-gray-300",
  muted: "border-gray-500 text-gray-300",
  warning: "border-amber-300/60 text-amber-300",
  danger: "border-red-400/60 text-red-300",
  accent: "border-rose-300/60 text-rose-300",
};

export default function InfoTooltip({
  text,
  size = "md",
  tone = "neutral",
  className = "",
}: InfoTooltipProps) {
  const sizeClass =
    size === "sm" ? "h-3 w-3 text-[9px]" : "h-4 w-4 text-[10px]";

  return (
    <span
      title={text}
      className={`ml-1 inline-flex items-center justify-center rounded-full border font-semibold ${sizeClass} ${toneClassMap[tone]} ${className}`}
    >
      i
    </span>
  );
}
