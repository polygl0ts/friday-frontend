import { useLayoutEffect, useRef, useState } from "react";
import { PAGE_NOTES, type PageNoteKey } from "../pageNotes";

/** How far the note reaches, measured off the header's nav links. */
function useNavAnchors(note: React.RefObject<HTMLElement | null>) {
  const [anchors, setAnchors] = useState<{
    width: number;
    caret: number;
  } | null>(null);

  useLayoutEffect(() => {
    const nav = document.querySelector(".nav");
    const measure = () => {
      const el = note.current;
      const active = nav?.querySelector(".navlink.active");
      const slides = nav?.querySelector('.navlink[href="/slides"]');
      if (!el || !active || !slides) return setAnchors(null);

      const left = el.getBoundingClientRect().left;
      const page = el.closest(".page");
      const room = page
        ? page.getBoundingClientRect().right -
          parseFloat(getComputedStyle(page).paddingRight)
        : Infinity;
      const a = active.getBoundingClientRect();
      const s = slides.getBoundingClientRect();
      const first = nav?.querySelector(".navlink")?.getBoundingClientRect();
      // On a wrapped nav, slides is no longer a meaningful right edge.
      const wrapped = first !== undefined && s.top > first.bottom;
      const reach = wrapped ? room : Math.max(s.right, a.right);
      setAnchors({
        width: Math.min(reach, room) - left,
        caret: a.left + a.width / 2 - left,
      });
    };

    measure();
    void document.fonts?.ready.then(measure);
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [note]);

  return anchors;
}

export function PageNote({ page }: { page: PageNoteKey }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const anchors = useNavAnchors(ref);

  return (
    <p
      ref={ref}
      className="page-note"
      style={anchors ? { width: anchors.width } : undefined}
    >
      {anchors && (
        <span
          className="page-note-caret"
          style={{ left: anchors.caret }}
          aria-hidden="true"
        >
          ^
        </span>
      )}
      {PAGE_NOTES[page]}
    </p>
  );
}
