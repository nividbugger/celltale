import { BrandLogo } from './BrandLogo'
import { Mail, Phone, MapPin } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <BrandLogo white />
            <p className="mt-4 text-slate-400 text-sm leading-relaxed">
              Accurate diagnostics, delivered to your doorstep. Trusted by thousands of
              patients across the region.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-400 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <a href="/" className="hover:text-white transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="/register" className="hover:text-white transition-colors">
                  Book a Test
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-white transition-colors">
                  Patient Login
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-400 mb-4">
              Contact
            </h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-teal-400" /> sruthi_kandaswamy@celltalediagnostics.com
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-teal-400" /> +91 8870008442
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-400" /> Chennai, Tamil Nadu
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} Cell Tale Diagnostics. All rights reserved.</p>
          <p>Built with care for your health.</p>
        </div>
      </div>
    </footer>
  )
}
