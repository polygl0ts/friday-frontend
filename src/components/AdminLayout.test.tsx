import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminLayout } from "./AdminLayout";

/**
 * The admin section is one guarded parent route with a subpanel per child, so
 * what is worth pinning is the frame itself: that a child renders through the
 * outlet, that the title is not duplicated by it, and that the tab strip marks
 * the panel actually open - `/admin` is a prefix of every other panel's path,
 * so OVERVIEW needs `end` or it never stops looking active.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>overview panel</div>} />
          <Route path="challs" element={<div>challenges panel</div>} />
          <Route path="teams" element={<div>teams panel</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function activeTab(): string | null {
  return document.querySelector(".admin-tabs .pill.active")?.textContent ?? null;
}

describe("AdminLayout", () => {
  it("renders the open subpanel inside the shared frame", () => {
    renderAt("/admin/challs");

    expect(screen.getByText("challenges panel")).toBeTruthy();
    // One title for the whole section, owned by the layout - not one per panel.
    expect(screen.getAllByText("ADMIN")).toHaveLength(1);
  });

  it("marks only the panel that is open", () => {
    renderAt("/admin");
    expect(activeTab()).toBe("OVERVIEW");
  });

  it("does not leave OVERVIEW active on a child panel", () => {
    // Every panel's path starts with /admin, so without `end` the index tab
    // stays lit on all of them and the strip stops meaning anything.
    renderAt("/admin/challs");
    expect(activeTab()).toBe("CHALLENGES");
  });

  it("links every panel by URL, so a row can be linked to", () => {
    renderAt("/admin");

    const hrefs = [...document.querySelectorAll<HTMLAnchorElement>(".admin-tabs a")].map(
      (a) => a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["/admin", "/admin/challs", "/admin/teams"]);
  });
});
