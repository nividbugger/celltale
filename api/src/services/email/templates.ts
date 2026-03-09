import { config } from '../../config'

// ─── Shared layout wrapper ────────────────────────────────────────────────────

export function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${config.app.name}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                🔬 ${config.app.name}
              </h1>
              <p style="margin:6px 0 0;color:#ccfbf1;font-size:13px;">Trusted Diagnostics, Delivered Home</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                ${config.app.name} · 
                <a href="mailto:${config.app.supportEmail}" style="color:#0d9488;text-decoration:none;">${config.app.supportEmail}</a>
              </p>
              <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">
                You received this email because you are registered on ${config.app.name}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Reusable HTML helpers ────────────────────────────────────────────────────

export function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;color:#64748b;font-size:14px;white-space:nowrap;width:160px;">${label}</td>
    <td style="padding:8px 12px;color:#1e293b;font-size:14px;font-weight:600;">${value}</td>
  </tr>`
}

export function detailTable(...rows: string[]): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;">
    ${rows.join('')}
  </table>`
}

export function ctaButton(label: string, url: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#0f766e,#0d9488);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;letter-spacing:0.2px;">
      ${label}
    </a>
  </div>`
}

export function greeting(name: string): string {
  return `<p style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">Hi ${name},</p>`
}

// ─── Appointment email data shape ─────────────────────────────────────────────

export interface AppointmentEmailData {
  patientName: string
  packageName: string
  packagePrice: number
  date: string          // yyyy-MM-dd
  timeSlot: string      // '09:00 AM'
  collectionAddress: string
  appointmentId: string
  notes?: string
}

// ─── Date formatter ───────────────────────────────────────────────────────────

/** Formats 'yyyy-MM-dd' → 'Wednesday, 5 March 2026' */
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Template 1: Welcome ──────────────────────────────────────────────────────

export function welcomeTemplate(name: string): string {
  return baseLayout(`
    ${greeting(name)}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Welcome to <strong>${config.app.name}</strong>! We're delighted to have you on board.
      We provide accurate, affordable diagnostic tests with home sample collection – 
      so you never have to leave your home.
    </p>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Here's what you can do on your dashboard:
    </p>
    <ul style="color:#475569;font-size:14px;line-height:2;padding-left:20px;margin:0 0 20px;">
      <li>📋 Browse and book health screening packages</li>
      <li>📅 Track your appointment status in real time</li>
      <li>📄 Download your test reports anytime</li>
    </ul>
    ${ctaButton('Book Your First Test', `${config.app.url}/dashboard/book`)}
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
      Questions? Reach us at 
      <a href="mailto:${config.app.supportEmail}" style="color:#0d9488;">${config.app.supportEmail}</a>
    </p>
  `)
}

// ─── Template 2: Appointment Booked ──────────────────────────────────────────

export function appointmentBookedTemplate(data: AppointmentEmailData): string {
  return baseLayout(`
    ${greeting(data.patientName)}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Your appointment has been <strong>successfully booked</strong>. 
      Our team will review and confirm it shortly.
    </p>
    ${detailTable(
      detailRow('Package', data.packageName),
      detailRow('Price', `₹${data.packagePrice.toLocaleString('en-IN')}`),
      detailRow('Date', formatDate(data.date)),
      detailRow('Time Slot', data.timeSlot),
      detailRow('Collection At', data.collectionAddress),
      ...(data.notes ? [detailRow('Notes', data.notes)] : []),
    )}
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
      ⏳ <em>Status: <strong>Pending Confirmation</strong> — you'll receive another email once confirmed.</em>
    </p>
    ${ctaButton('View Appointment', `${config.app.url}/dashboard/appointments`)}
  `)
}

// ─── Template 3: Appointment Confirmed ───────────────────────────────────────

export function appointmentConfirmedTemplate(data: AppointmentEmailData): string {
  return baseLayout(`
    ${greeting(data.patientName)}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Great news! Your appointment has been <strong style="color:#059669;">✅ Confirmed</strong>. 
      Our phlebotomist will visit you at the scheduled time.
    </p>
    ${detailTable(
      detailRow('Package', data.packageName),
      detailRow('Date', formatDate(data.date)),
      detailRow('Time Slot', data.timeSlot),
      detailRow('Collection At', data.collectionAddress),
    )}
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;color:#065f46;font-size:14px;font-weight:600;">📌 How to Prepare</p>
      <ul style="color:#047857;font-size:13px;line-height:2;padding-left:18px;margin:8px 0 0;">
        <li>Fast for 8–12 hours if a fasting test is included</li>
        <li>Drink plenty of water (unless advised otherwise)</li>
        <li>Keep your ID and any previous reports handy</li>
        <li>Be available at the collection address during the time slot</li>
      </ul>
    </div>
    ${ctaButton('View Appointment', `${config.app.url}/dashboard/appointments`)}
  `)
}

