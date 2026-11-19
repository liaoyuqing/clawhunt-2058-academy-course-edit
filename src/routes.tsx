import type { RouteObject } from 'react-router-dom';
import CourseEditPage from './pages/academy/course-edit/CourseEditPage.tsx';
import CourseListPage from './pages/academy/course-edit/CourseListPage.tsx';

/**
 * 路由表。用数据路由（createBrowserRouter / createMemoryRouter）挂载，
 * 页面内的 useBlocker 才能在"真实路由跳转"上生效，而不是只拦页面自己的返回按钮。
 */
export const routes: RouteObject[] = [
  { path: '/', element: <CourseListPage /> },
  { path: '/academy/courses', element: <CourseListPage /> },
  { path: '/academy/courses/new', element: <CourseEditPage /> },
  { path: '/academy/courses/:id/edit', element: <CourseEditPage /> },
];
