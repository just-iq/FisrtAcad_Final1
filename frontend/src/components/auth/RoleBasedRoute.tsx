import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function RoleBasedRoute({ requiredRole }: { requiredRole: string }) {
  const { isLoading, isAuthenticated, currentRole } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Access is granted only when the active role matches what the route requires.
  // This ensures switching roles actually changes which dashboard is visible.
  const hasAccess = currentRole === requiredRole;

  if (!hasAccess) {
    const pathByRole: Record<string, string> = {
      ADMIN: "/admin",
      LECTURER: "/lecturer",
      STUDENT_EXEC: "/student-executive",
      COURSE_REP: "/course-rep",
      STUDENT: "/dashboard"
    };
    return <Navigate to={pathByRole[currentRole] || "/dashboard"} replace />;
  }

  return <Outlet />;
}

