import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, Award, ArrowRight, Star, FlaskConical } from 'lucide-react'
import { Navbar } from '../../components/layout/Navbar'
import { Footer } from '../../components/layout/Footer'
import { Button } from '../../components/ui/Button'
import { PACKAGES } from '../../types'
import { useAuth } from '../../contexts/AuthContext'

export default function LandingPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

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
            <Star className="h-4 w-4" /> Trusted by 10,000+ patients
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
                desc: 'Reports reviewed and validated by NABL-accredited pathologists with over 15 years of experience.',
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
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-3xl border shadow-sm p-6 flex flex-col ${
                  pkg.popular ? 'border-teal-300 ring-2 ring-teal-200' : 'border-slate-100'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 left-6 gradient-bg text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 text-lg">{pkg.name}</h3>
                  <p className="text-slate-500 text-sm mt-1">{pkg.description}</p>
                </div>
                <div className="text-3xl font-extrabold gradient-text mb-4">₹{pkg.price}</div>
                <ul className="space-y-1.5 mb-6 flex-1">
                  {pkg.tests.map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link to={currentUser ? '/dashboard/book' : '/register'}>
                  <Button variant="outline" size="sm" className="w-full">
                    Book Now
                  </Button>
                </Link>
              </div>
            ))}
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
