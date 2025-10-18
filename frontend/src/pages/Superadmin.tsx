import React, { useState } from 'react'
import axios from 'axios'

const Superadmin: React.FC = () => {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [societies, setSocieties] = useState<any[]>([])

  async function createSociety(e: React.FormEvent){
    e.preventDefault()
    const token = localStorage.getItem('token')
    const res = await axios.post('/api/superadmin/societies', { name, country, city, area }, { headers: { Authorization: `Bearer ${token}` } })
    setSocieties(prev => [...prev, res.data.society])
  }

  async function createAdmin(e: React.FormEvent){
    e.preventDefault()
    const token = localStorage.getItem('token')
    await axios.post('/api/superadmin/admins', { phone, password: adminPassword, societyId: societies[0]?.id }, { headers: { Authorization: `Bearer ${token}` } })
    alert('Admin created')
  }

  return <div style={{ padding: 24 }}>
    <h2>Superadmin Dashboard</h2>
    <section>
      <h3>Create Society</h3>
      <form onSubmit={createSociety}>
        <input placeholder='Name' value={name} onChange={e=>setName(e.target.value)} />
        <input placeholder='Country' value={country} onChange={e=>setCountry(e.target.value)} />
        <input placeholder='City' value={city} onChange={e=>setCity(e.target.value)} />
        <input placeholder='Area' value={area} onChange={e=>setArea(e.target.value)} />
        <button type='submit'>Create</button>
      </form>
    </section>

    <section style={{ marginTop: 24 }}>
      <h3>Create Admin for first society</h3>
      <form onSubmit={createAdmin}>
        <input placeholder='Phone' value={phone} onChange={e=>setPhone(e.target.value)} />
        <input placeholder='Password' value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} />
        <button type='submit'>Create Admin</button>
      </form>
    </section>
  </div>
}

export default Superadmin
