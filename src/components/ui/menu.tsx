import * as React from "react";
import { DropdownMenu } from "radix-ui";
import { CheckIcon as Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Pop-up menu in the style of a macOS menu: compact rows, a checkmark column for
 * the current choice, opening from its trigger. Built on Radix for keyboard,
 * typeahead and focus return.
 */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-44 origin-(--radix-dropdown-menu-content-transform-origin) rounded-xl bg-popover p-1 font-sans text-[13px] text-popover-foreground shadow-pop",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-150",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

const itemBase =
  "relative flex h-8 cursor-default items-center gap-2 rounded-lg px-2 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-secondary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export function MenuItem({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemBase, className)} {...props} />;
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cn(itemBase, "pl-7", className)} {...props}>
      <DropdownMenu.ItemIndicator className="absolute left-2 flex items-center">
        <Check weight="bold" className="size-3.5! text-foreground!" />
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.RadioItem>
  );
}

export function MenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn("px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

export function MenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn("mx-2 my-1 h-px bg-border", className)} {...props} />;
}
