import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEscapeKey } from "./useEscapeKey";

function Listener({ onEscape }: { onEscape: () => void }) {
  useEscapeKey(onEscape);
  return null;
}

const pressEscape = () => fireEvent.keyDown(document, { key: "Escape" });

describe("useEscapeKey", () => {
  it("calls the handler on Escape and ignores other keys", () => {
    const onEscape = vi.fn();
    render(<Listener onEscape={onEscape} />);

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onEscape).not.toHaveBeenCalled();

    pressEscape();
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unmounted", () => {
    const onEscape = vi.fn();
    const { unmount } = render(<Listener onEscape={onEscape} />);

    unmount();
    pressEscape();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("only fires the topmost handler when dialogs are stacked", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(
      <>
        <Listener onEscape={outer} />
        <Listener onEscape={inner} />
      </>,
    );

    pressEscape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    // Inner dialog closes: Escape goes back to the modal underneath it.
    rerender(<Listener onEscape={outer} />);
    pressEscape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("calls the latest handler, not the one from the mounting render", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(<Listener onEscape={stale} />);

    rerender(<Listener onEscape={fresh} />);
    pressEscape();
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});
