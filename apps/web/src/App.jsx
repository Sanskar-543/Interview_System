import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import CreatePasswordPage from './pages/CreatePasswordPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import InterviewSetupPage from './pages/InterviewSetupPage';
import InterviewRoomPage from './pages/InterviewRoomPage';
import ReportPage from './pages/ReportPage';
import ProfilePage from './pages/ProfilePage';
import BillingPage from './pages/BillingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/create-password" element={<CreatePasswordPage />} />
      </Route>

      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/interview" element={<InterviewSetupPage />} />
      </Route>

      <Route path="/interview/:id" element={<InterviewRoomPage />} />
      <Route path="/report/:id" element={<ReportPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/billing" element={<BillingPage />} />

      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
