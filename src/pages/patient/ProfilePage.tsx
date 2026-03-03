import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { User, CheckCircle } from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Card, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { updateUserDocument } from '../../lib/firestore'
import type { ProfileFormData } from '../../types'

export default function ProfilePage() {
  const { userProfile, refreshProfile } = useAuth()
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    defaultValues: {
      name: userProfile?.name ?? '',
      phone: userProfile?.phone ?? '',
      dob: userProfile?.dob ?? '',
      address: userProfile?.address ?? '',
    },
  })

  async function onSubmit(data: ProfileFormData) {
    if (!userProfile?.uid) return
    setServerError('')
    setSaved(false)
    try {
      await updateUserDocument(userProfile.uid, data)
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setServerError('Failed to save profile. Please try again.')
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="gradient-bg p-4 rounded-3xl">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">My Profile</h1>
            <p className="text-slate-500 text-sm">{userProfile?.email}</p>
          </div>
        </div>

        <Card>
          <CardContent className="py-6">
            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                {serverError}
              </div>
            )}
            {saved && (
              <div className="bg-teal-50 border border-teal-200 text-teal-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Profile saved successfully.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Full Name"
                type="text"
                error={errors.name?.message}
                {...register('name', { required: 'Name is required' })}
              />
              <Input
                label="Phone Number"
                type="tel"
                error={errors.phone?.message}
                {...register('phone', {
                  required: 'Phone is required',
                  pattern: {
                    value: /^[6-9]\d{9}$/,
                    message: 'Invalid Indian mobile number',
                  },
                })}
              />
              <Input
                label="Date of Birth"
                type="date"
                error={errors.dob?.message}
                {...register('dob')}
              />
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Address</label>
                <textarea
                  {...register('address')}
                  rows={3}
                  placeholder="Your home address for sample collection"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>

              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold text-slate-900 mb-2">Account Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Role</span>
                <span className="font-medium capitalize">{userProfile?.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Member since</span>
                <span className="font-medium">
                  {userProfile?.createdAt?.toDate
                    ? userProfile.createdAt
                        .toDate()
                        .toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
                    : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
