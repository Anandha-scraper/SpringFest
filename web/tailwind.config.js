import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx}", "./src/**/*.{js,jsx}"],
  // The site already has its own global reset (styles/base.css) covering
  // every page, not just admin — Tailwind's own reset would silently
  // restyle everything else the moment this file loads.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        // Tailwind's "accent" utility (bg-accent, text-accent-foreground —
        // shadcn's neutral hover color) is pointed at --sd-accent, not the
        // site's own --accent custom property (the brand orange, used
        // directly by hand-written CSS elsewhere via var(--accent)). The
        // generated class names still read "accent" so pasted shadcn
        // component source needs no edits — only the CSS variable
        // underneath is renamed, to keep the two from colliding.
        accent: "var(--sd-accent)",
        "accent-foreground": "var(--sd-accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        sidebar: "var(--sidebar)",
        "sidebar-foreground": "var(--sidebar-foreground)",
        "sidebar-border": "var(--sidebar-border)",
        "sidebar-accent": "var(--sidebar-accent)",
        "sidebar-accent-foreground": "var(--sidebar-accent-foreground)",
      },
      borderRadius: {
        DEFAULT: "var(--r-sm)",
        sm: "calc(var(--r-sm) - 4px)",
        md: "var(--r-sm)",
        lg: "var(--r-md)",
        xl: "var(--r-lg)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
