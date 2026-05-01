import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import ModeratorApp from './components/ModeratorApp';
import { cognitoService } from './services/cognitoService';
import './styles/index.css';

// Possible views before authentication
const AUTH_VIEW = { LOGIN: 'login', SIGNUP: 'signup' };

function App() {
  const [user, setUser]           = useState(null);
  const [authView, setAuthView]   = useState(AUTH_VIEW.LOGIN);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await cognitoService.getCurrentUser();
        if (currentUser) setUser(currentUser);
      } catch (err) {
        // No active session
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLoginSuccess  = (userData) => setUser(userData);
  const handleSignUpSuccess = (userData) => setUser(userData);
  const handleLogout = async () => {
    await cognitoService.signOut();
    setUser(null);
    setAuthView(AUTH_VIEW.LOGIN);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (user) {
    return <ModeratorApp user={user} onLogout={handleLogout} />;
  }

  if (authView === AUTH_VIEW.SIGNUP) {
    return (
      <SignUpPage
        onSignUpSuccess={handleSignUpSuccess}
        onGoToLogin={() => setAuthView(AUTH_VIEW.LOGIN)}
      />
    );
  }

  return (
    <LoginPage
      onLoginSuccess={handleLoginSuccess}
      onGoToSignUp={() => setAuthView(AUTH_VIEW.SIGNUP)}
    />
  );
}

export default App;
