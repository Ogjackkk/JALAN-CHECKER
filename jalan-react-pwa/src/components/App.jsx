import React from 'react';
import { Routes, Route } from 'react-router-dom';
import GradeReport from './gradeReport';
import SignUp from './signup';
import Register from './register';
import Login from './login';
import Home from './home';
import AnswerKey from './answerKey';
import AnswerSheet from './answerSheet';
import Setting from './setting';
import Admin from './admin';
import AdminSetting from './adminsetting';
import ForgotPasswordModal from './ForgotPasswordModal';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<SignUp />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/gradeReport" element={<GradeReport />} />
      <Route path="/answerKey" element={<AnswerKey />} />
      <Route path="/answerSheet" element={<AnswerSheet />} />
      <Route path="/setting" element={<Setting />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin-setting" element={<AdminSetting />} />
      <Route path="/forgot-password" element={<ForgotPasswordModal />} />
    </Routes>
  );
};

export default App;