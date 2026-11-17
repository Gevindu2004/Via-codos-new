import React, { Suspense } from "react";
import { Mail, Phone, MapPin, MessageSquare } from "lucide-react";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { StaffAugRequestForm } from "@/components/StaffAugRequestForm";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Contact Us" }]}
        eyebrow="Contact Via Codos"
        title="Talk to Our Engineering & Delivery Leadership"
        subtitle="Get a fast response under NDA — whether you need custom software, Codos Console SaaS onboarding, or dedicated engineers."
      />

      <section className="py-16 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
              <h2 className="font-heading text-xl font-bold text-[#0A0F1A]">Direct Channels</h2>
              <div className="flex items-start gap-3 text-sm">
                <Mail className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-[#0A0F1A]">Email</div>
                  <a href="mailto:info@viacodos.com" className="text-slate-600 hover:text-[#1D4ED8]">
                    info@viacodos.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MessageSquare className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-[#0A0F1A]">WhatsApp Direct</div>
                  <a
                    href="https://wa.me/94721980060"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 hover:text-[#1D4ED8]"
                  >
                    +94 721 980 060
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Phone className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-[#0A0F1A]">Office Line</div>
                  <a href="tel:+94769047552" className="text-slate-600 hover:text-[#1D4ED8]">
                    +94 76 904 7552
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-[#0A0F1A]">Headquarters</div>
                  <span className="text-slate-600">Galle, Ginthota, Sri Lanka</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <Suspense fallback={<div className="p-8 text-center text-sm">Loading form...</div>}>
              <StaffAugRequestForm />
            </Suspense>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

