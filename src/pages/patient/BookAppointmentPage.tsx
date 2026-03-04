import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { createAppointment } from '../../lib/firestore'
import { usePackages } from '../../hooks/usePackages'
import { TIME_SLOTS, type Package } from '../../types'
import { addDays, format } from 'date-fns'

type Step = 1 | 2 | 3

export default function BookAppointmentPage() {
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const { packages, loading: pkgsLoading } = usePackages()

  const [step, setStep] = useState<Step>(1)
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [date, setDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [address, setAddress] = useState(userProfile?.address ?? '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')
  const maxDate = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  async function handleConfirm() {
    if (!userProfile || !selectedPackage) return
    setLoading(true)
    setError('')
    try {
      await createAppointment({
        patientId: userProfile.uid,
        patientName: userProfile.name,
        patientPhone: userProfile.phone,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        packagePrice: selectedPackage.price,
        date,
        timeSlot,
        collectionAddress: address,
        status: 'Pending',
        ...(notes ? { notes } : {}),
      })
      navigate('/dashboard/appointments')
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? 'Unknown error'
      setError(`Booking failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const canProceedStep1 = selectedPackage !== null
  const canProceedStep2 = date && timeSlot && address.trim().length > 5

  const stepLabels = ['Package', 'Schedule', 'Confirm']

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Book a Test</h1>
          <p className="text-slate-500 text-sm mt-1">Home collection — we come to you.</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1">
          {([1, 2, 3] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  step > s
                    ? 'gradient-bg text-white'
                    : step === s
                    ? 'border-2 border-teal-500 text-teal-600'
                    : 'border-2 border-slate-200 text-slate-400'
                }`}
              >
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              <span
                className={`text-xs font-medium ${
                  step === s ? 'text-teal-600' : 'text-slate-400'
                }`}
              >
                {stepLabels[i]}
              </span>
              {i < 2 && (
                <div className={`h-px flex-1 mx-1 ${step > s ? 'bg-teal-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Package selection */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-slate-900">Choose a Package</h2>
            <div className="grid grid-cols-1 gap-3">
              {pkgsLoading ? (
                <LoadingSpinner className="py-8" />
              ) : packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                    selectedPackage?.id === pkg.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-100 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{pkg.name}</h3>
                        {pkg.isPopular && (
                          <span className="gradient-bg text-white text-xs px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{pkg.testCount} tests included</p>
                    </div>
                    <span className="font-extrabold text-teal-600 text-lg shrink-0 ml-4">
                      ₹{pkg.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
            >
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-bold text-slate-900">Schedule Your Collection</h2>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Collection Date
              </label>
              <input
                type="date"
                value={date}
                min={today}
                max={maxDate}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Preferred Time Slot
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTimeSlot(slot)}
                    className={`text-xs py-2 px-2 rounded-xl border-2 font-medium transition-all ${
                      timeSlot === slot
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-100 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Collection Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Enter your full address including flat/house no, street, city, pincode"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special instructions for the phlebotomist..."
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
              >
                Review <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedPackage && (
          <div className="space-y-5">
            <h2 className="font-bold text-slate-900">Review & Confirm</h2>

            <Card>
              <CardContent className="py-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Package</p>
                    <p className="font-bold text-slate-900">{selectedPackage.name}</p>
                  </div>
                  <span className="text-xl font-extrabold text-teal-600">
                    ₹{selectedPackage.price}
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="font-medium text-slate-900 text-sm">
                      {format(new Date(date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Time</p>
                    <p className="font-medium text-slate-900 text-sm">{timeSlot}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="font-medium text-slate-900 text-sm">{address}</p>
                  </div>
                  {notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">Notes</p>
                      <p className="font-medium text-slate-900 text-sm">{notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button size="lg" className="flex-1" loading={loading} onClick={handleConfirm}>
                Confirm Booking
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