// ─── Template 4: Reminder ─────────────────────────────────────────────────────

export function reminderTemplate(data: AppointmentEmailData, hoursLeft: number): string {
  return baseLayout(`
    ${greeting(data.patientName)}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      ⏰ This is a friendly reminder that your appointment is 
      <strong>in approximately ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}</strong>.
    </p>
    ${detailTable(
      detailRow('Package', data.packageName),
      detailRow('Date', formatDate(data.date)),
      detailRow('Time Slot', data.timeSlot),
      detailRow('Collection At', data.collectionAddress),
    )}
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">🔔 Last-Minute Checklist</p>
      <ul style="color:#b45309;font-size:13px;line-height:2;padding-left:18px;margin:8px 0 0;">
        <li>Continue fasting if applicable (water is fine)</li>
        <li>Ensure someone opens the door during the time slot</li>
        <li>Keep your phone nearby — our team may call to confirm arrival</li>
      </ul>
    </div>
    ${ctaButton('View Appointment', `${config.app.url}/dashboard/appointments`)}
  `)
}

// ─── Template 5: Sample Collected ─────────────────────────────────────────────

export function sampleCollectedTemplate(data: AppointmentEmailData): string {
  return baseLayout(`
    ${greeting(data.patientName)}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Your sample has been <strong style="color:#0284c7;">🧪 Successfully Collected</strong> 
      and is now on its way to our certified laboratory for analysis.
    </p>
    ${detailTable(
      detailRow('Package', data.packageName),
      detailRow('Collected On', formatDate(data.date)),
    )}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;color:#1e40af;font-size:14px;font-weight:600;">🔬 What Happens Next</p>
      <ul style="color:#1d4ed8;font-size:13px;line-height:2;padding-left:18px;margin:8px 0 0;">
        <li>Your sample is processed at our certified partner lab</li>
        <li>Results are typically ready within <strong>24–48 hours</strong></li>
        <li>You will receive an email as soon as your report is available</li>
        <li>Downloadable PDF will be available in your dashboard</li>
      </ul>
    </div>
    ${ctaButton('Track Status', `${config.app.url}/dashboard/appointments`)}
  `)
}

// ─── Template 6: Report Ready ─────────────────────────────────────────────────

export function reportReadyTemplate(data: AppointmentEmailData): string {
  return baseLayout(`
    ${greeting(data.patientName)}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Your test report for the <strong>${data.packageName}</strong> package is 
      <strong style="color:#7c3aed;">📄 Ready!</strong> 
      You can view and download it from your patient dashboard.
    </p>
    ${detailTable(
      detailRow('Package', data.packageName),
      detailRow('Test Date', formatDate(data.date)),
    )}
    <div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0;color:#6d28d9;font-size:14px;font-weight:600;">💡 Understanding Your Report</p>
      <ul style="color:#7c3aed;font-size:13px;line-height:2;padding-left:18px;margin:8px 0 0;">
        <li>Values marked in <span style="color:#dc2626;font-weight:600;">red</span> are outside the normal range</li>
        <li>Always consult your doctor to interpret results in context</li>
        <li>Keep a copy of the PDF for your medical records</li>
      </ul>
    </div>
    ${ctaButton('View &amp; Download Report', `${config.app.url}/dashboard/reports`)}
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
      Need help understanding your results? 
      <a href="mailto:${config.app.supportEmail}" style="color:#0d9488;">Contact us</a>
    </p>
  `)
}

export function appointmentCancelledTemplate(data: AppointmentEmailData): string {
  return baseLayout(`
    ${greeting(data.patientName)}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      We're sorry to let you know that your appointment has been
      <strong style="color:#dc2626;">❌ Cancelled</strong>.
      If you'd like to rebook, please visit your dashboard.
    </p>
    ${detailTable(
      detailRow('Package', data.packageName),
      detailRow('Date', formatDate(data.date)),
      detailRow('Time Slot', data.timeSlot),
      detailRow('Appointment ID', data.appointmentId),
    )}
    ${ctaButton('Book a New Appointment', `${config.app.url}/appointments/book`)}
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
      Questions? <a href="mailto:${config.app.supportEmail}" style="color:#0d9488;">Contact us</a>
    </p>
  `)
}
