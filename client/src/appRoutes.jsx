import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';

const Landing = lazy(() => import('@/features/marketing/pages/Landing'));
const Login = lazy(() => import('@/features/auth/pages/Login'));
const Register = lazy(() => import('@/features/auth/pages/Register'));
const Profile = lazy(() => import('@/features/auth/pages/Profile'));
const Dashboard = lazy(() => import('@/features/dashboard/pages/Dashboard'));
const Problems = lazy(() => import('@/features/problems/pages/Problems'));
const Groups = lazy(() => import('@/features/groups/pages/Groups'));
const GroupDetail = lazy(() => import('@/features/groups/pages/GroupDetail'));

const PageFallback = () => (
  <div className="flex items-center justify-center gap-2 min-h-[50vh] text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" />
    Loading...
  </div>
);

const AppRoutes = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/problems" element={
        <ProtectedRoute><Problems /></ProtectedRoute>
      } />
      <Route path="/groups" element={
        <ProtectedRoute><Groups /></ProtectedRoute>
      } />
      <Route path="/groups/:id" element={
        <ProtectedRoute><GroupDetail /></ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute><Profile /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;
