import Link from "next/link";
import {Button} from "../ui/button";

export function TopNavbar() {
  return (
    <nav className="border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🦖</div>
            <Link href="/" className="text-xl font-bold">
              Hulkastorus
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </Link>
            <Button asChild>
              <Link href="/register">Get Beta</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
