import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChallengeWithMeta } from "../types";
import { ChallengeCard } from "./ChallengeCard";

function renderCard(description: string) {
  const challenge: ChallengeWithMeta = {
    id: "baby-xor",
    name: "Baby XOR",
    author: "n1ght0wl",
    category: "crypto",
    description,
    points: 100,
    tags: ["tier/bronze"],
    solves: 0,
    tier: "bronze",
    archived: null,
    juicer: false,
    points_current: 100,
    solved: false,
    solveCount: 0,
    firstBlood: null,
  };

  return render(<ChallengeCard chall={challenge} onOpenDetails={vi.fn()} />);
}

describe("ChallengeCard descriptions", () => {
  it("renders challenge markdown in the clamped preview", () => {
    const { container } = renderCard(
      "Decrypt the **flag**.\n\n- Find the key\n- Decode the ciphertext",
    );

    expect(screen.getByText("flag").tagName).toBe("STRONG");
    expect(container.querySelector(".card-desc-markdown")).not.toBeNull();
    expect(container.querySelectorAll(".card-desc-markdown li")).toHaveLength(2);
  });

  it("keeps an empty description preview empty", () => {
    const { container } = renderCard("");

    expect(container.querySelector(".card-desc-markdown")?.textContent).toBe("");
  });
});
