import Link from "next/link";
import {TopNavbar} from "@/components/navbar/navbar";
import {TabbedCodeBlock} from "@/components/code-block/tabbed-code-block";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Zap, KeyRound, Package} from "lucide-react";

export default function Home() {
  const codeExamples = [
    {
      label: "Bash",
      code: `$ hulk put model.ckpt
https://hulk.st/or.us/abc123
— copied to clipboard ✅`,
    },
    {
      label: "Python",
      code: `import hulkastorus as hulk

# Upload a model
url = hulk.upload("model.ckpt")
print(f"Shared at: {url}")
# https://hulk.st/or.us/abc123`,
    },
  ];

  return (
    <div className="min-h-screen">
      <TopNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="mb-6 text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Dev-Friendly Cloud
            <br />
            Storage, Hulk-Strong.
          </h1>
          <p className="mb-8 text-lg text-muted-foreground max-w-2xl mx-auto">
            Instant public URLs & frictionless CLI / Python uploads — minus the SDK bloat.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">Request an Invite</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/docs">Read the Docs</Link>
            </Button>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 opacity-10">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[40rem] rotate-12">
            🦖
          </div>
        </div>
      </section>

      {/* Three Feature Cards */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle>One-Command Share</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ship files at Raptor speed;{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">hulk put ★</code> → link
                  auto-copied & posted to Slack
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <KeyRound className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Keyless Auth Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Works with GitHub SSO / cloud IAM; zero keys in CI
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Package className="h-8 w-8 text-primary mb-2" />
                <CardTitle>ML-Asset Ready</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Multipart, resumable uploads; content-addressed caching; MD5 + SHA-256 integrity
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Code Snippet and Testimonial */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold mb-6">Simple as it gets</h2>
              <TabbedCodeBlock examples={codeExamples} defaultTab="Bash" />
            </div>

            <div className="flex flex-col justify-center">
              <Card className="bg-accent/50">
                <CardContent className="pt-6">
                  <p className="text-lg italic mb-4">
                    &ldquo;We swapped S3 presign dance for Hulkastorus in an afternoon. Links just
                    work.&rdquo;
                  </p>
                  <p className="text-sm text-muted-foreground">— ML Infra Lead, VFX Co.</p>
                </CardContent>
              </Card>
              <div className="mt-6 text-center">
                <Button size="lg" asChild>
                  <Link href="/register">Request Early Access</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logo Carousel */}
      <section className="border-b border-border py-12 overflow-hidden">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-8">
            TRUSTED BY INNOVATIVE TEAMS
          </p>
          <div className="flex justify-center items-center gap-12 opacity-50">
            <div className="text-2xl font-bold">Hooli</div>
            <div className="text-2xl">◈</div>
            <div className="text-2xl font-bold">Pied Piper</div>
            <div className="text-2xl">◈</div>
            <div className="text-2xl font-bold">Enron</div>
            <div className="text-2xl">◈</div>
            <div className="text-2xl font-bold">Theranos</div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section id="pricing" className="border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center mb-12">Simple, transparent pricing</h2>
          <div className="overflow-x-auto">
            <table className="w-full max-w-4xl mx-auto">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4">Plan</th>
                  <th className="text-center p-4">Free</th>
                  <th className="text-center p-4">Pro</th>
                  <th className="text-center p-4">Tres Commas</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-4 text-muted-foreground">Monthly cost</td>
                  <td className="p-4 text-center font-bold">
                    $0 <span className="text-sm text-muted-foreground">(beta)</span>
                  </td>
                  <td className="p-4 text-center font-bold">
                    $0 <span className="text-sm text-muted-foreground">(beta)</span>
                  </td>
                  <td className="p-4 text-center font-bold">
                    $0 <span className="text-sm text-muted-foreground">(beta)</span>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4 text-muted-foreground">Storage cap</td>
                  <td className="p-4 text-center">10 GB</td>
                  <td className="p-4 text-center">1 TB</td>
                  <td className="p-4 text-center">Unlimited</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4 text-muted-foreground">Bandwidth</td>
                  <td className="p-4 text-center">50 GB/mo</td>
                  <td className="p-4 text-center">1 TB/mo</td>
                  <td className="p-4 text-center">Unlimited</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-4 text-muted-foreground">Support</td>
                  <td className="p-4 text-center">Community</td>
                  <td className="p-4 text-center">24 h SLA</td>
                  <td className="p-4 text-center">Dedicated TAM</td>
                </tr>
                <tr>
                  <td className="p-4"></td>
                  <td className="p-4 text-center">
                    <Button variant="outline" asChild>
                      <Link href="/register">Get Free</Link>
                    </Button>
                  </td>
                  <td className="p-4 text-center">
                    <Button asChild>
                      <Link href="/register">Join Waitlist</Link>
                    </Button>
                  </td>
                  <td className="p-4 text-center">
                    <Button variant="outline" asChild>
                      <Link href="mailto:sales@hulkastor.us">Contact Sales</Link>
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center gap-6 text-sm text-muted-foreground">
            <span>© 2025 Hulkastorus</span>
            <span>•</span>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link
              href="https://twitter.com/hulkastorus"
              className="hover:text-foreground transition-colors"
            >
              Twitter
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
