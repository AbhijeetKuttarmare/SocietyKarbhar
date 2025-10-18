import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Superadmin from './pages/Superadmin'
import Admin from './pages/Admin'
import Owner from './pages/Owner'
import Tenant from './pages/Tenant'

function App(){
  return (
    <BrowserRouter>
      <Routes>
  <Route path='/' element={<Home/>} />
  <Route path='/login' element={<Login/>} />
  <Route path='/superadmin' element={<Superadmin/>} />
  <Route path='/admin' element={<Admin/>} />
  <Route path='/owner' element={<Owner/>} />
  <Route path='/tenant' element={<Tenant/>} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
