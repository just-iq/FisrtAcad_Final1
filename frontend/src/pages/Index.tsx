import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, homePathForRole } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, currentRole } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    navigate(homePathForRole(currentRole));
  }, [navigate, isAuthenticated, isLoading, currentRole]);

  return null;
};

export default Index;
