import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { StudioProvider } from './store/studio'
import { AuthProvider } from './store/auth'
import { ProfileProvider } from './store/profile'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ProfileProvider>
        <StudioProvider>
          <RouterProvider router={router} />
        </StudioProvider>
      </ProfileProvider>
    </AuthProvider>
  </React.StrictMode>,
)
