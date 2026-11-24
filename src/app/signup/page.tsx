import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/supabase/env";

/** Sign-ups are homeowners, and homeowners use the phone app. */
export default function SignupPage() {
  redirect(isDemoMode ? "/simulator" : "/m/signup");
}
