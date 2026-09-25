import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem("skillswap_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("skillswap_token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("skillswap_token", data.token);
    await loadUser();
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("skillswap_token", data.token);
    await loadUser();
    return data;
  };

  // Separate expert/teacher sign-up flow: qualification + experience required,
  // certificate optional. Account is created with pending admin verification.
  const registerExpert = async ({ name, email, password, qualification, experience, certificateUrl }) => {
    const { data } = await api.post("/auth/register-expert", {
      name,
      email,
      password,
      qualification,
      experience,
      certificateUrl,
    });
    localStorage.setItem("skillswap_token", data.token);
    await loadUser();
    return data;
  };

  const logout = () => {
    localStorage.removeItem("skillswap_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, registerExpert, logout, reload: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
