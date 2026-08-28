import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useIsMobile } from "@/hooks/use-mobile.js";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet.jsx";
import { Button } from "@/components/ui/button.jsx";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip.jsx";

// Trimmed port of shadcn's Sidebar: a fixed sidebar on desktop that collapses
// to an icon rail, an off-canvas Sheet on mobile. The collapsed/expanded
// choice is remembered in localStorage.
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3.5rem";
const SIDEBAR_STORAGE_KEY = "sidebar:state";

const SidebarContext = React.createContext(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}

export function SidebarProvider({ className, style, children, ...props }) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [open, setOpenState] = React.useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "collapsed";
    } catch {
      return true;
    }
  });

  const setOpen = React.useCallback((value) => {
    setOpenState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "expanded" : "collapsed");
      } catch {
        /* private mode / storage disabled — state just won't persist */
      }
      return next;
    });
  }, []);

  const toggleSidebar = React.useCallback(
    () => (isMobile ? setOpenMobile((v) => !v) : setOpen((v) => !v)),
    [isMobile, setOpen]
  );

  const state = open ? "expanded" : "collapsed";

  const value = React.useMemo(
    () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider delayDuration={0}>
        <div
          style={{
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          }}
          className={cn("flex min-h-svh w-full", className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ collapsible = "icon", className, children, ...props }) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground"
          style={{ "--sidebar-width": SIDEBAR_WIDTH }}
        >
          {/* Radix requires a Dialog.Title for a11y; the sidebar's own
              brand heading makes a visible one redundant. */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Site navigation menu</SheetDescription>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
    >
      {/* Spacer in normal flow — reserves the column width so the inset
          content sits beside the (fixed-positioned) sidebar. */}
      <div className="relative w-[--sidebar-width] transition-[width] duration-200 ease-linear group-data-[collapsible=icon]:w-[--sidebar-width-icon]" />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden w-[--sidebar-width] transition-[width] duration-200 ease-linear md:flex",
          "group-data-[collapsible=icon]:w-[--sidebar-width-icon]",
          className
        )}
        {...props}
      >
        <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SidebarTrigger({ className, onClick, ...props }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={(e) => {
        onClick?.(e);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export function SidebarInset({ className, ...props }) {
  return (
    <main
      className={cn("flex min-h-svh min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-2 p-3", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-3", className)} {...props} />;
}

export function SidebarContent({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 group-data-[collapsible=icon]:px-2",
        className
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }) {
  return <ul className={cn("flex w-full flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }) {
  return <li className={cn("relative", className)} {...props} />;
}

export const SidebarMenuButton = React.forwardRef(
  ({ asChild = false, isActive = false, tooltip, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const { state, isMobile } = useSidebar();

    const button = (
      <Comp
        ref={ref}
        data-active={isActive}
        className={cn(
          "flex h-9 w-full items-center gap-2 overflow-hidden rounded-md px-3 text-left text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary data-[active=true]:hover:text-primary-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
          className
        )}
        {...props}
      />
    );

    if (!tooltip) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" hidden={state !== "collapsed" || isMobile}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";
