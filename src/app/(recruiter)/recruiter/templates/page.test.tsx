import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TemplatesPage from "./page";

const {
    fetchTemplatesMock,
    deleteTemplateActionMock,
    updateTemplateNameActionMock,
} = vi.hoisted(() => ({
    fetchTemplatesMock: vi.fn(),
    deleteTemplateActionMock: vi.fn(),
    updateTemplateNameActionMock: vi.fn(),
}));

vi.mock("./actions", () => ({
    fetchTemplates: fetchTemplatesMock,
    deleteTemplateAction: deleteTemplateActionMock,
    updateTemplateNameAction: updateTemplateNameActionMock,
}));

describe("TemplatesPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("confirm", vi.fn(() => true));
        fetchTemplatesMock.mockResolvedValue({
            recruiterId: "recruiter-1",
            isAdmin: false,
            templates: [
                {
                    id: "template-1",
                    recruiterId: "recruiter-1",
                    name: "Warehouse Interview",
                    isShared: true,
                    targetRole: "Warehouse Associate",
                    questions: { star: [{ id: "s1", text: "Tell me about safety.", category: "STAR", label: "Safety" }], perma: [], technical: [] },
                    createdAt: "2026-03-20T10:00:00.000Z",
                    updatedAt: "2026-03-20T10:00:00.000Z",
                },
                {
                    id: "template-2",
                    recruiterId: "recruiter-2",
                    name: "Engineering Screen",
                    isShared: false,
                    targetRole: "QA Engineer",
                    questions: { star: [], perma: [{ id: "p1", text: "What motivates you?", category: "PERMA", label: "Meaning" }], technical: [] },
                    createdAt: "2026-03-21T10:00:00.000Z",
                    updatedAt: "2026-03-21T10:00:00.000Z",
                },
            ],
        });
        deleteTemplateActionMock.mockResolvedValue({ success: true });
        updateTemplateNameActionMock.mockResolvedValue({ success: true });
    });

    it("filters templates by search query", async () => {
        const user = userEvent.setup();

        render(<TemplatesPage />);

        expect(await screen.findByText("Warehouse Interview")).toBeInTheDocument();
        expect(screen.getByText("Engineering Screen")).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText("Search by template name or role..."), "warehouse");

        expect(screen.getByText("Warehouse Interview")).toBeInTheDocument();
        expect(screen.queryByText("Engineering Screen")).not.toBeInTheDocument();
    });

    it("allows an owned template to be renamed", async () => {
        const user = userEvent.setup();

        render(<TemplatesPage />);

        await user.click(await screen.findByRole("button", { name: "Edit name" }));

        const input = screen.getByDisplayValue("Warehouse Interview");
        await user.clear(input);
        await user.type(input, "Warehouse Hiring Pack");
        await user.keyboard("{Enter}");

        await waitFor(() => {
            expect(updateTemplateNameActionMock).toHaveBeenCalledWith("template-1", "Warehouse Hiring Pack");
        });

        expect(await screen.findByText("Template name updated.")).toBeInTheDocument();
    });

    it("deletes an owned template after confirmation", async () => {
        const user = userEvent.setup();

        render(<TemplatesPage />);

        const deleteButton = await screen.findByRole("button", { name: "" });

        await user.click(deleteButton);

        await waitFor(() => {
            expect(deleteTemplateActionMock).toHaveBeenCalledWith("template-1");
        });

        expect(await screen.findByText("Template deleted.")).toBeInTheDocument();
        expect(screen.queryByText("Warehouse Interview")).not.toBeInTheDocument();
    });
});
