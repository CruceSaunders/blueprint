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

// 1x1 transparent GIF: lets a <picture> skip its download at widths where it is hidden.
const NONE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// Hero capture. Wide screens: the full app window. Phones: the same capture as two tight crops, stacked.
export function HeroShot({ shot }: { shot: Shot & { canvas: Variant; panel: Variant } }) {
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
      <picture className="block border-t border-line sm:hidden">
        <source srcSet={NONE} media={wide} />
        <source srcSet={shot.panel.dark} media="(prefers-color-scheme: dark)" />
        <img src={shot.panel.light} width={shot.panel.width} height={shot.panel.height} alt="" loading="eager" decoding="async" />
      </picture>
    </>
  );
}
