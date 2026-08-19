import * as React from "react";

import { cn } from "@/lib/utils";
import { fieldSurface } from "./field";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldSurface, "flex min-h-20 py-2 leading-normal", className)}
      {...props}
    />
  );
}

export { Textarea };
