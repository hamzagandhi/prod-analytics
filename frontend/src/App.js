import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import './App.css';

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
