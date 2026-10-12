import { useForm } from 'react-hook-form'
import { Save } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { saveClinicSettings } from '../../lib/firestore'
import type { ClinicSettings } from '../../types'

interface ClinicSettingsFormData {
  name: string
  tagline: string
  logoUrl: string
  address: string
  phone: string
  email: string
  gstin: string
  state: string
  bankName: string
  bankAccountNumber: string
  bankIfsc: string
}

function toFormData(clinic: ClinicSettings): ClinicSettingsFormData {
  return {
    name: clinic.name,
    tagline: clinic.tagline ?? '',
    logoUrl: clinic.logoUrl ?? '',
    address: clinic.addressLines.join('\n'),
    phone: clinic.phone,
    email: clinic.email,
    gstin: clinic.gstin,
    state: clinic.state,
    bankName: clinic.bankName,
    bankAccountNumber: clinic.bankAccountNumber,
    bankIfsc: clinic.bankIfsc,
  }
}

function fromFormData(data: ClinicSettingsFormData): ClinicSettings {
  return {
    name: data.name,
    tagline: data.tagline || undefined,
    logoUrl: data.logoUrl || undefined,
    addressLines: data.address.split('\n').map((l) => l.trim()).filter(Boolean),
    phone: data.phone,
    email: data.email,
    gstin: data.gstin,
    state: data.state,
    bankName: data.bankName,
    bankAccountNumber: data.bankAccountNumber,
    bankIfsc: data.bankIfsc,
  }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  clinic: ClinicSettings
  onSaved: (clinic: ClinicSettings) => void
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1'

export function ClinicSettingsModal({ isOpen, onClose, clinic, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ClinicSettingsFormData>({
    values: toFormData(clinic),
  })

  async function onSubmit(data: ClinicSettingsFormData) {
    const result = fromFormData(data)
    await saveClinicSettings(result)
    onSaved(result)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Business Details" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-slate-500">
          These details appear on the letterhead of every invoice you generate.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Clinic Name</label>
            <input {...register('name', { required: true })} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Tagline</label>
            <input {...register('tagline')} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Logo URL (optional override)</label>
            <input {...register('logoUrl')} placeholder="Leave blank to use the default logo" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Address (one line per row)</label>
            <textarea {...register('address')} rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input {...register('phone', { required: true })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input {...register('email', { required: true })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>GSTIN</label>
            <input {...register('gstin', { required: true })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input {...register('state', { required: true })} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Bank Name</label>
            <input {...register('bankName')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Account Number</label>
            <input {...register('bankAccountNumber')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>IFSC</label>
            <input {...register('bankIfsc')} className={inputClass} />
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} className="flex-1">
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
