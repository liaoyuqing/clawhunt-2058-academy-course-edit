import React from 'react';
import ReactDOM from 'react-dom/client';
import 'tdesign-react/es/style/index.css';
import './styles/app.css';
import App from './App.tsx';
import { seedMockDb } from './api/courseApi.ts';

// mock 库只在首次加载时灌种子数据；后续刷新沿用已保存的内容，
// 这样"保存 → 刷新 → 顺序仍然正确"能真实复现。
if (!localStorage.getItem('academy.course.db.v1')) {
  seedMockDb();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
