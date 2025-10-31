import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute, PublicRoute } from './ProtectedRoute';

import Login from './login';
import Home from './home';
import Register from './register';
import AnswerKey from './answerKey';
import AnswerSheet from './answerSheet';
import GradeReport from './gradeReport';
import Setting from './setting';
import Admin from './admin';
import AdminSetting from './adminsetting';
import Offline from './Offline';

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* Protected Teacher Routes */}
        <Route
          path="/home"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/answerKey"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <AnswerKey />
            </ProtectedRoute>
          }
        />
        <Route
          path="/answerSheet"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <AnswerSheet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gradeReport"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <GradeReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setting"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Setting />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Routes */}
        <Route
          path="/admin-home"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adminsetting"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSetting />
            </ProtectedRoute>
          }
        />

        {/* Offline Route */}
        <Route path="/offline" element={<Offline />} />

        {/* Catch-all redirect to login */}
        <Route
          path="*"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
};

export default App;
