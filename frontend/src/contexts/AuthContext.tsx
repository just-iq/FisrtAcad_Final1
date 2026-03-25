import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthUser, setAuthUser, logout as authLogout, primaryRole, type AuthUser } from "@/lib/auth";
import { api, setToken, clearToken } from "@/lib/api";

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT = 30 * 60 * 1000;
// Warning before timeout: 2 minutes
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000;

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    currentRole: string;
    availableRoles: string[];
    isAuthenticated: boolean;
    isLoading: boolean;
    sessionWarning: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    switchRole: (role: string) => void;
    refreshSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const pathByRole: Record<string, string> = {
    ADMIN: "/admin",
    LECTURER: "/lecturer",
    STUDENT_EXEC: "/student-executive",
    COURSE_REP: "/course-rep",
    STUDENT: "/dashboard"
};

export function homePathForRole(role: string) {
    return pathByRole[role] || "/dashboard";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setTokenState] = useState<string | null>(null);
    const [currentRole, setCurrentRole] = useState<string>("STUDENT");
    const [isLoading, setIsLoading] = useState(true);
    const [sessionWarning, setSessionWarning] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());

    // Initialize auth state from localStorage
    useEffect(() => {
        const initAuth = async () => {
            try {
                const storedToken = localStorage.getItem("access_token");
                const storedUser = getAuthUser();
                const storedRole = localStorage.getItem("currentRole");

                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setTokenState(storedToken);
                    setUser(storedUser);
                    setCurrentRole(storedRole || primaryRole(storedUser.roles));
                }
            } catch (error) {
                console.error("Auth initialization error:", error);
                handleLogout();
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    // Session timeout management
    useEffect(() => {
        if (!user) return;

        const checkSession = () => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity;

            if (timeSinceLastActivity >= SESSION_TIMEOUT) {
                // Session expired
                handleLogout();
                alert("Your session has expired due to inactivity. Please login again.");
            } else if (timeSinceLastActivity >= SESSION_TIMEOUT - WARNING_BEFORE_TIMEOUT) {
                // Show warning
                setSessionWarning(true);
            } else {
                setSessionWarning(false);
            }
        };

        const interval = setInterval(checkSession, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [user, lastActivity]);

    // Track user activity
    useEffect(() => {
        if (!user) return;

        const activities = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

        const handleActivity = () => {
            setLastActivity(Date.now());
            setSessionWarning(false);
        };

        activities.forEach(activity => {
            window.addEventListener(activity, handleActivity);
        });

        return () => {
            activities.forEach(activity => {
                window.removeEventListener(activity, handleActivity);
            });
        };
    }, [user]);

    const handleLogin = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const res = await api.login(email, password);

            console.log("Login response:", res);

            // Store token
            const accessToken = res.access_token;
            setToken(accessToken);
            setTokenState(accessToken);
            localStorage.setItem("access_token", accessToken);

            // Store user
            const userData: AuthUser = res.user;
            setAuthUser(userData);

            // Determine and store current role FIRST
            const role = primaryRole(userData.roles);
            console.log("User roles:", userData.roles);
            console.log("Primary role determined:", role);

            localStorage.setItem("currentRole", role);

            // Update state synchronously
            setUser(userData);
            setCurrentRole(role);
            setLastActivity(Date.now());

            // Set loading to false BEFORE navigation so RoleBasedRoute can properly check access
            setIsLoading(false);

            // Navigate to appropriate dashboard AFTER state is set
            const targetPath = homePathForRole(role);
            console.log("Navigating to:", targetPath);
            navigate(targetPath);
        } catch (error) {
            console.error("Login error:", error);
            setIsLoading(false);
            throw error;
        }
    };

    const handleLogout = useCallback(() => {
        authLogout();
        clearToken();
        setUser(null);
        setTokenState(null);
        setCurrentRole("STUDENT");
        setSessionWarning(false);
        navigate("/login");
    }, [navigate]);

    const switchRole = useCallback((role: string) => {
        if (!user) return;

        // Allow switching to STUDENT for higher roles who implicitly have student access
        const hasAccess = user.roles.includes(role) ||
            (role === "STUDENT" && (user.roles.includes("COURSE_REP") || user.roles.includes("STUDENT_EXEC")));

        if (hasAccess) {
            setCurrentRole(role);
            localStorage.setItem("currentRole", role);

            // Navigate to new role's dashboard
            navigate(homePathForRole(role));
        }
    }, [user, navigate]);

    const refreshSession = useCallback(() => {
        setLastActivity(Date.now());
        setSessionWarning(false);
    }, []);

    const value: AuthContextType = {
        user,
        token,
        currentRole,
        availableRoles: (() => {
            if (!user) return [];
            const unique = new Set(user.roles);
            // Ensure higher roles also have STUDENT access to enable view switching
            if (unique.has("COURSE_REP") || unique.has("STUDENT_EXEC")) {
                unique.add("STUDENT");
            }
            return Array.from(unique);
        })(),
        isAuthenticated: !!user && !!token,
        isLoading,
        sessionWarning,
        login: handleLogin,
        logout: handleLogout,
        switchRole,
        refreshSession,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
