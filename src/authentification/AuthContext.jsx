import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  api,
  getStoredToken,
  storeToken,
  clearStoredToken,
} from './AxiosConfig.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null);

  const [token, setToken] = useState(
    () => getStoredToken()
  );

  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {

    const verifySession = async () => {

      if (!token) {
        setLoading(false);
        return;
      }

      try {

        const res = await api.get('/auth/me');

        setUser(res.data.user);

      } catch (error) {

        clearStoredToken();
        setToken(null);
        setUser(null);

      } finally {

        setLoading(false);

      }
    };

    verifySession();

  }, [token]);

  const login = useCallback(
    async (email, password) => {

      const res = await api.post(
        '/auth/login',
        {
          email,
          password,
        }
      );

      const {
        token: newToken,
        user: userData,
      } = res.data;

      storeToken(newToken);

      setToken(newToken);
      setUser(userData);

      return userData;
    },
    []
  );

  const register = useCallback(
    async (
      username,
      email,
      password,
      role
    ) => {

      const payload = {
        username,
        email,
        password,
      };

      if (role) {
        payload.role = role;
      }

      const res = await api.post(
        '/auth/register',
        payload
      );

      const {
        token: newToken,
        user: userData,
      } = res.data;

      storeToken(newToken);

      setToken(newToken);
      setUser(userData);

      return userData;
    },
    []
  );

  const hasRole = useCallback(
    (...roles) => {
      return user
        ? roles.includes(user.role)
        : false;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {

  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth doit être utilisé dans un AuthProvider'
    );
  }

  return context;
}