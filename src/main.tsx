import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { StudioProvider } from './store/studio'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StudioProvider>
      <RouterProvider router={router} />
    </StudioProvider>
  </React.StrictMode>,
)
