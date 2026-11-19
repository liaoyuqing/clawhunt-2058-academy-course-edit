import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './routes.tsx';

const router = createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
