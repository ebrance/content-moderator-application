import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import VerifyCodePage from './components/VerifyCodePage';
import ModeratorApp from './components/ModeratorApp';
import { cognitoService } from './services/cognitoService';
import './styles/index.css';

// All possible views before authentication
const AUTH_VIEW = {
  LOGIN:  'login',
  SIGNUP: 'signup',
  VERIFY: 'verify',   // email verification code step
};

function App() {
  const [user, setUser]         = useState(null);
  const [authView, setAuthView] = useState(AUTH_VIEW.LOGIN);
  const [loading, setLoading]   = useState(true);

  // Holds email + password temporarily so VerifyCodePage can
  // auto sign-in after successful verification without asking again
  const [pendingAuth, setPendingAuth] = useState({ email: '', password: '' });

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

  const handleLoginSuccess = (userData) => setUser(userData);

  // After sign-up, store credentials and navigate to verify screen
  const handleSignUpPending = (email, password) => {
    setPendingAuth({ email, password });
    setAuthView(AUTH_VIEW.VERIFY);
  };

  // After verification + auto sign-in
  const handleVerifySuccess = (userData) => {
    setPendingAuth({ email: '', password: '' });
    setUser(userData);
  };

  const handleLogout = async () => {
    await cognitoService.signOut();
    setUser(null);
    setPendingAuth({ email: '', password: '' });
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

  if (authView === AUTH_VIEW.VERIFY) {
    return (
      <VerifyCodePage
        email={pendingAuth.email}
        password={pendingAuth.password}
        onVerifySuccess={handleVerifySuccess}
        onGoToLogin={() => {
          setPendingAuth({ email: '', password: '' });
          setAuthView(AUTH_VIEW.LOGIN);
        }}
      />
    );
  }

  if (authView === AUTH_VIEW.SIGNUP) {
    return (
      <SignUpPage
        onSignUpPending={handleSignUpPending}
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
