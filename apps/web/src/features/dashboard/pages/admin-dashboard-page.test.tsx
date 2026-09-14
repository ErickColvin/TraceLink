import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDashboardOverview } from "../data/mock-dashboard";
import { dashboardService } from "../services";
import { AdminDashboardPage } from "./admin-dashboard-page";

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminDashboardPage", () => {
  it("exposes each sales bar as a named list item", async () => {
    vi.spyOn(dashboardService, "getOverview").mockResolvedValue(
      mockDashboardOverview,
    );

    renderDashboard();

    const trend = await screen.findByRole("list", {
      name: "Ventas de los últimos siete días",
    });
    const points = within(trend).getAllByRole("listitem");

    expect(points).toHaveLength(mockDashboardOverview.salesTrend.length);
    expect(points[0]).toHaveAccessibleName(/pedidos/i);
    expect(points[0]).toHaveAccessibleName(/23-ago/i);
  });

  it("renders explicit empty states for trends and alerts", async () => {
    vi.spyOn(dashboardService, "getOverview").mockResolvedValue({
      ...mockDashboardOverview,
      salesTrend: [],
      alerts: [],
    });

    renderDashboard();

    expect(
      await screen.findByText("Aún no hay ventas para graficar"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin alertas pendientes")).toBeInTheDocument();
  });
});
