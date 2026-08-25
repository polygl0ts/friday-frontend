import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Intro2 } from "./Intro2";
import type { Intro2Step } from "../types";

const getIntro2Track = vi.fn<() => Promise<Intro2Step[]>>();

vi.mock("../api/extras", () => ({
  getIntro2Track: () => getIntro2Track(),
}));
vi.mock("../api/rctf", () => ({
  challengeFileUrl: (url: string) => `https://rctf.example${url}`,
  getChallengeSolves: vi.fn(async () => []),
  submitFlag: vi.fn(async () => ({ correct: false, alreadySolved: false, message: "" })),
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true }),
}));

function step(over: Partial<Intro2Step> = {}): Intro2Step {
  return {
    challenge_id: "i1",
    step: 1,
    title: "Your First Flag",
    description: "Find the flag format and submit it.",
    status: "in_progress",
    category: "intro",
    files: [],
    ...over,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Intro2 />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getIntro2Track.mockReset();
});

describe("Intro2 track", () => {
  it("opens the challenge modal on the in-progress step, with a flag box", async () => {
    getIntro2Track.mockResolvedValue([step()]);
    renderPage();

    const card = await screen.findByRole("button", { name: /Your First Flag/ });
    fireEvent.click(card);

    expect(await screen.findByText("SUBMIT FLAG")).toBeDefined();
    expect(screen.getByPlaceholderText("friday{}")).toBeDefined();
  });

  it("shows the step's attachments in the modal", async () => {
    getIntro2Track.mockResolvedValue([
      step({ files: [{ name: "cookie.txt", url: "/uploads/abc/cookie.txt", size: 33 }] }),
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Your First Flag/ }));

    const link = (await screen.findByText("cookie.txt")).closest("a");
    expect(link?.getAttribute("href")).toBe("https://rctf.example/uploads/abc/cookie.txt");
  });

  it("reopens a completed step so it can be reviewed", async () => {
    getIntro2Track.mockResolvedValue([step({ status: "done" })]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Your First Flag/ }));
    expect(await screen.findByText("SUBMIT FLAG")).toBeDefined();
  });

  it("keeps a locked step closed, so the guided order still means something", async () => {
    getIntro2Track.mockResolvedValue([
      step({ challenge_id: "i2", step: 2, title: "Inspect Element", status: "locked" }),
    ]);
    renderPage();

    const title = await screen.findByText("Inspect Element");
    expect(screen.queryByRole("button", { name: /Inspect Element/ })).toBeNull();

    fireEvent.click(title);
    // No modal: the flag box never appears.
    await waitFor(() => expect(screen.queryByText("SUBMIT FLAG")).toBeNull());
    expect(screen.getByText("FINISH THE PREVIOUS STEP FIRST")).toBeDefined();
  });

  it("still renders the progress summary", async () => {
    getIntro2Track.mockResolvedValue([
      step({ status: "done" }),
      step({ challenge_id: "i2", step: 2, title: "Inspect Element", status: "in_progress" }),
    ]);
    renderPage();

    expect(await screen.findByText("Your First Flag")).toBeDefined();
    expect(screen.getByText("Inspect Element")).toBeDefined();
  });
});
