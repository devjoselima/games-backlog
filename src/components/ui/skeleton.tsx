import { useState } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.07]", className)} {...props} />;
}

function LazyCoverImage({
  src,
  alt,
  className,
  fallbackText,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackText?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2 px-2 text-center font-display text-xs font-semibold text-muted-foreground">
        {fallbackText || alt}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-2">
      {!loaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </div>
  );
}

export { Skeleton, LazyCoverImage };
