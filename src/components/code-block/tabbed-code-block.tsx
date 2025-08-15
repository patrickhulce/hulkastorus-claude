"use client";

import {useState, useEffect} from "react";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "../ui/tabs";
import {CheckCircle2, Copy} from "lucide-react";

interface CodeExample {
  label: string;
  code: string;
  language?: string;
}

interface TabbedCodeBlockProps {
  examples: CodeExample[];
  defaultTab?: string;
}

export function TabbedCodeBlock({examples, defaultTab}: TabbedCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab || examples[0]?.label || "");

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    const activeExample = examples.find((ex) => ex.label === activeTab);
    if (activeExample) {
      navigator.clipboard.writeText(activeExample.code);
      setCopied(true);
    }
  };

  if (examples.length === 0) return null;

  return (
    <div className="relative rounded-lg border border-border bg-card">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between border-b border-border px-4">
          <TabsList className="h-12 border-0 bg-transparent p-0">
            {examples.map((example) => (
              <TabsTrigger
                key={example.label}
                value={example.label}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {example.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
        {examples.map((example) => (
          <TabsContent key={example.label} value={example.label} className="m-0">
            <pre className="overflow-x-auto p-4">
              <code className="text-sm text-primary/90">{example.code}</code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
