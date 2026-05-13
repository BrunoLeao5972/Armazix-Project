import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const navigate = useNavigate();
  navigate({ to: "/admin/dashboard", replace: true });
  return null;
}
