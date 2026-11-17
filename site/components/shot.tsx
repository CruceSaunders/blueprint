type Variant = { light: string; dark: string; width: number; height: number };
type Shot = Variant & { alt: string };

// A real product capture, swapped by colour scheme. Never redrawn.
export function ShotImage({ shot, priority = false, sizes }: { shot: Shot; priority?: boolean; sizes?: string }) {
  return (
    <picture>
      <source srcSet={shot.dark} media="(prefers-color-scheme: dark)" />
      <img
        src={shot.light}
        width={shot.width}
        height={shot.height}
        alt={shot.alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}

// Hero capture. Wide screens: the full app window. Phones: a crop of the same capture (the map and its open detail card).
export function HeroShot({ shot }: { shot: Shot & { canvas: Variant } }) {
  const wide = "(min-width: 640px)";
  return (
    <>
      <picture>
        <source srcSet={shot.dark} media={`${wide} and (prefers-color-scheme: dark)`} width={shot.width} height={shot.height} />
        <source srcSet={shot.light} media={wide} width={shot.width} height={shot.height} />
        <source srcSet={shot.canvas.dark} media="(prefers-color-scheme: dark)" />
        <img
          src={shot.canvas.light}
          width={shot.canvas.width}
          height={shot.canvas.height}
          alt={shot.alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </>
  );
}
