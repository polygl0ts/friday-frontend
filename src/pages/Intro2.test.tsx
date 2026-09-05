import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Intro2 } from "./Intro2";
import type { Intro2Step, Intro2Track } from "../types";

const getIntro2Tracks = vi.fn<() => Promise<Intro2Track[]>>();

vi.mock("../api/extras", () => ({
  getIntro2Tracks: () => getIntro2Tracks(),
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
    category: "web",
    files: [],
    ...over,
  };
}

function track(category: string, steps: Intro2Step[]): Intro2Track {
  return { category, steps };
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
  getIntro2Tracks.mockReset();
});

describe("Intro2 track", () => {
  it("opens the challenge modal on the in-progress step, with a flag box", async () => {
    getIntro2Tracks.mockResolvedValue([track("web", [step()])]);
    renderPage();

    const card = await screen.findByRole("button", { name: /Your First Flag/ });
    fireEvent.click(card);

    expect(await screen.findByText("SUBMIT FLAG")).toBeDefined();
    expect(screen.getByPlaceholderText("friday{}")).toBeDefined();
  });

  it("drops focus when a step is opened by mouse, so no ring lingers on the card", async () => {
    getIntro2Tracks.mockResolvedValue([track("web", [step()])]);
    renderPage();

    const card = await screen.findByRole("button", { name: /Your First Flag/ });
    fireEvent.click(card);

    await screen.findByText("SUBMIT FLAG");
    expect(document.activeElement).not.toBe(card);
  });

  it("shows the step's attachments in the modal", async () => {
    getIntro2Tracks.mockResolvedValue([
      track("web", [step({ files: [{ name: "cookie.txt", url: "/uploads/abc/cookie.txt", size: 33 }] })]),
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Your First Flag/ }));

    const link = (await screen.findByText("cookie.txt")).closest("a");
    expect(link?.getAttribute("href")).toBe("https://rctf.example/uploads/abc/cookie.txt");
  });

  it("reopens a completed step so it can be reviewed", async () => {
    getIntro2Tracks.mockResolvedValue([track("web", [step({ status: "done" })])]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Your First Flag/ }));
    expect(await screen.findByText("SUBMIT FLAG")).toBeDefined();
  });

  it("keeps a locked step closed, so the guided order still means something", async () => {
    getIntro2Tracks.mockResolvedValue([
      track("web", [step({ challenge_id: "i2", step: 2, title: "Inspect Element", status: "locked" })]),
    ]);
    renderPage();

    const title = await screen.findByText("Inspect Element");
    expect(screen.queryByRole("button", { name: /Inspect Element/ })).toBeNull();

    fireEvent.click(title);
    // No modal: the flag box never appears.
    await waitFor(() => expect(screen.queryByText("SUBMIT FLAG")).toBeNull());
    expect(screen.getByText("FINISH THE PREVIOUS STEP FIRST")).toBeDefined();
  });

  it("stacks one section per category, headed and ordered like the challenge page", async () => {
    getIntro2Tracks.mockResolvedValue([
      // Alphabetical, the way the backend sends them.
      track("crypto", [step({ challenge_id: "c1", title: "Base What?" })]),
      track("pwn", [step({ challenge_id: "p1", title: "Stack Smash" })]),
      track("web", [step({ challenge_id: "w1", title: "Inspect Element" })]),
    ]);
    const { container } = renderPage();

    await screen.findByText("Stack Smash");

    const headings = [...container.querySelectorAll(".category-heading-name")].map(
      (el) => el.textContent,
    );
    expect(headings).toEqual(["PWN", "WEB", "CRYPTO"]);

    // Every track is on screen at once - no tab hides one.
    expect(screen.getByText("Base What?")).toBeDefined();
    expect(screen.getByText("Inspect Element")).toBeDefined();

    // The rule between sections is the challenge page's, and never leads.
    const sections = container.querySelectorAll(".category-section");
    expect(sections.length).toBe(3);
    expect(sections[0].classList.contains("category-section-split")).toBe(false);
    expect(sections[1].classList.contains("category-section-split")).toBe(true);
  });

  it("meters each track on its own, not on all of INTRO2", async () => {
    getIntro2Tracks.mockResolvedValue([
      track("pwn", [
        step({ challenge_id: "p1", status: "done" }),
        step({ challenge_id: "p2", step: 2, status: "done" }),
        step({ challenge_id: "p3", step: 3, status: "in_progress" }),
      ]),
      track("web", [step({ challenge_id: "w1", status: "in_progress" })]),
    ]);
    const { container } = renderPage();

    await screen.findByText("2 / 3");
    // pwn's two solves must not fill web's bar.
    expect(screen.getByText("0 / 1")).toBeDefined();

    const fills = [...container.querySelectorAll(".meter-fill")].map(
      (el) => (el as HTMLElement).style.width,
    );
    expect(fills).toEqual([`${(2 / 3) * 100}%`, "0%"]);
  });

  it("says so when no track has any steps", async () => {
    getIntro2Tracks.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No INTRO2 challenges configured yet.")).toBeDefined();
  });
});
