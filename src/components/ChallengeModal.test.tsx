import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getChallengeSolves } from "../api/rctf";
import { ChallengeModal } from "./ChallengeModal";

vi.mock("../api/rctf", () => ({
  challengeFileUrl: (url: string) => `https://rctf.example${url}`,
  getChallengeSolves: vi.fn(async () => []),
  submitFlag: vi.fn(async () => ({ correct: false, alreadySolved: false, message: "" })),
}));

function renderModal(props: Partial<Parameters<typeof ChallengeModal>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChallengeModal
        challengeId="crypto-baby_xor"
        challengeName="Baby XOR"
        category="crypto"
        description="Can you decrypt the flag?"
        onClose={() => {}}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("ChallengeModal attachments", () => {
  it("renders a download link per file, resolved against the rCTF origin", () => {
    renderModal({
      files: [
        { name: "encode.py", url: "/uploads/abc123/encode.py", size: 512 },
        { name: "flag.enc", url: "/uploads/def456/flag.enc", size: 2048 },
      ],
    });

    const encode = screen.getByText("encode.py").closest("a");
    expect(encode).not.toBeNull();
    expect(encode?.getAttribute("href")).toBe("https://rctf.example/uploads/abc123/encode.py");
    // `download` makes the browser save it rather than navigate, and rCTF
    // already sends content-disposition: attachment.
    expect(encode?.getAttribute("download")).toBe("encode.py");

    expect(screen.getByText("flag.enc").closest("a")?.getAttribute("href")).toBe(
      "https://rctf.example/uploads/def456/flag.enc",
    );
  });

  it("shows the size next to each file", () => {
    renderModal({ files: [{ name: "chal", url: "/uploads/a/chal", size: 2048 }] });
    expect(screen.getByText("2.0 KiB")).toBeDefined();
  });

  it("omits the size when rCTF recorded none", () => {
    renderModal({ files: [{ name: "chal", url: "/uploads/a/chal", size: null }] });
    expect(screen.getByText("chal").closest("a")?.textContent).toBe("chal");
  });

  it("pluralises the label and counts the files", () => {
    renderModal({ files: [{ name: "a", url: "/uploads/a/a", size: 1 }] });
    expect(screen.getByText("ATTACHMENT")).toBeDefined();
  });

  it("counts when there are several", () => {
    renderModal({
      files: [
        { name: "a", url: "/uploads/a/a", size: 1 },
        { name: "b", url: "/uploads/b/b", size: 1 },
      ],
    });
    expect(screen.getByText("ATTACHMENTS (2)")).toBeDefined();
  });

  it("renders no attachment section for a challenge with no files", () => {
    renderModal({ files: [] });
    expect(screen.queryByText("ATTACHMENT")).toBeNull();
    expect(screen.queryByText(/^ATTACHMENTS/)).toBeNull();
  });

  it("survives a challenge list that omits files entirely", () => {
    // The dev mock does not serve v2 yet, so `files` can be undefined.
    renderModal();
    expect(screen.queryByText("ATTACHMENT")).toBeNull();
    expect(screen.getByText("Can you decrypt the flag?")).toBeDefined();
  });
});

describe("ChallengeModal solvers", () => {
  const BLOOD = "\u{1FA78}";

  function renderSolvers(solves: unknown[]) {
    vi.mocked(getChallengeSolves).mockResolvedValueOnce(
      solves as Awaited<ReturnType<typeof getChallengeSolves>>,
    );
    renderModal();
    fireEvent.click(screen.getByText("SOLVERS"));
  }

  it("marks the blood from rCTF's bloodIndex, not from the row's position", async () => {
    // The blood arriving second in the list is the case that matters: reading
    // position instead would hand the drop to `runner_up`.
    renderSolvers([
      { solveId: "s1", teamId: "t8", name: "runner_up", createdAt: 2000, bloodIndex: 1 },
      { solveId: "s2", teamId: "t7", name: "n1ght0wl", createdAt: 1000, bloodIndex: 0 },
    ]);

    const blooded = await screen.findByText("n1ght0wl");
    expect(blooded.closest("tr")?.textContent).toContain(BLOOD);
    expect(screen.getByText("runner_up").closest("tr")?.textContent).not.toContain(BLOOD);
  });

  it("marks nobody when no row carries a bloodIndex", async () => {
    renderSolvers([
      { solveId: "s1", teamId: "t7", name: "n1ght0wl", createdAt: 1000, bloodIndex: null },
    ]);

    await screen.findByText("n1ght0wl");
    expect(screen.queryByText(BLOOD)).toBeNull();
    // Still ranked, just not crowned.
    expect(screen.getByText("#1")).toBeDefined();
  });
});
