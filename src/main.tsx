import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import './i18n'
import { AuthProvider } from './contexts/AuthContext'
import { GlobalSettingsProvider } from './contexts/GlobalSettingsContext'
import { StudentPhotosProvider } from './contexts/StudentPhotosContext'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <GlobalSettingsProvider>
        <StudentPhotosProvider>
          <RouterProvider router={router} />
        </StudentPhotosProvider>
      </GlobalSettingsProvider>
    </AuthProvider>
  </StrictMode>,
)
