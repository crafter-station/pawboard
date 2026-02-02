import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy - Pawboard",
  description: "Privacy Policy for Pawboard - Where ideas land on their feet",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: February 2, 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to Pawboard. We respect your privacy and are committed to
              protecting your personal data. This privacy policy explains how we
              collect, use, and safeguard your information when you use our
              collaborative ideation board service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you use Pawboard, we may collect the following types of
              information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Device Fingerprint:</strong>{" "}
                We generate a unique identifier for your browser to associate
                you with your sessions and cards. This is stored locally and
                helps maintain your identity across sessions without requiring
                account creation.
              </li>
              <li>
                <strong className="text-foreground">Display Name:</strong> The
                name you choose to display when participating in sessions.
              </li>
              <li>
                <strong className="text-foreground">Session Content:</strong>{" "}
                Ideas, cards, votes, reactions, and comments you create within
                sessions.
              </li>
              <li>
                <strong className="text-foreground">Usage Data:</strong>{" "}
                Information about how you interact with our service, including
                session participation and feature usage.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              How We Use Your Information
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the collected information to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Provide and maintain our collaborative ideation service</li>
              <li>
                Enable real-time collaboration features including presence
                indicators
              </li>
              <li>
                Associate your contributions with your identity in sessions
              </li>
              <li>Improve and optimize our service</li>
              <li>Detect and prevent abuse or unauthorized access</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely using industry-standard practices. We
              use PostgreSQL databases hosted on secure infrastructure and
              implement appropriate technical measures to protect your
              information. Session data is transmitted in real-time using secure
              WebSocket connections.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">
                  Session Participants:
                </strong>{" "}
                Other users in the same session can see your display name,
                cards, votes, reactions, and cursor position.
              </li>
              <li>
                <strong className="text-foreground">Service Providers:</strong>{" "}
                Third-party services that help us operate Pawboard, including
                hosting providers and analytics services.
              </li>
              <li>
                <strong className="text-foreground">Legal Requirements:</strong>{" "}
                When required by law or to protect our rights.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Cookies and Local Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use local storage to save your device fingerprint, display
              name, and theme preferences. This data remains on your device and
              helps provide a seamless experience across visits.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Access the personal data we hold about you</li>
              <li>Request deletion of your data</li>
              <li>
                Clear your local storage to remove your device fingerprint
              </li>
              <li>
                Leave sessions at any time (your contributions may remain unless
                deleted)
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pawboard is not intended for children under 13 years of age. We do
              not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will
              notify you of any changes by posting the new policy on this page
              and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this privacy policy, please
              contact us at{" "}
              <a
                href="mailto:contact@crafterstation.com"
                className="text-primary hover:underline"
              >
                contact@crafterstation.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            See also:{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
