import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleBasedRoute } from "@/components/auth/RoleBasedRoute";
import { OfflineIndicator, OnlineIndicator } from "@/components/ui/offline-indicator";
import { offlineApi } from "@/lib/offlineApi";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Announcements from "./pages/Announcements";
import Timetable from "./pages/Timetable";
import Assignments from "./pages/Assignments";
import Notifications from "./pages/Notifications";
import Chat from "./pages/Chat";
import AdminDashboard from "./pages/AdminDashboard";
import LecturerDashboard from "./pages/LecturerDashboard";
import CourseRepDashboard from "./pages/CourseRepDashboard";
import StudentExecutiveDashboard from "./pages/StudentExecutiveDashboard";
import NotFound from "./pages/NotFound";
import DirectMessages from "./pages/DirectMessages";
import Profile from "./pages/Profile";

// Initialize offline functionality
offlineApi.init().catch(console.error);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <div className="min-h-screen bg-background">
        <OfflineIndicator className="fixed top-0 left-0 right-0 z-50" />
        <OnlineIndicator className="fixed top-0 left-0 right-0 z-50" />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Authenticated area */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleBasedRoute requiredRole="STUDENT" />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                </Route>
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/assignments" element={<Assignments />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/messages" element={<DirectMessages />} />
                <Route path="/profile" element={<Profile />} />

                <Route element={<RoleBasedRoute requiredRole="ADMIN" />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>
                <Route element={<RoleBasedRoute requiredRole="LECTURER" />}>
                  <Route path="/lecturer" element={<LecturerDashboard />} />
                </Route>
                <Route element={<RoleBasedRoute requiredRole="COURSE_REP" />}>
                  <Route path="/course-rep" element={<CourseRepDashboard />} />
                </Route>
                <Route element={<RoleBasedRoute requiredRole="STUDENT_EXEC" />}>
                  <Route path="/student-executive" element={<StudentExecutiveDashboard />} />
                </Route>
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
