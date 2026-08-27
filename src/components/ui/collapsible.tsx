import { useEffect, useState } from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia(REDUCED_MOTION_QUERY).matches
  )

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener?.("change", update)
    return () => media.removeEventListener?.("change", update)
  }, [])

  return reduced
}

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn(
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 active:bg-accent-soft motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  style,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      data-motion={reducedMotion ? "reduced" : "animated"}
      className={cn("lacir-collapsible-content", className)}
      style={{
        ...style,
        ...(reducedMotion ? { animationDuration: "0ms", transitionDuration: "0ms" } : {}),
      }}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
