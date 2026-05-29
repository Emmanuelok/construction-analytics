import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { StudioProvider } from './store/studio'
import { AuthProvider } from './store/auth'
import { ProfileProvider } from './store/profile'
import { WorkspacesProvider } from './store/workspaces'
import { ThemeProvider } from './store/theme'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <StudioProvider>
            <WorkspacesProvider>
              <RouterProvider router={router} />
            </WorkspacesProvider>
          </StudioProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
