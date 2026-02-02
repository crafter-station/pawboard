import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service - Pawboard",
  description: "Terms of Service for Pawboard - Where ideas land on their feet",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: February 2, 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Pawboard, you agree to be bound by these
              Terms of Service. If you do not agree with any part of these
              terms, you may not use our service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pawboard is a real-time collaborative ideation board that allows
              users to create sessions, add idea cards, move them around a
              canvas, vote, and react with emojis. All interactions are
              synchronized in real-time across all participants.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pawboard offers two ways to use our service:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Anonymous Access:</strong>{" "}
                You can use Pawboard without creating an account. We use a
                device fingerprint to identify you across sessions. Anonymous
                boards expire after 2 days of inactivity.
              </li>
              <li>
                <strong className="text-foreground">
                  Authenticated Accounts:
                </strong>{" "}
                You may optionally create an account by signing in with Google
                or GitHub. Authentication is handled by Clerk, a third-party
                authentication provider. Authenticated users can claim anonymous
                boards to make them permanent and access additional features.
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              If you create an account, you are responsible for maintaining the
              security of your account credentials and for all activities that
              occur under your account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              When using Pawboard, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Use the service only for lawful purposes</li>
              <li>
                Not post content that is illegal, harmful, threatening, abusive,
                harassing, defamatory, or otherwise objectionable
              </li>
              <li>
                Not attempt to gain unauthorized access to any part of the
                service
              </li>
              <li>
                Not interfere with or disrupt the service or servers connected
                to the service
              </li>
              <li>
                Not use automated systems or software to extract data from the
                service
              </li>
              <li>Respect other users and their contributions</li>
              <li>
                Keep your account credentials secure and not share your account
                with others
              </li>
              <li>
                Provide accurate information when creating an account or
                updating your profile
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Session Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of any content you create on Pawboard. By
              posting content, you grant us a license to store, display, and
              transmit that content as necessary to provide the service. Session
              creators have control over their sessions and may configure
              permissions for other participants.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Content created in sessions is visible to all session
              participants. Do not share sensitive, confidential, or personal
              information in sessions unless you are comfortable with other
              participants seeing it.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Board Expiration:</strong>{" "}
              Sessions created by anonymous users expire after 2 days of
              inactivity. If you sign in and claim an anonymous board, it
              becomes permanent and will not expire. Authenticated users&apos;
              boards do not expire.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Pawboard service, including its original content, features,
              and functionality, is owned by Pawboard and is protected by
              international copyright, trademark, and other intellectual
              property laws. Our cat-themed branding and design elements are
              proprietary.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">AI Features</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pawboard includes AI-powered features for text refinement. When
              you use these features, your content may be processed by
              third-party AI services. We do not guarantee the accuracy or
              appropriateness of AI-generated suggestions, and you are
              responsible for reviewing and approving any AI-assisted
              modifications to your content.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              Pawboard is provided &quot;as is&quot; and &quot;as
              available&quot; without any warranties of any kind, either express
              or implied. We do not warrant that the service will be
              uninterrupted, secure, or error-free. We are not responsible for
              any loss of data or content that may occur.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Pawboard and its
              affiliates shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of
              profits or revenues, whether incurred directly or indirectly, or
              any loss of data, use, goodwill, or other intangible losses
              resulting from your use of the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to terminate or suspend your access to the
              service at any time, without prior notice, for conduct that we
              believe violates these terms or is harmful to other users, us, or
              third parties, or for any other reason at our sole discretion.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              If you have an account, you may delete it at any time through your
              account settings or by contacting us. Upon account deletion, your
              personal information will be removed, but content you created in
              sessions may remain visible to other participants unless
              specifically deleted.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may revise these terms at any time by updating this page. By
              continuing to use Pawboard after changes are posted, you accept
              the revised terms. We encourage you to review these terms
              periodically.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms shall be governed by and construed in accordance with
              applicable laws, without regard to conflict of law principles.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please
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
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
