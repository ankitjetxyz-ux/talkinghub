import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/useAuth";
import { SITE_LOGO_SRC } from "@/lib/brand";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back
          home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "apple-mobile-web-app-title", content: "talkinghub" },
        { name: "msapplication-TileImage", content: SITE_LOGO_SRC },
        { title: "talkinghub" },
        { name: "description", content: "Private messaging on talkinghub" },
        { name: "theme-color", content: "#000000" },
        { property: "og:title", content: "talkinghub" },
        {
          property: "og:description",
          content: "Private messaging on talkinghub",
        },
        { property: "og:type", content: "website" },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "manifest", href: "/manifest.json" },
        {
          rel: "icon",
          href: SITE_LOGO_SRC,
          type: "image/jpeg",
          sizes: "512x512",
        },
        { rel: "apple-touch-icon", href: SITE_LOGO_SRC, sizes: "180x180" },
        { rel: "apple-touch-icon", href: SITE_LOGO_SRC, sizes: "192x192" },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      {/* Extensions often mutate <body>; suppress avoids noisy SSR hydrate diffs */}
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            classNames: {
              toast:
                "!bg-black !border-neutral-900 !rounded-2xl !text-neutral-50 !shadow-none !backdrop-blur-0 [&_[data-description]]:!text-neutral-400 [&_*]:[font-size:inherit]",
              title: "!text-base !font-medium",
              description: "!text-sm !leading-snug !mt-2",
              actionButton: "!text-neutral-950",
              cancelButton: "!text-neutral-500",
              closeButton: "!text-neutral-500",
              icon: "!size-8",
              success: "[&_*]:![color:inherit]",
              error: "[&_*]:![color:inherit]",
              info: "[&_*]:![color:inherit]",
              warning: "[&_*]:![color:inherit]",
            },
            style: { fontSize: "0.875rem" },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
