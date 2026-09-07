type BrandMarkSize = "md" | "sm";

const SIZE_CLASSES: Record<BrandMarkSize, { mark: string; letter: string; wordmark: string }> = {
  md: { mark: "size-[26px]", letter: "text-[13px]", wordmark: "text-[16px]" },
  sm: { mark: "size-[24px]", letter: "text-[12px]", wordmark: "text-[15px]" },
};

export function BrandMark({ size = "md" }: { size?: BrandMarkSize }) {
  const classes = SIZE_CLASSES[size];

  return (
    <div className="flex items-center gap-[9px]" aria-hidden="true">
      <span
        className={`grid ${classes.mark} place-items-center bg-accent font-display ${classes.letter} font-bold text-white`}
      >
        T
      </span>
      <span
        className={`font-display ${classes.wordmark} font-bold tracking-[0.2px] text-ink`}
      >
        TRACKR
      </span>
    </div>
  );
}
