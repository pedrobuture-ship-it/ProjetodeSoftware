import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { appRoutes } from './routes/appRoutes';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<LoginPage initialMode="signup" />} />
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {appRoutes.map((route) => (
          <Route key={route.path} path={route.path.slice(1)} element={<route.Component />} />
        ))}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
