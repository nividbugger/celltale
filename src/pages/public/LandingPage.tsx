import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, Award, ArrowRight, Star, FlaskConical, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { usePackages } from '../../hooks/usePackages'
import { useAuth } from '../../contexts/AuthContext'

export default function LandingPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null)
  const { packages, loading: pkgsLoading } = usePackages()

  function handleBookNow() {
    navigate(currentUser ? '/dashboard/book' : '/register')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-slate-900 via-teal-900 to-purple-900 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(20,184,166,0.2),transparent_60%)]" />
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-28 text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2 text-teal-300 text-sm font-medium mb-8">
            <Star className="h-4 w-4" /> Professional diagnostics, delivered to your doorstep
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-6 leading-tight">
            Every Cell
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-purple-400 bg-clip-text text-transparent">
              Tells a Story
            </span>
          </h1>
          <p className="text-slate-300 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Book diagnostic tests online and get samples collected from your home. Accurate
            results, digital reports — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleBookNow}>
              Book a Test Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <a href="#packages">
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10"
              >
                View Packages
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Features strip */}
      <div className="bg-slate-900 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: FlaskConical,
                title: 'Comprehensive Testing',
                desc: '100+ diagnostic tests covering all major health parameters, from routine CBC to advanced hormonal panels.',
              },
              {
                icon: Award,
                title: 'Expert Consultations',
                desc: 'Reports reviewed and validated by expert pathologists with extensive clinical experience.',
              },
              {
                icon: CheckCircle,
                title: 'Accurate Reporting',
                desc: 'Get digital reports with detailed breakdowns, normal ranges, and clear interpretation.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 items-start">
                <div className="gradient-bg p-3 rounded-2xl shrink-0">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Packages */}
      <section id="packages" className="py-20 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Health Packages</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Curated diagnostic packages for every health need — from quick checks to
              comprehensive evaluations.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pkgsLoading ? (
              <div className="col-span-3"><LoadingSpinner className="py-12" /></div>
            ) : packages.map((pkg) => {
              const isExpanded = expandedPkg === pkg.id
              return (
                <div
                  key={pkg.id}
                  className={`relative rounded-3xl border shadow-sm flex flex-col ${pkg.color} ${
                    pkg.isPopular ? 'ring-2 ring-blue-300' : ''
                  }`}
                >
                  {pkg.isPopular && (
                    <span className="absolute -top-3 left-6 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  )}

                  {/* Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className={`font-extrabold text-lg leading-tight ${pkg.headerColor}`}>
                        {pkg.name}
                      </h3>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 shrink-0">
                        {pkg.testCount} tests
                      </span>
                    </div>

                    {/* Price */}
                    <div className="text-3xl font-extrabold text-slate-900 mb-4">
                      ₹{pkg.price}
                      <span className="text-sm font-normal text-slate-500 ml-1">/ person</span>
                    </div>

                    {/* Consultations */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {pkg.consultations.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-0.5">
                          <Stethoscope className="h-3 w-3" /> {c}
                        </span>
                      ))}
                    </div>

                    {/* Summary */}
                    <ul className="space-y-1.5 mb-4">
                      {pkg.summary.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle className="h-3.5 w-3.5 text-teal-500 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* Expand/collapse details */}
                    <button
                      onClick={() => setExpandedPkg(isExpanded ? null : pkg.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {isExpanded ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> Hide full details</>
                      ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> View full test details</>
                      )}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-6 pb-4 border-t border-slate-100 pt-4 space-y-2">
                      {pkg.details.map((d) => (
                        <div key={d.category}>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{d.category}</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{d.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="p-6 pt-3 mt-auto">
                    <Link to={currentUser ? '/dashboard/book' : '/register'} className="block">
                      <button className={`w-full py-2.5 rounded-2xl text-sm font-bold transition-colors ${pkg.buttonColor}`}>
                        Book Now
                      </button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="gradient-bg py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <Clock className="h-12 w-12 text-white/80 mx-auto mb-6" />
          <h2 className="text-4xl font-extrabold text-white mb-4">
            Book Your Test in Under 2 Minutes
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Our team will be at your doorstep at your preferred time. No waiting rooms, no
            queues.
          </p>
          <Button
            variant="white"
            size="lg"
            onClick={handleBookNow}
          >
            Get Started — It's Free
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
