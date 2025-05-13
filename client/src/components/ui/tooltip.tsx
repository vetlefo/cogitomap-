"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../../lib/utils"

// This component is from Shadcn/UI and provides the necessary Tooltip functionality.
// It can be used by wrapping a trigger element with <TooltipTrigger> and providing
// content via <TooltipContent> within a <Tooltip> and <TooltipProvider>.
// Example Usage (in another component, e.g., ContextBubble or a UI button):
//
// import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip";
//
// <TooltipProvider>
//   <Tooltip>
//     <TooltipTrigger asChild>
//       <button>Hover Me</button>
//     </TooltipTrigger>
//     <TooltipContent>
//       <p>This is a tooltip!</p>
//     </TooltipContent>
//   </Tooltip>
// </TooltipProvider>
//
// No direct changes to this file are needed for the "UX polish" task,
// but it will be imported and used elsewhere.

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }