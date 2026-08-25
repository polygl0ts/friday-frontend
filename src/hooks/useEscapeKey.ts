import { useEffect, useRef } from "react";

type Handler = { current: () => void };

/**
 * Handlers of every mounted `useEscapeKey`, in mount order. Escape only ever
 * reaches the last one. 
 */
const stack: Handler[] = [];

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (event.isComposing) return;

  const top = stack[stack.length - 1];
  if (!top) return;

  event.preventDefault();
  top.current();
}

/**
 * Listens on the document rather than the modal, so it fires no matter what is
 * focused (typing in the flag input included).
 */
export function useEscapeKey(onEscape: () => void) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    const self = handler;
    stack.push(self);
    if (stack.length === 1) document.addEventListener("keydown", onKeyDown);

    return () => {
      const i = stack.lastIndexOf(self);
      if (i !== -1) stack.splice(i, 1);
      if (stack.length === 0) document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
