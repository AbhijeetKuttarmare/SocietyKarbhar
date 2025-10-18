import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const Login: React.FC = () => {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [useOtp, setUseOtp] = useState(false)
  const [sentOtp, setSentOtp] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try{
      if(useOtp){
        if(!sentOtp){
          // request OTP
          await axios.post('/api/auth/otp/request', { phone })
          setSentOtp(true)
          return
        }
        // verify OTP
        const res = await axios.post('/api/auth/otp/verify', { phone, code: otpCode })
        localStorage.setItem('token', res.data.token)
        // redirect based on role
        const role = res.data.user?.role
        if(role === 'superadmin') nav('/superadmin')
        else if(role === 'admin') nav('/admin')
        else if(role === 'owner') nav('/owner')
        else if(role === 'tenant') nav('/tenant')
        else nav('/')
        return
      }
      const res = await axios.post('/api/auth/login', { phone, password })
      localStorage.setItem('token', res.data.token)
      const role = res.data.user?.role
      if(role === 'superadmin') nav('/superadmin')
      else if(role === 'admin') nav('/admin')
      else if(role === 'owner') nav('/owner')
      else if(role === 'tenant') nav('/tenant')
      else nav('/')
    }catch(err){
      alert('Login failed')
    }
  }

  return <div style={{ padding: 24 }}>
    <h2>Login</h2>
    <form onSubmit={submit}>
      <div>
        <label>Phone</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} />
      </div>
      <div>
        <label>Password</label>
        <input type='password' value={password} onChange={e=>setPassword(e.target.value)} disabled={useOtp} />
      </div>
      <div>
        <label>
          <input type='checkbox' checked={useOtp} onChange={e=>setUseOtp(e.target.checked)} /> Use OTP
        </label>
      </div>
      <button type='submit'>Login</button>
    </form>
  </div>
}

export default Login
