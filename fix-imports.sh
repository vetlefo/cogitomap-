#!/bin/bash
find client/src/components/ui -type f -name "*.tsx" -exec sed -i 's|import { cn } from "@/lib/utils"|import { cn } from "../../lib/utils"|g' {} \;